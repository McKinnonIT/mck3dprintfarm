import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const prusaLinkBridge = require("@/lib/prusalink-bridge");

// Keep track of offline PrusaLink printers with a backoff mechanism
const offlinePrusaLinkPrinters = new Map<string, { until: Date }>();
const OFFLINE_BACKOFF_TIME_MS = 30 * 1000; // 30 seconds backoff instead of 2 minutes

// Add a semaphore for limiting concurrent connections
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    
    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}

// Create a semaphore that limits concurrent printer connections
const CONNECTION_SEMAPHORE = new Semaphore(5); // Maximum 5 concurrent connections

// Add state mapping for Moonraker
const mapMoonrakerState = (state: string): string => {
  switch (state.toLowerCase()) {
    case 'printing':
      return 'printing';
    case 'complete':
      return 'idle';
    case 'standby':
      return 'idle';
    case 'error':
      return 'error';
    case 'paused':
      return 'paused';
    case 'cancelled':
      return 'idle';
    default:
      return 'idle';
  }
};

// Add mapping for PrusaLink states
const mapPrusaLinkState = (state: string): string => {
  switch (state.toLowerCase()) {
    case 'printing':
      return 'printing';
    case 'operational':
      return 'idle';
    case 'paused':
      return 'paused';
    case 'error':
      return 'error';
    case 'offline':
      return 'offline';
    case 'cancelling':
      return 'idle';
    case 'busy':
      return 'busy';
    default:
      return 'idle';
  }
};

// Add utility function at the top of the file
function isTimeoutError(error: any): boolean {
  return error && (
    error.name === 'AbortError' || 
    error.message?.includes('timeout') || 
    error.message?.includes('aborted') ||
    error instanceof DOMException && error.name === 'AbortError' ||
    error.code === 'ETIMEDOUT'
  );
}

export async function GET() {
  try {
    const printers = await prisma.printer.findMany();
    const currentTime = new Date();
    
    // Process printers in smaller batches with semaphore to limit concurrent connections
    const processPrinter = async (printer) => {
      try {
        // Skip disabled printers
        if (printer.status === "disabled") {
          console.log(`Skipping disabled printer ${printer.name}`);
          return {
            id: printer.id,
            updateData: {
              lastSeen: new Date()
            }
          };
        }

        let operationalStatus = "offline";
        let printStartTime: Date | undefined = undefined;
        let printTimeElapsed: number | undefined = undefined;
        let printTimeRemaining: number | undefined = undefined;
        let printImageUrl: string | undefined = undefined;
        let printJobName: string | undefined = undefined;
        let bedTemp: number | null = null;
        let toolTemp: number | null = null;
        
        // Acquire semaphore permit before making network requests
        await CONNECTION_SEMAPHORE.acquire();
        
        try {
          if (printer.type === "moonraker") {
            try {
              console.log(`Trying to connect to moonraker printer ${printer.name} at ${printer.apiUrl}`);
              
              // Increase timeout and add headers
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduce timeout to 5 seconds
              
              // First try to get printer objects
              let statusResponse;
              try {
                statusResponse = await fetch(`${printer.apiUrl}/printer/objects/query?print_stats&extruder&heater_bed&display_status`, { 
                  signal: controller.signal,
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                  },
                  // Add cache control to prevent stale responses
                  cache: 'no-store'
                });
                
                // Clear timeout if request succeeds
                clearTimeout(timeoutId);
                
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  console.log(`Status data for ${printer.name}:`, JSON.stringify(statusData));
                  
                  // Get temperature data first (available regardless of printing state)
                  if (statusData.result?.status?.heater_bed?.temperature !== undefined) {
                    bedTemp = Number(statusData.result.status.heater_bed.temperature);
                    console.log(`Bed temperature for ${printer.name}: ${bedTemp}°C`);
                  }
                  if (statusData.result?.status?.extruder?.temperature !== undefined) {
                    toolTemp = Number(statusData.result.status.extruder.temperature);
                    console.log(`Tool temperature for ${printer.name}: ${toolTemp}°C`);
                  }
                  
                  if (statusData.result?.status?.print_stats) {
                    const printStats = statusData.result.status.print_stats;
                    // Set operational status to online first, then check specific state
                    operationalStatus = "idle";
                    
                    if (printStats.state) {
                      operationalStatus = mapMoonrakerState(printStats.state);
                      console.log(`Found print_stats for ${printer.name}, raw state: ${printStats.state}, mapped state: ${operationalStatus}`);
                    }
                    
                    // Get print progress if printing
                    if (operationalStatus === "printing" && statusData.result?.status?.display_status) {
                      const displayStatus = statusData.result.status.display_status;
                      
                      if (printStats.start_time) {
                        printStartTime = new Date(printStats.start_time * 1000);
                      }
                      
                      if (printStats.print_duration !== undefined) {
                        printTimeElapsed = printStats.print_duration;
                      }
                      
                      if (displayStatus.progress > 0 && printTimeElapsed && printTimeElapsed > 0) {
                        printTimeRemaining = (printTimeElapsed / displayStatus.progress) - printTimeElapsed;
                      }
                    }

                    // Extract filename from print_stats in various formats, looking at multiple possible locations
                    if (statusData.result?.status) {
                      const status = statusData.result.status;
                      
                      // Try different paths for filename in Moonraker responses
                      if (status.print_stats?.filename) {
                        printJobName = status.print_stats.filename;
                        console.log(`Print job name from print_stats for ${printer.name}: ${printJobName}`);
                      } else if (status.display_status?.filename) {
                        printJobName = status.display_status.filename;
                        console.log(`Print job name from display_status for ${printer.name}: ${printJobName}`);
                      } else if (status.current_file?.filename) {
                        printJobName = status.current_file.filename;
                        console.log(`Print job name from current_file for ${printer.name}: ${printJobName}`);
                      } else if (status.job?.file?.name) {
                        printJobName = status.job.file.name;
                        console.log(`Print job name from job.file for ${printer.name}: ${printJobName}`);
                      } else if (status.filename) {
                        printJobName = status.filename;
                        console.log(`Print job name from direct filename for ${printer.name}: ${printJobName}`);
                      }
                      
                      // Clean up filename if needed - remove path prefixes
                      if (printJobName && printJobName.includes('/')) {
                        printJobName = printJobName.split('/').pop();
                        console.log(`Cleaned print job name for ${printer.name}: ${printJobName}`);
                      }
                    }
                  } else {
                    console.log(`No print_stats in response for ${printer.name}`);
                    operationalStatus = "idle"; // If we got a response but no print stats, printer is likely idle
                  }
                } else {
                  console.error(`HTTP error for ${printer.name}: ${statusResponse.status}`);
                  operationalStatus = "offline";
                }
              } catch (error) {
                console.log(`Failed to get printer objects for ${printer.name}: ${error.message}`);
                
                // Log explicitly if this was a timeout error  
                if (isTimeoutError(error)) {
                  console.error(`TIMEOUT detected when connecting to Moonraker printer ${printer.name}. This could be caused by other slow requests.`);
                }
                
                operationalStatus = "offline";
                clearTimeout(timeoutId);
              }
            } catch (error) {
              console.error(`Cannot connect to moonraker printer ${printer.name}:`, error);
              operationalStatus = "offline";
            }
          } else if (printer.type === "prusalink") {
            try {
              console.log(`Trying to connect to PrusaLink printer ${printer.name} at ${printer.apiUrl}`);
              
              // Get printer IP from API URL
              const printerIp = printer.apiUrl.replace(/^https?:\/\//, '').split(':')[0];
              console.log(`Extracted IP address for PrusaLink printer ${printer.name}: ${printerIp}`);
              
              // Check if this printer is in our offline backoff list
              const backoffInfo = offlinePrusaLinkPrinters.get(printer.id);
              if (backoffInfo && backoffInfo.until > currentTime) {
                console.log(`Skipping PrusaLink printer ${printer.name} - in backoff period until ${backoffInfo.until.toISOString()}`);
                operationalStatus = "offline";
                // Continue with the next printer
                return {
                  id: printer.id,
                  updateData: {
                    operationalStatus: "offline",
                    lastSeen: new Date(),
                    // Don't include printJobName since it's causing schema errors
                  }
                };
              }
              
              // Always use direct HTTP API - skip Python bridge entirely
              console.log(`Using direct HTTP API for PrusaLink printer ${printer.name}`);
              
              try {
                // First get the printer status
                const response = await fetch(`${printer.apiUrl}/api/printer`, {
                  headers: {
                    'X-Api-Key': printer.apiKey || '',
                    'Accept': 'application/json'
                  },
                  // Use a shorter timeout
                  signal: (new AbortController()).signal,
                  cache: 'no-store'
                });
                
                if (response.ok) {
                  const data = await response.json();
                  
                  if (data) {
                    // Mark as online first, then check specific state
                    operationalStatus = "idle";
                    
                    // Check if printer is printing
                    if (data.state && data.state.flags) {
                      if (data.state.flags.printing) {
                        operationalStatus = "printing";
                      } else if (data.state.flags.paused) {
                        operationalStatus = "paused";
                      } else if (data.state.flags.error) {
                        operationalStatus = "error";
                      }
                      console.log(`Operational status (new format) for ${printer.name}: ${data.state.text} → ${operationalStatus}`);
                    }
                    
                    // Get temperature data, first check newer PrusaLink data format
                    if (data.temperature && data.temperature.bed && data.temperature.bed.actual !== undefined) {
                      bedTemp = Number(data.temperature.bed.actual);
                      console.log(`Bed temperature (new format) for ${printer.name}: ${bedTemp}°C`);
                    } else if (data.telemetry && data.telemetry["temp-bed"] !== undefined) {
                      bedTemp = Number(data.telemetry["temp-bed"]);
                      console.log(`Bed temperature (telemetry) for ${printer.name}: ${bedTemp}°C`);
                    }
                    
                    if (data.temperature && data.temperature.tool0 && data.temperature.tool0.actual !== undefined) {
                      toolTemp = Number(data.temperature.tool0.actual);
                      console.log(`Tool temperature (new format) for ${printer.name}: ${toolTemp}°C`);
                    } else if (data.telemetry && data.telemetry["temp-nozzle"] !== undefined) {
                      toolTemp = Number(data.telemetry["temp-nozzle"]);
                      console.log(`Tool temperature (telemetry) for ${printer.name}: ${toolTemp}°C`);
                    }
                  } else {
                    console.log(`Invalid data structure from PrusaLink for ${printer.name}`);
                    operationalStatus = "error";
                  }

                  // Always fetch job data directly from the job endpoint
                  try {
                    console.log(`Fetching job data directly for ${printer.name}`);
                    const jobResponse = await fetch(`${printer.apiUrl}/api/job`, {
                      headers: {
                        'X-Api-Key': printer.apiKey || '',
                        'Accept': 'application/json'
                      },
                      // Use a shorter timeout
                      signal: (new AbortController()).signal,
                      cache: 'no-store'
                    });
                    if (jobResponse.ok) {
                      // Mark as online if we get job data - the printer is responding
                      operationalStatus = operationalStatus === "offline" ? "idle" : operationalStatus;
                      
                      const jobData = await jobResponse.json();
                      console.log(`Job data for ${printer.name}:`, JSON.stringify(jobData));
                      
                      // Check job state first to see if the printer is printing
                      if (jobData.state === "PRINTING" || jobData.state === "Printing") {
                        operationalStatus = "printing";
                        console.log(`Setting printer ${printer.name} to PRINTING status based on job state`);
                      }
                      
                      // Check for snake_case time fields at top level (PrusaLink)
                      if (jobData.time_printing !== undefined) {
                        printTimeElapsed = jobData.time_printing;
                        console.log(`Print time elapsed (snake_case) for ${printer.name}: ${printTimeElapsed}s`);
                      }
                      
                      if (jobData.time_remaining !== undefined) {
                        printTimeRemaining = jobData.time_remaining;
                        console.log(`Print time remaining (snake_case) for ${printer.name}: ${printTimeRemaining}s`);
                      }
                      
                      // Extract time from progress object if present (most common in PrusaLink responses)
                      if (jobData.progress) {
                        if (printTimeElapsed === undefined && jobData.progress.printTime !== undefined) {
                          printTimeElapsed = Number(jobData.progress.printTime);
                          console.log(`Print time elapsed from progress for ${printer.name}: ${printTimeElapsed}s`);
                        }
                        
                        if (printTimeRemaining === undefined && jobData.progress.printTimeLeft !== undefined) {
                          printTimeRemaining = Number(jobData.progress.printTimeLeft);
                          console.log(`Print time remaining from progress for ${printer.name}: ${printTimeRemaining}s`);
                        }
                      }
                      
                      // Get the job name from the file object (PrusaLink)
                      if (jobData.file) {
                        if (jobData.file.display_name) {
                          printJobName = jobData.file.display_name;
                        } else if (jobData.file.name) {
                          printJobName = jobData.file.name;
                        } else if (jobData.file.display) {
                          printJobName = jobData.file.display;
                        }
                        console.log(`Print job name for ${printer.name}: ${printJobName}`);
                      }
                      
                      // Also check job object for start time and thumbnail
                      if (jobData.job && typeof jobData.job === 'object') {
                        if (jobData.job.start_time) {
                          printStartTime = new Date(jobData.job.start_time);
                          console.log(`Print start time from job endpoint for ${printer.name}: ${printStartTime}`);
                        }
                        
                        if (jobData.job.thumbnail_url) {
                          printImageUrl = jobData.job.thumbnail_url;
                        }
                      }
                    } else {
                      console.log(`Failed to get job data for ${printer.name}: ${jobResponse.status}`);
                    }
                  } catch (jobError) {
                    console.error(`Error fetching job data for ${printer.name}:`, jobError);
                  }
                } else {
                  console.error(`HTTP error from PrusaLink for ${printer.name}: ${response.status}`);
                  operationalStatus = "offline";
                }
              } catch (apiError) {
                console.error(`Error connecting to PrusaLink API for ${printer.name}:`, apiError);
                operationalStatus = "offline";
              }
            } catch (error) {
              console.error(`Cannot connect to PrusaLink printer ${printer.name}:`, error);
              operationalStatus = "offline";
              
              // Add to backoff list
              offlinePrusaLinkPrinters.set(printer.id, {
                until: new Date(currentTime.getTime() + OFFLINE_BACKOFF_TIME_MS)
              });
              console.log(`Added ${printer.name} to PrusaLink backoff list until ${new Date(currentTime.getTime() + OFFLINE_BACKOFF_TIME_MS).toISOString()}`);
            }
          }

          // Create a printer update object
          const updateData: any = {
            operationalStatus,
            lastSeen: new Date(),
          };

          // Only include defined values in the update
          if (printStartTime !== undefined) updateData.printStartTime = printStartTime;
          if (printTimeElapsed !== undefined) updateData.printTimeElapsed = printTimeElapsed;
          if (printTimeRemaining !== undefined) updateData.printTimeRemaining = printTimeRemaining;
          if (printImageUrl !== undefined) updateData.printImageUrl = printImageUrl;
          
          // Only keep printJobName if printer is printing, otherwise clear it
          // Temporarily disabled due to schema mismatch
          // if (operationalStatus === 'printing') {
          //   if (printJobName !== undefined) {
          //     updateData.printJobName = printJobName;
          //     console.log(`Saving print job name for ${printer.name}: ${printJobName}`);
          //   }
          // } else {
          //   // Clear print job name when printer is not printing
          //   updateData.printJobName = null;
          //   console.log(`Clearing print job name for ${printer.name} (status: ${operationalStatus})`);
          // }
          
          // Log the print job name but don't add it to update data until schema is updated
          if (operationalStatus === 'printing') {
            if (printJobName !== undefined) {
              console.log(`Print job name for ${printer.name}: ${printJobName} (not saved due to schema mismatch)`);
            }
          } else {
            console.log(`Print job name cleared for ${printer.name} (status: ${operationalStatus})`);
          }
          
          if (bedTemp !== null) updateData.bedTemp = bedTemp;
          if (toolTemp !== null) updateData.toolTemp = toolTemp;

          console.log(`FINAL UPDATE DATA for ${printer.name}:`, JSON.stringify(updateData));

          // Return the update information
          return { 
            id: printer.id,
            updateData
          };
        } catch (error) {
          console.error(`Failed to update status for ${printer.name}:`, error);
          // Return offline status update
          return {
            id: printer.id,
            updateData: {
              operationalStatus: "offline",
              lastSeen: new Date(),
              bedTemp: null,
              toolTemp: null,
            }
          };
        } finally {
          // Release semaphore permit after processing the printer
          CONNECTION_SEMAPHORE.release();
        }
      } catch (error) {
        console.error(`Failed to process printer ${printer.name}:`, error);
        // Return offline status update
        return {
          id: printer.id,
          updateData: {
            operationalStatus: "offline",
            lastSeen: new Date(),
            bedTemp: null,
            toolTemp: null,
          }
        };
      }
    };

    // Update status for each printer in parallel
    const printerUpdatePromises = printers.map(async (printer) => {
      try {
        return await processPrinter(printer);
      } catch (error) {
        console.error(`Failed to update status for ${printer.name}:`, error);
        // Return offline status update
        return {
          id: printer.id,
          updateData: {
            operationalStatus: "offline",
            lastSeen: new Date(),
            bedTemp: null,
            toolTemp: null,
          }
        };
      }
    });
    
    // Wait for all printer updates to complete
    const printerUpdates = await Promise.all(printerUpdatePromises);
    
    // Create a database semaphore to limit concurrent DB operations
    const DB_SEMAPHORE = new Semaphore(3); // Max 3 concurrent DB operations
    
    // Apply updates to database - we limit parallel operations to avoid DB connection issues
    const dbUpdatePromises = [];
    
    for (const update of printerUpdates) {
      const updatePromise = (async () => {
        // Acquire DB semaphore
        await DB_SEMAPHORE.acquire();
        
        try {
          await prisma.printer.update({
            where: { id: update.id },
            data: update.updateData,
          });
          
          console.log(`Updated status for printer ID ${update.id}: ${update.updateData.operationalStatus}`);
        } catch (dbError) {
          console.error(`Database update error for printer ${update.id}:`, dbError);
        } finally {
          // Release DB semaphore
          DB_SEMAPHORE.release();
        }
      })();
      
      dbUpdatePromises.push(updatePromise);
    }
    
    // Wait for all DB updates to complete
    await Promise.allSettled(dbUpdatePromises);
    
    // Add a small delay to ensure connections are released
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch updated printers
    const updatedPrinters = await prisma.printer.findMany();
    
    // Ensure all printer data is complete and properly typed before returning
    const processedPrinters = updatedPrinters.map(printer => {
      // Basic printer object with data type conversions
      const processedPrinter = {
        ...printer,
        // Convert string values to numbers if they exist
        printTimeElapsed: printer.printTimeElapsed !== null ? Number(printer.printTimeElapsed) : null, 
        printTimeRemaining: printer.printTimeRemaining !== null ? Number(printer.printTimeRemaining) : null,
        bedTemp: printer.bedTemp !== null ? Number(printer.bedTemp) : null,
        toolTemp: printer.toolTemp !== null ? Number(printer.toolTemp) : null
      };

      // Make sure disabled printers have a clear operational status
      if (printer.status === 'disabled') {
        processedPrinter.operationalStatus = 'disabled';
      }
      
      // Ensure printing printers have the necessary time data
      if (processedPrinter.operationalStatus === 'printing') {
        // If missing time data, default to sensible values
        if (processedPrinter.printTimeElapsed === null) {
          processedPrinter.printTimeElapsed = 0;
        }
        if (processedPrinter.printTimeRemaining === null) {
          processedPrinter.printTimeRemaining = 0;
        }
      }
      
      return processedPrinter;
    });
    
    return NextResponse.json(processedPrinters);
  } catch (error) {
    console.error("Failed to update printer statuses:", error);
    return NextResponse.json({ error: "Failed to update printer statuses" }, { status: 500 });
  }
} 