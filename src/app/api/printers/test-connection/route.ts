import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testPrinterConnection } from "@/lib/printer-utils";
const prusaLinkBridge = require("@/lib/prusalink-bridge");
const bambuLabBridge = require("@/lib/bambulabs-bridge");

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

    // Test connection to printer
    const isPrusaLink = printer.type.toLowerCase().includes('prusa');
    const isBambuLab = printer.type.toLowerCase() === 'bambulab';
    
    let connectionResult;
    if (isPrusaLink) {
      console.log(`[DEBUG] Using PrusaLinkPy bridge for testing ${printer.name}`);
      
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
      
      // Use the PrusaLinkPy bridge for testing
      try {
        // Add explicit timeout for PrusaLinkPy requests
        const prusaLinkPyPromise = prusaLinkBridge.testConnection(printerIp, printer.apiKey);
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('PrusaLinkPy request timed out')), 8000);
        });
        
        // Race the actual request against the timeout
        const connectionResult = await Promise.race([prusaLinkPyPromise, timeoutPromise])
          .catch(error => {
            console.error(`PrusaLinkPy request timed out for ${printer.name}`);
            return { success: false, message: 'Request timed out', error: 'Timeout' };
          });
        
        console.log("[DEBUG] PrusaLinkPy test result:", connectionResult);
      } catch (error) {
        console.error("[DEBUG] PrusaLinkPy bridge error:", error);
        console.error("[DEBUG] Error details:", JSON.stringify(error, null, 2));
        
        let errorMessage = error instanceof Error ? error.message : String(error);
        
        // If we have a traceback from PrusaLinkPy, include that in the log
        if (error.traceback) {
          console.error("[DEBUG] Python traceback:", error.traceback);
          errorMessage = `PrusaLinkPy error: ${error.message}`;
        }
        
        connectionResult = {
          success: false,
          message: errorMessage,
          error: error
        };
      }
    } else if (isBambuLab) {
      console.log(`[DEBUG] Using bambulabs_api bridge for testing ${printer.name}`);
      
      if (!printer.apiKey || !printer.serialNumber) {
        return NextResponse.json({
          success: false,
          message: "Access Code and Serial Number are required for Bambu Lab printers",
          printer: {
            id: printer.id,
            name: printer.name,
            type: printer.type
          }
        });
      }
      
      // The apiUrl should be IP address for Bambu Lab printers
      const printerIp = printer.apiUrl;
      
      // Use the bambulabs-bridge for testing
      try {
        // Add explicit timeout
        const bambuBridgePromise = bambuLabBridge.connectPrinter(
          printerIp,
          printer.serialNumber,
          printer.apiKey,
          8 // 8 seconds timeout
        );
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Bambu Lab request timed out')), 10000);
        });
        
        // Race the actual request against the timeout
        connectionResult = await Promise.race([bambuBridgePromise, timeoutPromise])
          .catch(error => {
            console.error(`Bambu Lab request timed out for ${printer.name}`);
            return { success: false, message: 'Request timed out', error: 'Timeout' };
          });
        
        console.log("[DEBUG] Bambu Lab test result:", connectionResult);
      } catch (error) {
        console.error("[DEBUG] Bambu Lab bridge error:", error);
        console.error("[DEBUG] Error details:", JSON.stringify(error, null, 2));
        
        let errorMessage = error instanceof Error ? error.message : String(error);
        
        // If we have a traceback from Python, include that in the log
        if (error.traceback) {
          console.error("[DEBUG] Python traceback:", error.traceback);
          errorMessage = `Bambu Lab API error: ${error.message}`;
        }
        
        connectionResult = {
          success: false,
          message: errorMessage,
          error: error
        };
      }
    } else {
      connectionResult = await testPrinterConnection(printer);
    }

    if (!connectionResult.success) {
      return NextResponse.json({
        success: false,
        message: connectionResult.message,
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
      data: connectionResult.data
    });
  } catch (error) {
    console.error("Failed to test printer connection:", error);
    return NextResponse.json(
      { error: "Failed to test printer connection" },
      { status: 500 }
    );
  }
} 