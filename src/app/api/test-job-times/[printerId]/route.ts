import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const prusaLinkBridge = require("@/lib/prusalink-bridge");

export async function GET(
  request: Request,
  { params }: { params: { printerId: string } }
) {
  try {
    // First get the printer from the database
    const printer = await prisma.printer.findUnique({
      where: { id: params.printerId },
    });
    
    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.printerId} not found` },
        { status: 404 }
      );
    }
    
    // Check if it's a PrusaLink printer
    if (printer.type !== 'prusalink') {
      return NextResponse.json(
        { error: "This endpoint is only for PrusaLink printers" },
        { status: 400 }
      );
    }
    
    // Extract IP from API URL
    const printerIp = printer.apiUrl.replace(/^https?:\/\//, "").split(":")[0];
    
    // Get the status from PrusaLinkPy
    console.log(`Testing job times for ${printer.name} (${printerIp})`);
    
    const statusResult = await prusaLinkBridge.getJobStatus(printerIp, printer.apiKey);
    
    // Also try direct API call
    let directApiData = null;
    try {
      const jobResponse = await fetch(`${printer.apiUrl}/api/job`, {
        headers: {
          'X-Api-Key': printer.apiKey || '',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (jobResponse.ok) {
        directApiData = await jobResponse.json();
      }
    } catch (error) {
      console.error("Error with direct API call:", error);
    }
    
    // Extract times from both sources
    let prusaLinkPyTimes = null;
    if (statusResult.success && statusResult.data && statusResult.data.status) {
      prusaLinkPyTimes = {
        printTimeElapsed: statusResult.data.status.print_time_elapsed,
        printTimeRemaining: statusResult.data.status.print_time_remaining,
        progress: statusResult.data.status.progress,
      };
    }
    
    // Prepare API times if available
    let directApiTimes = null;
    if (directApiData) {
      // Extract times using the logic from prusalink-bridge.js
      let printTimeElapsed = undefined;
      let printTimeRemaining = undefined;
      let progress = 0;
      
      // Extract progress
      if (directApiData.progress && directApiData.progress.completion !== undefined) {
        progress = directApiData.progress.completion;
      }
      
      // Extract times
      if (directApiData.progress && directApiData.progress.printTime !== undefined) {
        printTimeElapsed = directApiData.progress.printTime;
      }
      
      if (directApiData.progress && directApiData.progress.printTimeLeft !== undefined) {
        printTimeRemaining = directApiData.progress.printTimeLeft;
      }
      
      directApiTimes = {
        printTimeElapsed,
        printTimeRemaining,
        progress
      };
    }
    
    // Get current database values
    const dbTimes = {
      printTimeElapsed: printer.printTimeElapsed,
      printTimeRemaining: printer.printTimeRemaining,
      lastUpdated: printer.lastSeen
    };
    
    return NextResponse.json({
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        operationalStatus: printer.operationalStatus
      },
      prusaLinkPyTimes,
      directApiTimes,
      dbTimes,
      statusResult
    });
  } catch (error: any) {
    console.error("Error in test-job-times:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 