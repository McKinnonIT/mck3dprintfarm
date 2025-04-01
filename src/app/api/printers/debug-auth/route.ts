import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPrusaLinkHeaders } from "@/lib/prusalink-utils";
import fetch from 'node-fetch';
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

    if (!printer.apiKey) {
      return NextResponse.json(
        { error: "Printer has no API key configured" },
        { status: 400 }
      );
    }

    // Generate auth headers
    const authHeaders = createPrusaLinkHeaders(printer);
    console.log("[DEBUG] Using PrusaLink headers:", JSON.stringify(authHeaders));
    
    // Extract IP from API URL for PrusaLinkPy bridge
    const apiUrl = printer.apiUrl;
    const match = apiUrl.match(/https?:\/\/([^:\/]+)/);
    let printerIp = "";
    
    if (match && match[1]) {
      printerIp = match[1];
    } else {
      return NextResponse.json(
        { error: "Could not extract IP address from API URL" },
        { status: 400 }
      );
    }
    
    // Use PrusaLinkPy bridge for a more reliable test
    console.log(`[DEBUG] Using PrusaLinkPy bridge to test connection to ${printerIp}`);
    let prusaLinkPyResult = null;
    
    try {
      prusaLinkPyResult = await prusaLinkBridge.testConnection(printerIp, printer.apiKey);
      console.log("[DEBUG] PrusaLinkPy test result:", prusaLinkPyResult);
    } catch (error) {
      console.error("[DEBUG] PrusaLinkPy test error:", error);
      prusaLinkPyResult = {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
    
    // Also test multiple endpoints with direct fetch for detailed diagnostic info
    const endpointsToTest = [
      { url: `${printer.apiUrl}/api/version`, name: 'Version API' },
      { url: `${printer.apiUrl}/api/printer`, name: 'Printer Status API' },
      { url: `${printer.apiUrl}/api/files`, name: 'Files API' },
      { url: `${printer.apiUrl}/api/files/local`, name: 'Local Files API' }
    ];
    
    const results = [];
    
    // Test each endpoint with our auth
    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing ${endpoint.name} with PrusaLink auth:`, endpoint.url);
        
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: authHeaders
        });
        
        const status = response.status;
        let responseData = null;
        
        try {
          const text = await response.text();
          if (text && text.trim()) {
            try {
              responseData = JSON.parse(text);
            } catch (e) {
              responseData = { text };
            }
          }
        } catch (e) {
          responseData = { error: `Could not read response: ${e.message}` };
        }
        
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status,
          success: response.ok,
          data: responseData
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          error: error.message,
          success: false
        });
      }
    }
    
    // Find any working combination from our direct tests
    const working = results.find(r => r.success);
    
    return NextResponse.json({
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        apiUrl: printer.apiUrl
      },
      authType: "PrusaLink: Basic Auth with 'maker' username",
      prusaLinkPyTest: prusaLinkPyResult,
      success: prusaLinkPyResult?.success || !!working,
      message: prusaLinkPyResult?.success 
        ? `Successfully authenticated using PrusaLinkPy` 
        : (working 
          ? `Authentication successful with ${working.endpoint}` 
          : 'Authentication failed with all endpoints'),
      results
    });
  } catch (error) {
    console.error("Failed to test authentication:", error);
    return NextResponse.json(
      { error: "Failed to test authentication" },
      { status: 500 }
    );
  }
} 