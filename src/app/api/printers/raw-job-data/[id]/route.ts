import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from 'crypto';

// Helper function to create a Digest authentication header
async function createDigestAuth(username: string, password: string, method: string, uri: string, realm: string, nonce: string) {
  const ha1 = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the printer by ID
    const printer = await prisma.printer.findUnique({
      where: { id: params.id },
    });

    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.id} not found` },
        { status: 404 }
      );
    }

    // Only works with PrusaLink printers
    if (!printer.type.toLowerCase().includes("prusa")) {
      return NextResponse.json(
        { error: "This endpoint is only for PrusaLink printers" },
        { status: 400 }
      );
    }

    // Make sure we have an API key
    if (!printer.apiKey) {
      return NextResponse.json(
        { error: "API key is required for PrusaLink printers" },
        { status: 400 }
      );
    }

    // Get the raw job data
    console.log(`Fetching raw job data for ${printer.name} at ${printer.apiUrl}`);
    
    // Prepare the response
    const result: any = {
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
      },
      api_responses: {}
    };

    // Try the most common PrusaLink API endpoints
    const endpoints = [
      "/api/printer",
      "/api/job",
      "/api/version",
      "/api/files",
      "/api/files/local",
      "/api/settings"
    ];

    // Make requests to all endpoints and collect responses
    for (const endpoint of endpoints) {
      try {
        // First make an unauthenticated request to get the auth challenge
        const initialResponse = await fetch(`${printer.apiUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });
        
        // If we get a 200, the endpoint might not require auth
        if (initialResponse.ok) {
          try {
            const data = await initialResponse.json();
            result.api_responses[endpoint] = data;
            console.log(`Successful response from ${endpoint} (no auth needed)`);
            continue;
          } catch (error) {
            // If we can't parse JSON, continue with auth
          }
        }
        
        // We expect a 401 with challenge
        if (initialResponse.status !== 401) {
          result.api_responses[endpoint] = {
            error: `Unexpected response: ${initialResponse.status}`,
            status: initialResponse.status
          };
          console.log(`Unexpected response from ${endpoint}: ${initialResponse.status}`);
          continue;
        }
        
        // Get the WWW-Authenticate header
        const authHeader = initialResponse.headers.get('WWW-Authenticate');
        if (!authHeader || !authHeader.includes('Digest')) {
          result.api_responses[endpoint] = {
            error: `Printer does not support Digest authentication: ${authHeader}`,
            status: 401
          };
          console.log(`No digest auth support for ${endpoint}: ${authHeader}`);
          continue;
        }
        
        // Parse the challenge
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1] || 'Printer API';
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        
        if (!nonce) {
          result.api_responses[endpoint] = {
            error: `Could not parse nonce from challenge: ${authHeader}`,
            status: 401
          };
          console.log(`Failed to parse nonce for ${endpoint}: ${authHeader}`);
          continue;
        }
        
        // Create digest auth header
        const digestAuth = await createDigestAuth('maker', printer.apiKey, 'GET', endpoint, realm, nonce);
        
        // Make authenticated request
        const response = await fetch(`${printer.apiUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': digestAuth,
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          result.api_responses[endpoint] = data;
          console.log(`Successful response from ${endpoint} (with digest auth)`);
        } else {
          result.api_responses[endpoint] = {
            error: `HTTP error: ${response.status}`,
            status: response.status
          };
          console.log(`Error response from ${endpoint} (with digest auth): ${response.status}`);
        }
      } catch (error: any) {
        result.api_responses[endpoint] = {
          error: error.message || "Unknown error"
        };
        console.error(`Error fetching ${endpoint}:`, error);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching raw job data:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 