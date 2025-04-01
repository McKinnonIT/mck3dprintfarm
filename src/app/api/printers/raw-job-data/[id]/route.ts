import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    if (printer.type !== "prusalink") {
      return NextResponse.json(
        { error: "This endpoint is only for PrusaLink printers" },
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
      "/api/v1/status",
      "/api/telemetry"
    ];

    // Make requests to all endpoints and collect responses
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${printer.apiUrl}${endpoint}`, {
          headers: {
            'X-Api-Key': printer.apiKey || '',
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          result.api_responses[endpoint] = data;
          console.log(`Successful response from ${endpoint}`);
        } else {
          result.api_responses[endpoint] = {
            error: `HTTP error: ${response.status}`,
            status: response.status
          };
          console.log(`Error response from ${endpoint}: ${response.status}`);
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