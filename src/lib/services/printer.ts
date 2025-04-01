import axios from "axios";

interface PrinterStatus {
  status: string;
  temperature?: {
    bed?: number;
    tool0?: number;
  };
  progress?: number;
}

// Add mapping function for PrusaLink states
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

export class PrinterService {
  private baseUrl: string;
  private apiKey?: string;
  private type: "prusalink" | "moonraker";

  constructor(baseUrl: string, type: "prusalink" | "moonraker", apiKey?: string) {
    this.baseUrl = baseUrl;
    this.type = type;
    this.apiKey = apiKey;
  }

  private get headers() {
    if (this.type === "prusalink" && this.apiKey) {
      return {
        "X-Api-Key": this.apiKey,
      };
    }
    return {};
  }

  async getStatus(): Promise<PrinterStatus> {
    try {
      if (this.type === "prusalink") {
        try {
          console.log(`[Detail] Connecting to PrusaLink at ${this.baseUrl}`);
          
          // Use a timeout to avoid hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Try different API endpoints based on PrusaLink version
          let response;
          try {
            // First try the most basic endpoint that should always work
            response = await axios.get(`${this.baseUrl}/api/version`, {
              headers: this.headers,
              signal: controller.signal,
              timeout: 5000
            });
            console.log(`[Detail] PrusaLink version API succeeded:`, response.data);
            
            // Now try the actual printer status endpoint
            try {
              const printerResponse = await axios.get(`${this.baseUrl}/api/printer`, {
                headers: this.headers,
                timeout: 5000
              });
              
              console.log(`[Detail] PrusaLink printer API succeeded:`, printerResponse.data);
              
              // Clear timeout since we got a response
              clearTimeout(timeoutId);
              
              // Parse response data
              if (printerResponse.data && printerResponse.data.printer) {
                const printerData = printerResponse.data.printer;
                
                // Map the state to a standardized value
                const rawStatus = printerData.state?.text?.toLowerCase() || "idle";
                const status = mapPrusaLinkState(rawStatus);
                
                // Construct full status response
                return {
                  status,
                  temperature: {
                    bed: printerData.temp_bed,
                    tool0: printerData.temp_nozzle,
                  },
                  progress: printerData.progress || 0,
                };
              } else if (printerResponse.data && printerResponse.data.state) {
                // Handle the actual response format we're getting
                console.log(`[Detail] Using alternate PrusaLink response format`);
                
                const rawStatus = printerResponse.data.state.text.toLowerCase();
                const status = mapPrusaLinkState(rawStatus);
                
                const bedTemp = printerResponse.data.temperature?.bed?.actual || 
                                printerResponse.data.telemetry?.["temp-bed"];
                const toolTemp = printerResponse.data.temperature?.tool0?.actual || 
                                 printerResponse.data.telemetry?.["temp-nozzle"];
                const progress = printerResponse.data.telemetry?.progress || 0;
                
                return {
                  status,
                  temperature: {
                    bed: bedTemp,
                    tool0: toolTemp
                  },
                  progress: progress
                };
              } else {
                console.error("[Detail] Invalid response structure from PrusaLink printer API", printerResponse.data);
                return { status: "error" };
              }
            } catch (printerError) {
              console.error(`[Detail] PrusaLink printer API error:`, printerError);
              return { status: "error" };
            }
          } catch (versionError) {
            console.log(`[Detail] PrusaLink version API failed:`, versionError.message);
            
            // If the version check fails, try the printer endpoint directly
            try {
              const fallbackResponse = await axios.get(`${this.baseUrl}/api/printer`, {
                headers: this.headers,
                signal: controller.signal,
                timeout: 5000
              });
              
              // Clear timeout since we got a response
              clearTimeout(timeoutId);
              
              console.log(`[Detail] PrusaLink fallback printer API succeeded:`, fallbackResponse.data);
              
              if (fallbackResponse.data && fallbackResponse.data.printer) {
                const printerData = fallbackResponse.data.printer;
                
                // Map the state to a standardized value
                const rawStatus = printerData.state?.text?.toLowerCase() || "idle";
                const status = mapPrusaLinkState(rawStatus);
                
                return {
                  status,
                  temperature: {
                    bed: printerData.temp_bed,
                    tool0: printerData.temp_nozzle,
                  },
                  progress: printerData.progress || 0,
                };
              } else if (fallbackResponse.data && fallbackResponse.data.state) {
                // Handle alternate response format in fallback
                console.log(`[Detail] Using alternate PrusaLink response format in fallback`);
                
                const rawStatus = fallbackResponse.data.state.text.toLowerCase();
                const status = mapPrusaLinkState(rawStatus);
                
                const bedTemp = fallbackResponse.data.temperature?.bed?.actual || 
                                fallbackResponse.data.telemetry?.["temp-bed"];
                const toolTemp = fallbackResponse.data.temperature?.tool0?.actual || 
                                 fallbackResponse.data.telemetry?.["temp-nozzle"];
                const progress = fallbackResponse.data.telemetry?.progress || 0;
                
                return {
                  status,
                  temperature: {
                    bed: bedTemp,
                    tool0: toolTemp
                  },
                  progress: progress
                };
              } else {
                console.error("[Detail] Invalid response structure from PrusaLink fallback API", fallbackResponse.data);
                return { status: "offline" };
              }
            } catch (fallbackError) {
              console.error(`[Detail] PrusaLink fallback API error:`, fallbackError);
              clearTimeout(timeoutId);
              return { status: "offline" };
            }
          }
        } catch (error) {
          console.error("[Detail] Critical error connecting to PrusaLink:", error);
          return { status: "offline" };
        }
      } else {
        // Moonraker API - first fetch basic printer info
        try {
          console.log(`Connecting to moonraker at ${this.baseUrl}`);
          
          // Use a timeout to avoid hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Try multiple API endpoint formats for server info
          let response;
          try {
            response = await axios.get(`${this.baseUrl}/api/server/info`, {
              signal: controller.signal
            });
          } catch (firstError) {
            console.log(`First API format failed: ${firstError.message}`);
            try {
              response = await axios.get(`${this.baseUrl}/server/info`, {
                signal: controller.signal
              });
            } catch (secondError) {
              console.log(`Second API format failed: ${secondError.message}`);
              throw new Error("Failed to connect to printer");
            }
          }
          
          clearTimeout(timeoutId);
          
          console.log(`Connected to printer at ${this.baseUrl}`);
          
          if (response.data) {
            // Then fetch object status for more details
            try {
              let objectsResponse;
              try {
                objectsResponse = await axios.get(
                  `${this.baseUrl}/api/printer/objects/query?print_stats&extruder&heater_bed&display_status`
                );
              } catch (error) {
                console.log(`First objects query failed: ${error.message}`);
                try {
                  objectsResponse = await axios.get(
                    `${this.baseUrl}/printer/objects/query?print_stats&extruder&heater_bed&display_status`
                  );
                } catch (error) {
                  console.log(`Second objects query failed: ${error.message}`);
                  // If all object queries fail, try basic status endpoint
                  try {
                    objectsResponse = await axios.get(`${this.baseUrl}/api/printer/status`);
                  } catch (error) {
                    console.log(`Basic status query failed: ${error.message}`);
                    throw new Error("Failed to get printer status");
                  }
                }
              }
              
              const objectsData = objectsResponse.data;
              
              // Parse temperatures if available
              let bedTemp, toolTemp, progress;
              if (objectsData?.result?.status?.heater_bed) {
                bedTemp = objectsData.result.status.heater_bed.temperature;
              }
              if (objectsData?.result?.status?.extruder) {
                toolTemp = objectsData.result.status.extruder.temperature;
              }
              if (objectsData?.result?.status?.display_status) {
                progress = objectsData.result.status.display_status.progress * 100;
              }
              
              // Get printer state
              let state = "idle";
              if (objectsData?.result?.status?.print_stats) {
                state = objectsData.result.status.print_stats.state.toLowerCase();
                if (state === "ready") state = "idle";
              }
              
              console.log(`Printer state: ${state}, temp: bed=${bedTemp}, tool=${toolTemp}, progress=${progress}`);
              
              return {
                status: state,
                temperature: {
                  bed: bedTemp,
                  tool0: toolTemp
                },
                progress: progress
              };
            } catch (objectsError) {
              // If we can't get detailed status, return basic info
              console.log(`Error getting printer objects: ${objectsError.message}`);
              return {
                status: "idle", // Basic "on" status
                temperature: {
                  bed: 0,
                  tool0: 0
                },
                progress: 0
              };
            }
          }
          
          return { status: "offline" };
        } catch (error) {
          console.error("Error connecting to Moonraker:", error);
          return { status: "offline" };
        }
      }
    } catch (error) {
      console.error("Error fetching printer status:", error);
      return { status: "offline" };
    }
  }

  async startPrint(fileUrl: string): Promise<boolean> {
    console.log(`Starting print on ${this.type} printer with file: ${fileUrl}`);
    try {
      if (this.type === "prusalink") {
        const response = await axios.post(
          `${this.baseUrl}/api/print`,
          { command: "start", path: fileUrl },
          { headers: this.headers }
        );
        console.log(`PrusaLink print start response:`, response.status);
        return true;
      } else {
        // Moonraker API - try multiple endpoint formats
        try {
          console.log(`Attempting to start print via ${this.baseUrl}/api/printer/print/start`);
          const response = await axios.post(`${this.baseUrl}/api/printer/print/start`, {
            filename: fileUrl,
          });
          console.log(`Print start response:`, response.status);
          return true;
        } catch (error) {
          console.log(`First endpoint failed: ${error.message}, trying alternative`);
          try {
            const response = await axios.post(`${this.baseUrl}/printer/print/start`, {
              filename: fileUrl,
            });
            console.log(`Print start response (alternative endpoint):`, response.status);
            return true;
          } catch (error) {
            console.error(`Failed to start print: ${error.message}`);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`Error starting print:`, error);
      return false;
    }
  }

  async stopPrint(): Promise<boolean> {
    console.log(`Stopping print on ${this.type} printer`);
    try {
      if (this.type === "prusalink") {
        const response = await axios.post(
          `${this.baseUrl}/api/print`,
          { command: "stop" },
          { headers: this.headers }
        );
        console.log(`PrusaLink print stop response:`, response.status);
        return true;
      } else {
        // Moonraker API - try multiple endpoint formats
        try {
          console.log(`Attempting to stop print via ${this.baseUrl}/api/printer/print/cancel`);
          const response = await axios.post(`${this.baseUrl}/api/printer/print/cancel`);
          console.log(`Print stop response:`, response.status);
          return true;
        } catch (error) {
          console.log(`First endpoint failed: ${error.message}, trying alternative`);
          try {
            const response = await axios.post(`${this.baseUrl}/printer/print/cancel`);
            console.log(`Print stop response (alternative endpoint):`, response.status);
            return true;
          } catch (error) {
            console.error(`Failed to stop print: ${error.message}`);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`Error stopping print:`, error);
      return false;
    }
  }
} 