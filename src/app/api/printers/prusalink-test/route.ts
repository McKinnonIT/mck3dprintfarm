import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fetch from 'node-fetch';

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

    // Create Basic Auth header
    const basicAuthHeader = 'Basic ' + Buffer.from(`maker:${printer.apiKey}`).toString('base64');

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
        const response = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            'Authorization': basicAuthHeader,
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