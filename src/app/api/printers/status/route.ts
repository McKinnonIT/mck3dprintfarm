import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const prusaLinkBridge = require("@/lib/prusalink-bridge");

// Keep track of offline PrusaLink printers with a backoff mechanism
const offlinePrusaLinkPrinters = new Map<string, { until: Date }>();
const OFFLINE_BACKOFF_TIME_MS = 2 * 60 * 1000; // 2 minutes backoff

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
    
    // Update status for each printer in parallel
    const printerUpdatePromises = printers.map(async (printer) => {
      try {
        let operationalStatus = "offline";
        let printStartTime: Date | undefined = undefined;
        let printTimeElapsed: number | undefined = undefined;
        let printTimeRemaining: number | undefined = undefined;
        let printImageUrl: string | undefined = undefined;
        let bedTemp: number | null = null;
        let toolTemp: number | null = null;
        
        if (printer.type === "moonraker") {
          try {
            console.log(`Trying to connect to moonraker printer ${printer.name} at ${printer.apiUrl}`);
            
            // Increase timeout and add headers
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Increase timeout to 10 seconds
            
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
                  bedTemp: null,
                  toolTemp: null,
                }
              };
            } else if (backoffInfo) {
              // Backoff period expired, remove from backoff list
              console.log(`Backoff period expired for ${printer.name}, attempting to connect again`);
              offlinePrusaLinkPrinters.delete(printer.id);
            }
            
            // Declare useFallbackHttp variable
            let useFallbackHttp = false;
            
            // Use prusaLinkPy bridge for more reliable status info
            try {
              console.log(`Using PrusaLinkPy bridge to get status for ${printer.name}`);
              
              // Add explicit timeout for PrusaLinkPy requests
              const prusaLinkPyPromise = prusaLinkBridge.getJobStatus(printerIp, printer.apiKey);
              
              // Create a timeout promise
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('PrusaLinkPy request timed out')), 8000);
              });
              
              // Race the actual request against the timeout
              const jobStatusResult = await Promise.race([prusaLinkPyPromise, timeoutPromise])
                .catch(error => {
                  console.error(`PrusaLinkPy request timed out for ${printer.name}`);
                  return { success: false, message: 'Request timed out', error: 'Timeout' };
                });
                
              console.log(`PrusaLinkPy job status result for ${printer.name}:`, JSON.stringify(jobStatusResult));
              
              if (jobStatusResult.success) {
                const { data } = jobStatusResult;
                
                // Map printer state
                if (data.printer?.state?.text) {
                  const rawStatus = data.printer.state.text.toLowerCase();
                  operationalStatus = mapPrusaLinkState(rawStatus);
                  console.log(`Operational status for ${printer.name}: ${rawStatus} → ${operationalStatus}`);
                }
                
                // Set temperature values if available
                if (data.printer?.temp_bed !== undefined) {
                  bedTemp = Number(data.printer.temp_bed);
                  console.log(`Bed temperature for ${printer.name}: ${bedTemp}°C`);
                }
                
                if (data.printer?.temp_nozzle !== undefined) {
                  toolTemp = Number(data.printer.temp_nozzle);
                  console.log(`Tool temperature for ${printer.name}: ${toolTemp}°C`);
                }
                
                // Get time data from status result
                if (data.status?.print_time_elapsed !== undefined) {
                  printTimeElapsed = data.status.print_time_elapsed;
                  console.log(`Print time elapsed for ${printer.name}: ${printTimeElapsed}s`);
                } else {
                  console.log(`No print time elapsed data available for ${printer.name}`);
                }
                
                if (data.status?.print_time_remaining !== undefined) {
                  printTimeRemaining = data.status.print_time_remaining;
                  console.log(`Print time remaining for ${printer.name}: ${printTimeRemaining}s`);
                } else {
                  console.log(`No print time remaining data available for ${printer.name}`);
                }
                
                // Get print start time
                if (data.status?.print_start_time) {
                  printStartTime = new Date(data.status.print_start_time * 1000);
                  console.log(`Print start time for ${printer.name}: ${printStartTime}`);
                }
                
                console.log(`[DEBUG] Complete status data for ${printer.name}:`, JSON.stringify(data.status));
              } else {
                console.log(`Failed to get PrusaLinkPy status for ${printer.name}: ${jobStatusResult.message}`);
                // Fall back to HTTP API approach
                useFallbackHttp = true;
              }
            } catch (bridgeError) {
              console.error(`PrusaLinkPy bridge error for ${printer.name}:`, bridgeError);
              // Fall back to HTTP API approach
              useFallbackHttp = true;
            }
            
            // Use the HTTP API as a fallback
            if (useFallbackHttp) {
              console.log(`Falling back to HTTP API for ${printer.name}`);
              
              // Use timeout for PrusaLink too
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              
              const response = await fetch(`${printer.apiUrl}/api/printer`, {
                headers: {
                  'X-Api-Key': printer.apiKey || '',
                  'Accept': 'application/json'
                },
                signal: controller.signal,
                cache: 'no-store'
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                console.log(`PrusaLink status data for ${printer.name}:`, JSON.stringify(data));
                
                if (data.printer && data.printer.state && data.printer.state.text) {
                  // Original response format
                  const rawStatus = data.printer.state.text.toLowerCase();
                  operationalStatus = mapPrusaLinkState(rawStatus);
                  console.log(`Operational status for ${printer.name}: ${rawStatus} → ${operationalStatus}`);
                  
                  // Set temperature values if available
                  if (data.printer.temp_bed !== undefined) {
                    bedTemp = Number(data.printer.temp_bed);
                    console.log(`Bed temperature for ${printer.name}: ${bedTemp}°C`);
                  }
                  if (data.printer.temp_nozzle !== undefined) {
                    toolTemp = Number(data.printer.temp_nozzle);
                    console.log(`Tool temperature for ${printer.name}: ${toolTemp}°C`);
                  }
                } else if (data.state && data.state.text) {
                  // New format as seen in logs
                  const rawStatus = data.state.text.toLowerCase();
                  operationalStatus = mapPrusaLinkState(rawStatus);
                  console.log(`Operational status (new format) for ${printer.name}: ${rawStatus} → ${operationalStatus}`);
                  
                  // Extract temperatures from the new format
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
  
                // Get print progress if printing and we don't have time values from PrusaLinkPy
                if (operationalStatus === "printing" && printTimeElapsed === undefined) {
                  try {
                    const jobResponse = await fetch(`${printer.apiUrl}/api/job`, {
                      headers: {
                        'X-Api-Key': printer.apiKey || '',
                        'Accept': 'application/json'
                      },
                      cache: 'no-store'
                    });
                    if (jobResponse.ok) {
                      const jobData = await jobResponse.json();
                      console.log(`Job data for ${printer.name}:`, JSON.stringify(jobData));
                      
                      // Extract the time data from various possible locations
                      if (jobData.progress && typeof jobData.progress === 'object') {
                        if (jobData.progress.printTime !== undefined) {
                          printTimeElapsed = jobData.progress.printTime;
                          console.log(`Print time elapsed from progress for ${printer.name}: ${printTimeElapsed}s`);
                        }
                        
                        if (jobData.progress.printTimeLeft !== undefined) {
                          printTimeRemaining = jobData.progress.printTimeLeft;
                          console.log(`Print time remaining from progress for ${printer.name}: ${printTimeRemaining}s`);
                        }
                      }
                      
                      // Also check in job object
                      if (jobData.job && typeof jobData.job === 'object') {
                        if (jobData.job.start_time) {
                          printStartTime = new Date(jobData.job.start_time);
                        }
                        
                        if (printTimeElapsed === undefined && jobData.job.print_time !== undefined) {
                          printTimeElapsed = jobData.job.print_time;
                          console.log(`Print time elapsed from job object for ${printer.name}: ${printTimeElapsed}s`);
                        }
                        
                        if (printTimeRemaining === undefined && jobData.job.print_time_remaining !== undefined) {
                          printTimeRemaining = jobData.job.print_time_remaining;
                          console.log(`Print time remaining from job object for ${printer.name}: ${printTimeRemaining}s`);
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
                }
              } else {
                console.error(`HTTP error from PrusaLink for ${printer.name}: ${response.status}`);
                operationalStatus = "offline";
              }
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
        if (bedTemp !== null) updateData.bedTemp = bedTemp;
        if (toolTemp !== null) updateData.toolTemp = toolTemp;

        console.log(`[DEBUG] Updating printer ${printer.name} in database with:`, JSON.stringify({
          operationalStatus,
          printStartTime: printStartTime?.toISOString(),
          printTimeElapsed,
          printTimeRemaining,
          bedTemp,
          toolTemp
        }));

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
      }
    });
    
    // Wait for all printer updates to complete
    const printerUpdates = await Promise.all(printerUpdatePromises);
    
    // Apply updates to database - we do this sequentially to avoid database connection issues
    for (const update of printerUpdates) {
      await prisma.printer.update({
        where: { id: update.id },
        data: update.updateData,
      });
      
      console.log(`Updated status for printer ID ${update.id}: ${update.updateData.operationalStatus}`);
    }
    
    // Fetch updated printers
    const updatedPrinters = await prisma.printer.findMany();
    
    // Removed webcam URL validation to avoid incorrectly marking valid URLs as invalid
    
    return NextResponse.json(updatedPrinters);
  } catch (error) {
    console.error("Failed to update printer statuses:", error);
    return NextResponse.json({ error: "Failed to update printer statuses" }, { status: 500 });
  }
} 