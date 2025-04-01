import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First get the printer from the database
    const printer = await prisma.printer.findUnique({
      where: { id: params.id },
    });
    
    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.id} not found` },
        { status: 404 }
      );
    }
    
    // Check if it's a Moonraker printer
    if (printer.type !== 'moonraker') {
      return NextResponse.json(
        { error: "This endpoint is only for Moonraker printers" },
        { status: 400 }
      );
    }
    
    // Test the printer's API endpoints
    const result: any = {
      printer: {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        operationalStatus: printer.operationalStatus
      },
      api_responses: {},
      status: {}
    };

    const apiUrl = printer.apiUrl;
    
    // Define endpoints to check
    const endpoints = [
      "/printer/objects/query?print_stats&extruder&heater_bed&display_status",
      "/api/printer/objects/query?print_stats&extruder&heater_bed&display_status",
      "/printer/status"
    ];
    
    let successfulResponse = false;
    
    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${apiUrl}${endpoint}`, {
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
          
          // If this is the status endpoint, extract details
          if (data.result?.status) {
            successfulResponse = true;
            
            // Extract printer state
            if (data.result.status.print_stats) {
              const printStats = data.result.status.print_stats;
              result.status.state = printStats.state;
              
              // Extract progress 
              if (data.result.status.display_status?.progress !== undefined) {
                result.status.progress = data.result.status.display_status.progress * 100;
              }
              
              // Extract print times
              if (printStats.print_duration !== undefined) {
                result.status.print_time_elapsed = printStats.print_duration;
              }
              
              // Try to calculate the remaining time
              if (result.status.print_time_elapsed !== undefined && 
                  result.status.progress > 0 &&
                  result.status.progress < 100) {
                result.status.print_time_remaining = 
                  (result.status.print_time_elapsed / (result.status.progress / 100)) - 
                  result.status.print_time_elapsed;
              }
            }
            
            // Extract temperatures
            if (data.result.status.heater_bed) {
              result.status.bed_temp = data.result.status.heater_bed.temperature;
              result.status.bed_target = data.result.status.heater_bed.target;
            }
            
            if (data.result.status.extruder) {
              result.status.tool_temp = data.result.status.extruder.temperature;
              result.status.tool_target = data.result.status.extruder.target;
            }
          }
        } else {
          result.api_responses[endpoint] = { 
            error: `HTTP error: ${response.status}`,
            status: response.status
          };
        }
      } catch (error: any) {
        result.api_responses[endpoint] = {
          error: error.message || "Unknown error"
        };
      }
    }
    
    result.success = successfulResponse;
    result.message = successfulResponse 
      ? "Successfully connected to Moonraker API" 
      : "Failed to connect to Moonraker API";
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in test-moonraker-status:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 