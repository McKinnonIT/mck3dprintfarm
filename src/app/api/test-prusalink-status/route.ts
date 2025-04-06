import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fetch from 'node-fetch';
import { createHash } from 'crypto';

// Mark this route as dynamic to prevent static generation errors
export const dynamic = 'force-dynamic';

// Define types for the API responses
interface TemperatureData {
  tool?: { actual: number; target: number };
  bed?: { actual: number; target: number };
  [key: string]: any;
}

interface PrinterData {
  state?: { text: string };
  [key: string]: any;
}

interface JobData {
  progress?: { 
    printTime: number; 
    printTimeLeft: number;
    completion: number;
  };
  file?: { name: string };
  [key: string]: any;
}

// Helper function to create a Digest authentication header
async function createDigestAuth(username: string, password: string, method: string, uri: string, realm: string, nonce: string) {
  const ha1 = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.printerId) {
      return NextResponse.json(
        { error: "Printer ID is required" },
        { status: 400 }
      );
    }
    
    // Get printer info from database
    const printer = await prisma.printer.findUnique({
      where: { id: data.printerId },
    });
    
    if (!printer) {
      return NextResponse.json(
        { error: "Printer not found" },
        { status: 404 }
      );
    }
    
    if (!printer.apiUrl) {
      return NextResponse.json(
        { error: "Printer API URL is not configured" },
        { status: 400 }
      );
    }
    
    if (!printer.apiKey) {
      return NextResponse.json(
        { error: "Printer API key is not configured" },
        { status: 400 }
      );
    }
    
    console.log(`[DEBUG] Testing PrusaLink at ${printer.apiUrl} with API key (used as password)`);
    
    // Step 1: First request to get the authentication challenge
    let versionData = null;
    try {
      // First make an unauthenticated request to get the nonce
      const initialResponse = await fetch(`${printer.apiUrl}/api/version`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      // If we get anything but a 401, something is wrong
      if (initialResponse.status !== 401) {
        console.log(`[ERROR] Expected 401 challenge, got ${initialResponse.status}`);
        return NextResponse.json({
          success: false,
          message: `Unexpected response from printer: ${initialResponse.status}`,
          error: await initialResponse.text()
        });
      }
      
      // Get the WWW-Authenticate header
      const authHeader = initialResponse.headers.get('WWW-Authenticate');
      if (!authHeader || !authHeader.includes('Digest')) {
        console.log(`[ERROR] No valid WWW-Authenticate header: ${authHeader}`);
        return NextResponse.json({
          success: false,
          message: "Printer does not support Digest authentication",
          error: `Invalid auth header: ${authHeader}`
        });
      }
      
      // Parse the Digest challenge
      const realm = authHeader.match(/realm="([^"]+)"/)?.[1] || 'Printer API';
      const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
      if (!nonce) {
        console.log(`[ERROR] Could not parse nonce from: ${authHeader}`);
        return NextResponse.json({
          success: false,
          message: "Failed to parse authentication challenge",
          error: `Invalid auth header: ${authHeader}`
        });
      }
      
      // Now create the digest auth header and make the authenticated request
      const digestAuth = await createDigestAuth('maker', printer.apiKey, 'GET', '/api/version', realm, nonce);
      
      console.log(`[DEBUG] Using digest auth for version endpoint`);
      const versionResponse = await fetch(`${printer.apiUrl}/api/version`, {
        method: 'GET',
        headers: {
          'Authorization': digestAuth,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      if (!versionResponse.ok) {
        console.log(`[ERROR] Version endpoint failed with status ${versionResponse.status}`);
        return NextResponse.json({
          success: false,
          message: `Failed to get version info: HTTP ${versionResponse.status}`,
          error: await versionResponse.text()
        });
      }
      
      versionData = await versionResponse.json();
      console.log(`[DEBUG] Version endpoint succeeded with data:`, versionData);
      
      // Get printer status
      let printerData: PrinterData = {};
      try {
        // First get the auth challenge again
        const printerInitialResponse = await fetch(`${printer.apiUrl}/api/printer`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        const printerAuthHeader = printerInitialResponse.headers.get('WWW-Authenticate');
        if (printerAuthHeader && printerAuthHeader.includes('Digest')) {
          const printerRealm = printerAuthHeader.match(/realm="([^"]+)"/)?.[1] || 'Printer API';
          const printerNonce = printerAuthHeader.match(/nonce="([^"]+)"/)?.[1];
          
          if (printerNonce) {
            const printerDigestAuth = await createDigestAuth('maker', printer.apiKey, 'GET', '/api/printer', printerRealm, printerNonce);
            
            const printerResponse = await fetch(`${printer.apiUrl}/api/printer`, {
              method: 'GET',
              headers: {
                'Authorization': printerDigestAuth,
                'Accept': 'application/json'
              },
              timeout: 5000
            });
            
            if (printerResponse.ok) {
              printerData = await printerResponse.json();
              console.log(`[DEBUG] Printer status endpoint succeeded`);
            } else {
              console.log(`[WARN] Printer status endpoint failed with status ${printerResponse.status}`);
            }
          }
        }
      } catch (error) {
        console.error(`[WARN] Failed to get printer status:`, error);
      }
      
      // Format telemetry data from the printer data we got
      const telemetry = {
        temperature: {
          tool: printerData?.temperature?.tool0?.actual || 0,
          bed: printerData?.temperature?.bed?.actual || 0,
          target_tool: printerData?.temperature?.tool0?.target || 0,
          target_bed: printerData?.temperature?.bed?.target || 0
        }
      };
      
      // Format status data
      const statusData = {
        state: printerData?.state?.text || "unknown",
        // We don't have job data since we didn't query the job endpoint
        print_time_elapsed: 0,
        print_time_remaining: 0,
        completion: 0,
        job_name: ""
      };
      
      return NextResponse.json({
        success: true,
        data: {
          printer: printerData,
          telemetry,
          status: statusData,
          raw_endpoints: {
            api_info: versionData,
            printer: printerData
          },
          auth_type: "digest"
        }
      });
      
    } catch (error) {
      console.error(`[ERROR] Failed to get version info:`, error);
      return NextResponse.json({
        success: false,
        message: "Failed to get printer version info",
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
  } catch (error: any) {
    console.error("Error testing PrusaLink status:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get printer status",
        error: error.message
      },
      { status: 500 }
    );
  }
} 