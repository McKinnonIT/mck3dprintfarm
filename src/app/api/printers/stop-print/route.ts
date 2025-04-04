import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const { stopPrintJob } = require('@/lib/prusalink-bridge');

export async function POST(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const { printerId } = await request.json();

    if (!printerId) {
      return NextResponse.json(
        { success: false, message: "Missing printerId" },
        { status: 400 }
      );
    }

    // Find the printer in the database
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return NextResponse.json(
        { success: false, message: "Printer not found" },
        { status: 404 }
      );
    }

    // Check if this is a PrusaLink printer
    if (printer.type !== "PRUSALINK") {
      return NextResponse.json(
        { success: false, message: "Only PrusaLink printers are supported" },
        { status: 400 }
      );
    }

    // Extract IP from API URL
    let printerIp = "";
    try {
      const apiUrl = new URL(printer.apiUrl);
      printerIp = apiUrl.hostname;
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid printer API URL" },
        { status: 400 }
      );
    }

    // Make sure we have API key
    if (!printerIp || !printer.apiKey) {
      return NextResponse.json(
        { success: false, message: "Printer IP or API key missing" },
        { status: 400 }
      );
    }

    console.log(`Stopping print job on printer ${printer.name} (${printerIp})...`);

    // Call the bridge function
    const result = await stopPrintJob(printerIp, printer.apiKey);

    console.log(`Stop print job result:`, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error stopping print job:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 