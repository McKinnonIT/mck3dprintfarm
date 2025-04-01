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

    // Only works with Moonraker printers
    if (printer.type !== "moonraker") {
      return NextResponse.json(
        { error: "This endpoint is only for Moonraker printers" },
        { status: 400 }
      );
    }

    // Get the raw job data
    console.log(`Fetching raw Moonraker data for ${printer.name} at ${printer.apiUrl}`);
    
    // Prepare the response
    const result: any = {
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
      },
      api_responses: {}
    };

    // Try the most common Moonraker API endpoints
    const endpoints = [
      "/printer/info",
      "/printer/objects/list",
      "/printer/objects/query?print_stats&extruder&heater_bed&display_status",
      "/api/printer/objects/query?print_stats&extruder&heater_bed&display_status", // Alternative path
      "/server/info",
      "/printer/status"
    ];

    // Make requests to all endpoints and collect responses
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${printer.apiUrl}${endpoint}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });

        clearTimeout(timeoutId);

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
    console.error("Error fetching raw Moonraker data:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 