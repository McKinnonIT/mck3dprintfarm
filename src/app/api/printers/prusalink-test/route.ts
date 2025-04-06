import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fetch from 'node-fetch';
import { createHash } from 'crypto';

// Helper function to create a Digest authentication header
async function createDigestAuth(username: string, password: string, method: string, uri: string, realm: string, nonce: string) {
  const ha1 = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
}

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

    // Ensure the printer is a PrusaLink printer
    if (!printer.type.toLowerCase().includes('prusa')) {
      return NextResponse.json(
        { error: "This endpoint is only for PrusaLink printers" },
        { status: 400 }
      );
    }

    // Ensure we have an API key
    if (!printer.apiKey) {
      return NextResponse.json(
        { error: "API key is required for PrusaLink printers" },
        { status: 400 }
      );
    }

    // Test API endpoints
    const apiEndpoints = [
      '/api/version',
      '/api/printer',
      '/api/job',
      '/api/files',
      '/api/files/local',
      '/api/settings',
    ];

    const results = [];

    for (const endpoint of apiEndpoints) {
      const endpointUrl = `${printer.apiUrl}${endpoint}`;
      console.log(`[DEBUG] Testing PrusaLink endpoint: ${endpointUrl}`);
      
      try {
        // First make an unauthenticated request to get the auth challenge
        const initialResponse = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // We expect a 401 with challenge
        if (initialResponse.status !== 401) {
          results.push({
            endpoint,
            url: endpointUrl,
            status: initialResponse.status,
            statusText: "Unexpected response",
            success: false,
            error: `Expected 401 challenge but got ${initialResponse.status}`
          });
          continue;
        }
        
        // Get the WWW-Authenticate header
        const authHeader = initialResponse.headers.get('WWW-Authenticate');
        if (!authHeader || !authHeader.includes('Digest')) {
          results.push({
            endpoint,
            url: endpointUrl,
            status: 401,
            statusText: "Authentication Failed",
            success: false,
            error: `Printer does not support Digest authentication: ${authHeader}`
          });
          continue;
        }
        
        // Parse the challenge
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1] || 'Printer API';
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        
        if (!nonce) {
          results.push({
            endpoint,
            url: endpointUrl,
            status: 401,
            statusText: "Authentication Failed",
            success: false,
            error: `Could not parse nonce from challenge: ${authHeader}`
          });
          continue;
        }
        
        // Create digest auth header
        const digestAuth = await createDigestAuth('maker', printer.apiKey, 'GET', endpoint, realm, nonce);
        
        // Make authenticated request
        const response = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            'Authorization': digestAuth,
            'Accept': 'application/json'
          }
        });

        let responseData;
        try {
          const text = await response.text();
          responseData = text ? JSON.parse(text) : null;
        } catch (error) {
          responseData = { parseError: 'Could not parse response as JSON' };
        }

        results.push({
          endpoint,
          url: endpointUrl,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData
        });
      } catch (error) {
        results.push({
          endpoint,
          url: endpointUrl,
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
      }
    }

    return NextResponse.json({
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        apiUrl: printer.apiUrl
      },
      results
    });
  } catch (error) {
    console.error("Failed to test PrusaLink API:", error);
    return NextResponse.json(
      { error: "Failed to test PrusaLink API" },
      { status: 500 }
    );
  }
} 