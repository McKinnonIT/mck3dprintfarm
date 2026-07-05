import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { getPrinterDriver } from "@/lib/drivers";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { fileId, printerId, printNow = true } = data;

    if (!fileId || !printerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get file details
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Get printer details
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return NextResponse.json(
        { error: "Printer not found" },
        { status: 404 }
      );
    }

    if (!printer.apiKey && (printer.type.toLowerCase().includes('prusa') || printer.type.toLowerCase() === 'moonraker')) {
        return NextResponse.json({ error: "Printer API key is missing for this printer type." }, { status: 400 });
    }

    // Determine status based on printNow flag
    const jobStatus = printNow ? "pending" : "uploaded";
    
    // Find the absolute path based on the stored relative path
    const absoluteFilePath = path.join(process.cwd(), "uploads", file.path);

    // Check if file exists on disk before proceeding
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`File not found on server disk at path: ${absoluteFilePath}. DB record path: ${file.path}`);
      return NextResponse.json(
        { error: "File not found on server disk. It may have been deleted or moved." },
        { status: 404 }
      );
    }

    // Create a record of the print job in the database *before* calling the bridge
    // We will update its status later
    const printJob = await prisma.printJob.create({
      data: {
        name: file.name,
        fileId: file.id, // Link to the existing file record
        printerId: printerId,
        status: "PENDING_APPROVAL", // Use Enum value (Prisma maps this)
        submittedByUserId: session.user.id // Use renamed field
      }
    });

    // Get file extension to determine the correct API flow
    const fileExt = path.extname(file.name).toLowerCase();
    const isPrusaLink = printer.type.toLowerCase().includes('prusa');
    const isMoonraker = printer.type.toLowerCase() === 'moonraker';
    const isBambuLab = printer.type.toLowerCase().includes('bambu');
    const isBGCode = fileExt === '.bgcode';
    const isGCode = fileExt === '.gcode';
    const is3MF = fileExt === '.3mf';
    
    // --- File Type Compatibility Checks ---
    if (isPrusaLink && !isBGCode) {
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "FAILED", errorMessage: "PrusaLink printers currently only support .bgcode files via this interface." } });
       return NextResponse.json({ error: "PrusaLink printers currently only support .bgcode files via this interface.", jobId: printJob.id }, { status: 400 });
    }
    if (isMoonraker && !isGCode) {
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "FAILED", errorMessage: "Moonraker printers only support .gcode files." } });
       return NextResponse.json({ error: "Moonraker printers only support .gcode files.", jobId: printJob.id }, { status: 400 });
    }
    if (isBambuLab && !is3MF && !isGCode) { // Bambu can often take gcode too
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "FAILED", errorMessage: "Bambu Lab printers currently only support .3mf files (and sometimes .gcode) via this interface." } });
       return NextResponse.json({ error: "Bambu Lab printers currently only support .3mf files (and sometimes .gcode) via this interface.", jobId: printJob.id }, { status: 400 });
    }
    // --- End Compatibility Checks ---

    try {
      if (isPrusaLink || isMoonraker) {
        console.log(`[Print Job API] Using native driver for ${printer.type} printer ${printer.name}`);
        const driver = getPrinterDriver(printer);
        const filenameOnPrinter = path.basename(file.name);
        const fileBuffer = fs.readFileSync(absoluteFilePath);

        await driver.uploadFile(fileBuffer, filenameOnPrinter, { printAfterUpload: printNow });

        const finalStatus = printNow ? "PRINTING" : "APPROVED";
        await prisma.printJob.update({
          data: {
            status: finalStatus,
            startedAt: printNow ? new Date() : null,
            errorMessage: null
          },
          where: { id: printJob.id },
        });
        if (printNow) {
          await prisma.printer.update({
            where: { id: printer.id },
            data: { operationalStatus: "printing", printStartTime: new Date() }
          });
        }
        console.log(`[Print Job API] Job ${printJob.id} status updated to ${finalStatus} successfully.`);
      } else if (isBambuLab) {
          // TODO: Implement Bambu Lab handling using its Python bridge
          console.warn(`[Print Job API] Bambu Lab handling not yet implemented via Python bridge.`);
          throw new Error('Bambu Lab printing not yet implemented via bridge.');
      } else {
          // --- Generic/Fallback Handling (Needs Review) ---
          // This path should ideally not be hit if types are handled above
          console.warn(`[Print Job API] Reached generic handling for printer type ${printer.type}. Review required.`);
          throw new Error(`Unsupported printer type for bridge: ${printer.type}`);
          // const uploadResult = await uploadFileToPrinter(printer, absoluteFilePath, file.name);
          // if (!uploadResult.success) throw new Error(uploadResult.message);
          // if (printNow) {
          //     const printResult = await startPrintJob(printer, uploadResult, file.name);
          //     if (!printResult.success) throw new Error(printResult.message);
          //     await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "printing", startedAt: new Date() } });
          //     await prisma.printer.update({ where: { id: printer.id }, data: { operationalStatus: "printing", printStartTime: new Date() } });
          // } else {
          //     await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "uploaded" } });
          // }
      }

      // If we reach here, the operation specific to the printer type was successful
      const finalJob = await prisma.printJob.findUnique({ where: { id: printJob.id }});
      return NextResponse.json(finalJob);

    } catch (error: any) {
      // Outer error handler: Catches errors from bridge calls or other issues within the try block
      console.error('[Print Job API] Error during printer communication or job update:', error);
      // Update job status to failed
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Unknown communication error"
        }
      }).catch(dbErr => console.error("DB update failed on outer error:", dbErr)); // Catch potential error during update
      
      return NextResponse.json(
        { 
          error: error.message || "Unknown communication error", 
          jobId: printJob.id
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Top-level error handler: Catches errors before job creation or in initial setup
    console.error('[Print Job API] Top-level API error:', error);
    return NextResponse.json(
      { error: error.message || "Unknown internal server error" }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const printJobs = await prisma.printJob.findMany({
      where: {
        submittedByUserId: session.user.id,
      },
      include: {
        file: true,
        printer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(printJobs);
  } catch (error) {
    console.error("Failed to fetch print jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch print jobs" },
      { status: 500 }
    );
  }
} 