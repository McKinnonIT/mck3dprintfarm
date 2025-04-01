import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const prusaLinkBridge = require("@/lib/prusalink-bridge");

export async function GET(request: Request) {
  try {
    // Get query parameters from URL
    const url = new URL(request.url);
    const printerId = url.searchParams.get("printerId");
    const ip = url.searchParams.get("ip");
    const apiKey = url.searchParams.get("apiKey");
    
    // Validate parameters
    if ((!ip || !apiKey) && !printerId) {
      return NextResponse.json(
        { error: "Missing required parameters. Provide either printerId or both ip and apiKey" },
        { status: 400 }
      );
    }
    
    let printerIp: string;
    let printerApiKey: string;
    
    // If printerId is provided, fetch printer details from database
    if (printerId) {
      const printer = await prisma.printer.findUnique({
        where: { id: printerId },
      });
      
      if (!printer) {
        return NextResponse.json(
          { error: `Printer with id ${printerId} not found` },
          { status: 404 }
        );
      }
      
      // Extract IP from API URL
      printerIp = printer.apiUrl.replace(/^https?:\/\//, "").split(":")[0];
      printerApiKey = printer.apiKey || "";
    } else {
      // Use provided IP and API key
      printerIp = ip!;
      printerApiKey = apiKey!;
    }
    
    // Call the PrusaLink Bridge
    console.log(`Testing PrusaLink status for ${printerIp} with API key: ${printerApiKey.substring(0, 4)}****`);
    const statusResult = await prusaLinkBridge.getJobStatus(printerIp, printerApiKey);
    
    return NextResponse.json(statusResult);
  } catch (error: any) {
    console.error("Error in test-prusalink-status:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 