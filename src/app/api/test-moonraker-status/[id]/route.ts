import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First get the printer from the database
    const printer = await prisma.printer.findUnique({
      where: { id: params.id },
    });
    
    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.id} not found` },
        { status: 404 }
      );
    }
    
    // Check if it's a Moonraker printer
    if (printer.type !== 'moonraker') {
      return NextResponse.json(
        { error: "This endpoint is only for Moonraker printers" },
        { status: 400 }
      );
    }
    
    // Test the printer using the moonraker-bridge-py.js
    const moonrakerBridge = require('@/lib/moonraker-bridge-py');
    
    // Get both connection info and status
    const connectionResult = await moonrakerBridge.testConnection(printer.apiUrl, printer.apiKey);
    const statusResult = await moonrakerBridge.getJobStatus(printer.apiUrl, printer.apiKey);
    
    const result = {
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        operationalStatus: printer.operationalStatus
      },
      success: connectionResult.success,
      message: connectionResult.message,
      connection_data: connectionResult.data,
      status_data: statusResult.success ? statusResult.data : { error: statusResult.message || "Failed to get status" }
    };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in test-moonraker-status:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 