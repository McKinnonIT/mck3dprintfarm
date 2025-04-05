import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { uploadFileToPrinter, startPrintJob } from "@/lib/printer-utils";
const prusaLinkBridge = require("@/lib/prusalink-bridge");
const moonrakerBridge = require("@/lib/moonraker-bridge-py");

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
    
    // Create a temporary file record in the database
    const filePath = file.path;
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        path: filePath,
        size: file.size,
        type: "gcode",
        uploadedBy: session.user.id
      }
    });

    // Create a record of the print job in the database
    const printJob = await prisma.printJob.create({
      data: {
        name: file.name,
        fileId: fileRecord.id,
        printerId: printerId,
        status: "uploaded",
        userId: session.user.id
      }
    });

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
      // Get the printer's IP address
      const printerIp = printer.apiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      console.log(`Printer IP: ${printerIp}`);

      // Use our direct Python implementation of PrusaLinkPy
      console.log(`[DEBUG] Using direct PrusaLinkPy script for ${printer.name}, IP: ${printerIp}`);

      try {
        // Upload the file to the printer using the direct Python implementation
        console.log(`[DEBUG] Uploading file ${filePath} (${file.size / 1024 / 1024}MB) to printer ${printer.name}`);
        
        const prusaLinkBridge = require('@/lib/prusalink-pure');
        
        // Generate a unique remote filename to avoid conflicts
        const timestamp = new Date().getTime();
        const remoteFilename = `PrintFarm_${timestamp}_${path.basename(file.name)}`;
        
        // Determine storage location (use /usb/ for Prusa printers)
        const remoteStorage = printer.type === "prusalink" ? "/usb/" : "";
        const remotePath = `${remoteStorage}${remoteFilename}`;
        
        // Upload the file
        console.log(`[DEBUG] Remote path: ${remotePath}`);
        const uploadResult = await prusaLinkBridge.uploadFileToPrinter(printerIp, printer.apiKey, filePath, remotePath);
        
        if (!uploadResult.success) {
          console.error(`[ERROR] Failed to upload file to printer ${printer.name}:`, uploadResult.error);
          return NextResponse.json({ 
            error: `Failed to upload file to printer: ${uploadResult.message}` 
          }, { status: 500 });
        }
        
        // Start printing only if printNow is true
        if (printNow) {
          console.log(`[DEBUG] Starting print job on printer ${printer.name}`);
          
          const printResult = await prusaLinkBridge.startPrintJob(printerIp, printer.apiKey, remotePath);
          
          if (!printResult.success) {
            console.error(`[ERROR] Failed to start print job on printer ${printer.name}:`, printResult.error);
            
            // Update job status to reflect the failure
            await prisma.printJob.update({
              where: { id: printJob.id },
              data: { 
                status: "failed",
                error: printResult.message
              }
            });
            
            return NextResponse.json({ 
              error: `File uploaded successfully but print failed to start: ${printResult.message}`,
              jobId: printJob.id
            }, { status: 500 });
          }
          
          // Update job status to printing
          await prisma.printJob.update({
            where: { id: printJob.id },
            data: { status: "printing" }
          });
          
          return NextResponse.json({ 
            message: "File uploaded and print started successfully", 
            jobId: printJob.id 
          });
        }
        
        return NextResponse.json({ 
          message: "File uploaded successfully", 
          jobId: printJob.id 
        });
        
      } catch (error) {
        console.error(`[ERROR] Exception in print-jobs API:`, error);
        return NextResponse.json({ 
          error: `Server error: ${error.message}` 
        }, { status: 500 });
      }
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