// Add detailed logging of auth headers and response 

// Replace with:

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
const prusaLinkBridge = require("@/lib/prusalink-bridge");

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
    
    let connectionResult;
    if (isPrusaLink) {
      console.log(`[DEBUG] Using PrusaLinkPy bridge for connecting to ${printer.name}`);
      
      if (!printer.apiKey) {
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
      
      // Extract IP from API URL
      const apiUrl = printer.apiUrl;
      const match = apiUrl.match(/https?:\/\/([^:\/]+)/);
      if (!match || !match[1]) {
        return NextResponse.json({
          success: false,
          message: "Could not extract IP address from API URL",
          printer: {
            id: printer.id,
            name: printer.name,
            type: printer.type,
            apiUrl: printer.apiUrl
          }
        });
      }
      
      const printerIp = match[1];
      
      try {
        connectionResult = await prusaLinkBridge.connectPrinter(
          printerIp, 
          printer.apiKey,
          60
        );
      } catch (error) {
        console.error(`Error connecting to printer ${printer.name}:`, error);
        return NextResponse.json({
          success: false,
          message: `Failed to connect to ${printer.name}: ${error.message || 'Unknown error'}`,
          printer: {
            id: printer.id,
            name: printer.name,
            type: printer.type
          }
        });
      }
    } else {
      // Handle other printer types (Moonraker, etc.)
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