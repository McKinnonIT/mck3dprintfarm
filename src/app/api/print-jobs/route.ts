import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { uploadFileToPrinter, startPrintJob } from "@/lib/printer-utils";
const prusaLinkBridge = require("@/lib/prusalink-bridge");
const moonrakerBridge = require("@/lib/moonraker-bridge");

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

    // Determine status based on printNow flag
    const jobStatus = printNow ? "pending" : "uploaded";
    
    // Create print job
    const printJob = await prisma.printJob.create({
      data: {
        name: file.name,
        status: jobStatus,
        fileId: file.id,
        printerId: printer.id,
        userId: session.user.id,
      },
    });

    const filePath = file.path;
    
    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    // Get file extension to determine the correct API flow
    const fileExt = path.extname(file.name).toLowerCase();
    const isPrusaLink = printer.type.toLowerCase().includes('prusa');
    const isMoonraker = printer.type.toLowerCase() === 'moonraker';
    const isBGCode = fileExt === '.bgcode';
    const isGCode = fileExt === '.gcode';
    
    // For PrusaLink printers, only bgcode files are supported
    if (isPrusaLink && !isBGCode) {
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: "failed",
          error: "Only Prusa printers support .bgcode files"
        }
      });
      
      return NextResponse.json(
        { error: "Only Prusa printers support .bgcode files" },
        { status: 400 }
      );
    }

    // For Moonraker printers, only gcode files are supported
    if (isMoonraker && !isGCode) {
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: "failed",
          error: "Moonraker printers only support .gcode files"
        }
      });
      
      return NextResponse.json(
        { error: "Moonraker printers only support .gcode files" },
        { status: 400 }
      );
    }

    try {
      // Extract API URL to get IP address for PrusaLink
      let printerIp = "";
      if (isPrusaLink) {
        // Extract IP from API URL
        const apiUrl = printer.apiUrl;
        const match = apiUrl.match(/https?:\/\/([^:\/]+)/);
        if (match && match[1]) {
          printerIp = match[1];
        } else {
          throw new Error("Could not extract IP address from API URL");
        }
      }

      console.log(`[DEBUG] Processing print job for ${file.name} on ${printer.name} (${printer.type})`);
      
      let uploadResult;
      
      // Use PrusaLinkPy bridge for Prusa printers
      if (isPrusaLink) {
        console.log(`[DEBUG] Using PrusaLinkPy bridge for ${printer.name}, IP: ${printerIp}`);
        
        if (!printer.apiKey) {
          throw new Error("API key is required for PrusaLink printers");
        }
        
        // Use prusaLinkBridge.uploadAndPrint which handles both upload and print
        console.log(`[DEBUG] Uploading file to PrusaLink at ${printerIp}`);
        try {
          uploadResult = await prusaLinkBridge.uploadAndPrint(
            printerIp,
            printer.apiKey,
            filePath,
            file.name,
            printNow
          );
          
          console.log(`[DEBUG] PrusaLinkPy bridge result:`, uploadResult);
          
          if (!uploadResult.success) {
            console.error('[DEBUG] PrusaLinkPy bridge returned error:', uploadResult);
            throw new Error(uploadResult.message || "Unknown error from PrusaLinkPy");
          }
        } catch (error) {
          console.error('[DEBUG] PrusaLinkPy bridge error:', error);
          console.error('[DEBUG] Error details:', JSON.stringify(error, null, 2));
          
          // Throw enhanced error
          if (error.traceback) {
            throw new Error(`PrusaLinkPy error: ${error.message}\n${error.traceback}`);
          } else {
            throw error;
          }
        }
        
        // If we're printing, update the job status
        if (printNow) {
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "printing",
              startedAt: new Date()
            }
          });
        } else {
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "uploaded"
            }
          });
        }
      } else if (isMoonraker) {
        // For Moonraker printers
        console.log(`[DEBUG] Using Moonraker bridge for ${printer.name}`);
        
        // Use moonrakerBridge.uploadAndPrint which handles both upload and print
        console.log(`[DEBUG] Uploading file to Moonraker at ${printer.apiUrl}`);
        try {
          uploadResult = await moonrakerBridge.uploadAndPrint(
            printer.apiUrl,
            printer.apiKey,
            filePath,
            file.name,
            printNow
          );
          
          console.log(`[DEBUG] Moonraker bridge result:`, uploadResult);
          
          if (!uploadResult.success) {
            console.error('[DEBUG] Moonraker bridge returned error:', uploadResult);
            throw new Error(uploadResult.message || "Unknown error from Moonraker");
          }
        } catch (error) {
          console.error('[DEBUG] Moonraker bridge error:', error);
          console.error('[DEBUG] Error details:', JSON.stringify(error, null, 2));
          throw error;
        }
        
        // Update job status based on operation result
        if (printNow) {
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "printing",
              startedAt: new Date()
            }
          });
          
          // Update the printer status
          await prisma.printer.update({
            where: { id: printer.id },
            data: { 
              operationalStatus: "printing",
              printStartTime: new Date()
            },
          });
        } else {
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "uploaded"
            }
          });
        }
      } else {
        // For other printer types, use the existing implementation
        // Step 1: Upload file to printer
        console.log(`[DEBUG] Using standard upload for ${printer.name}`);
        uploadResult = await uploadFileToPrinter(printer, filePath, file.name);
        
        if (!uploadResult.success) {
          console.log(`[DEBUG] Upload failed with message: ${uploadResult.message}`);
          throw new Error(uploadResult.message);
        }
        
        console.log('[DEBUG] Upload successful:', uploadResult.message);
        
        // Step 2: Start print job if requested
        if (printNow) {
          console.log(`[DEBUG] Starting print job for ${file.name} on ${printer.name}`);
          
          const printResult = await startPrintJob(printer, uploadResult, file.name);
          
          if (!printResult.success) {
            console.log(`[DEBUG] Print start failed with message: ${printResult.message}`);
            throw new Error(printResult.message);
          }
          
          console.log('[DEBUG] Print job started:', printResult.message);
          
          // Update print job status to printing
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "printing",
              startedAt: new Date()
            }
          });
          
          // Update the printer status
          await prisma.printer.update({
            where: { id: printer.id },
            data: { 
              operationalStatus: "printing",
              printStartTime: new Date()
            },
          });
        } else {
          // Just update the job status to uploaded
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: {
              status: "uploaded"
            }
          });
        }
      }
      
      return NextResponse.json({
        ...printJob,
        status: printNow ? "printing" : "uploaded"
      });
    } catch (error) {
      console.error('Printer communication error:', error);
      console.error('[DEBUG] Error type:', typeof error);
      console.error('[DEBUG] Error stack:', error.stack);
      
      // Log the current state of the key variables for debugging
      try {
        console.error('[DEBUG] printer:', JSON.stringify({
          id: printer.id,
          name: printer.name,
          type: printer.type,
          apiUrl: printer.apiUrl
        }, null, 2));
      } catch (logError) {
        console.error('[DEBUG] Could not log printer details');
      }
      
      // Update job status to failed
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        }
      });
      
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : "Unknown error",
          job: {
            ...printJob,
            status: "failed"
          }
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
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
        userId: session.user.id,
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