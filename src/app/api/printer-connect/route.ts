// Add detailed logging of auth headers and response 

// Replace with:

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const { printerId } = data;

    if (!printerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
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

    // Connect to printer
    const isPrusaLink = printer.type.toLowerCase().includes('prusa');
    const isMoonraker = printer.type.toLowerCase() === 'moonraker';

    if (isPrusaLink && !printer.apiKey) {
      return NextResponse.json({
        success: false,
        message: "API key is required for PrusaLink printers",
        printer: {
          id: printer.id,
          name: printer.name,
          type: printer.type
        }
      });
    }

    if (!isPrusaLink && !isMoonraker) {
      return NextResponse.json({
        success: false,
        message: "Connection not implemented for this printer type",
        printer: {
          id: printer.id,
          name: printer.name,
          type: printer.type
        }
      });
    }

    let connectionResult;
    try {
      const driver = getPrinterDriver(printer);
      const result = await driver.testConnection();
      connectionResult = { data: result.details };
    } catch (error) {
      console.error(`Error connecting to printer ${printer.name}:`, error);
      return NextResponse.json({
        success: false,
        message: `Failed to connect to ${printer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        printer: {
          id: printer.id,
          name: printer.name,
          type: printer.type
        }
      });
    }

    // Update last seen timestamp
    await prisma.printer.update({
      where: { id: printer.id },
      data: { 
        lastSeen: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${printer.name}`,
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type
      },
      data: connectionResult?.data || {}
    });
  } catch (error) {
    console.error("Failed to connect to printer:", error);
    return NextResponse.json(
      { error: "Failed to connect to printer", details: error.message },
      { status: 500 }
    );
  }
} 