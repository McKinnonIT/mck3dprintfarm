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

// Add mapping function for Bambu Lab states (if needed)
const mapBambuLabState = (state: string): string => {
  switch (state.toLowerCase()) {
    case 'printing':
      return 'printing';
    case 'idle':
      return 'idle';
    case 'paused':
      return 'paused';
    case 'error':
      return 'error';
    case 'offline':
      return 'offline';
    default:
      return 'idle';
  }
};

export class PrinterService {
  private baseUrl: string;
  private apiKey?: string;
  private type: "prusalink" | "moonraker" | "bambulab";
  private serialNumber?: string;

  constructor(baseUrl: string, type: "prusalink" | "moonraker" | "bambulab", apiKey?: string, serialNumber?: string) {
    this.baseUrl = baseUrl;
    this.type = type;
    this.apiKey = apiKey;
    this.serialNumber = serialNumber;
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
      } else if (this.type === "bambulab") {
        // Bambu Lab API - use bambulabs-bridge.js
        try {
          console.log(`Connecting to Bambu Lab printer at ${this.baseUrl}`);
          
          // Use the bambulabs-bridge.js for getting status
          const bambuBridge = require('../bambulabs-bridge');
          const statusResult = await bambuBridge.getJobStatus(
            this.baseUrl, 
            this.serialNumber, 
            this.apiKey
          );
          
          console.log(`Bambu Lab status result:`, statusResult?.success);
          
          if (statusResult?.success) {
            // Extract data from the response
            const data = statusResult.data;
            const state = data.printer?.state?.text || 'idle';
            const bedTemp = data.printer?.temperature?.bed || 0;
            const toolTemp = data.printer?.temperature?.tool0 || 0;
            const progress = data.printer?.progress || 0;
            
            return {
              status: state,
              temperature: {
                bed: bedTemp,
                tool0: toolTemp
              },
              progress: progress
            };
          }
          
          return { status: "offline" };
        } catch (error) {
          console.error("Error connecting to Bambu Lab printer:", error);
          return { status: "offline" };
        }
      } else {
        // Moonraker API - use moonraker-bridge-py.js
        try {
          console.log(`Connecting to moonraker at ${this.baseUrl}`);
          
          // Use the moonraker-bridge-py.js for getting status
          const moonrakerBridge = require('../moonraker-bridge-py');
          const statusResult = await moonrakerBridge.getJobStatus(this.baseUrl, this.apiKey);
          
          console.log(`Moonraker status result:`, statusResult?.success);
          
          if (statusResult?.success) {
            // Extract data from the response
            const data = statusResult.data;
            const state = data.printer?.state?.text || 'idle';
            const bedTemp = data.printer?.temperature?.bed || 0;
            const toolTemp = data.printer?.temperature?.tool0 || 0;
            const progress = data.printer?.progress || 0;
            
            return {
              status: state,
              temperature: {
                bed: bedTemp,
                tool0: toolTemp
              },
              progress: progress
            };
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
    console.log(`Starting print on ${this.type} printer for file ${fileUrl}`);
    try {
      if (this.type === "prusalink") {
        const response = await axios.post(
          `${this.baseUrl}/api/files/local/${fileUrl}`,
          { command: "select", print: true },
          { headers: this.headers }
        );
        console.log(`PrusaLink print start response:`, response.status);
        return true;
      } else if (this.type === "bambulab") {
        // Use bambulabs-bridge.js
        const bambuBridge = require('../bambulabs-bridge');
        console.log(`Using bambulabs-bridge to start print for ${fileUrl}`);
        
        try {
          const result = await bambuBridge.uploadAndPrint(
            this.baseUrl,
            this.serialNumber,
            this.apiKey,
            fileUrl,
            true // printAfterUpload = true
          );
          
          if (result.success) {
            console.log(`Print start successful: ${result.message}`);
            return true;
          } else {
            console.error(`Failed to start print: ${result.message}`);
            throw new Error(result.message);
          }
        } catch (error) {
          console.error(`Error from bambulabs-bridge:`, error);
          throw error;
        }
      } else {
        // Use moonraker-bridge-py.js
        const moonrakerBridge = require('../moonraker-bridge-py');
        console.log(`Using moonraker-bridge-py to start print for ${fileUrl}`);
        
        try {
          const result = await moonrakerBridge.startExistingPrint(this.baseUrl, this.apiKey, fileUrl);
          
          if (result.success) {
            console.log(`Print start successful: ${result.message}`);
            return true;
          } else {
            console.error(`Failed to start print: ${result.message}`);
            throw new Error(result.message);
          }
        } catch (error) {
          console.error(`Error from moonraker-bridge:`, error);
          throw error;
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
      } else if (this.type === "bambulab") {
        // Use bambulabs-bridge.js
        const bambuBridge = require('../bambulabs-bridge');
        console.log(`Using bambulabs-bridge to stop print`);
        
        try {
          const result = await bambuBridge.stopPrint(
            this.baseUrl,
            this.serialNumber,
            this.apiKey
          );
          
          if (result.success) {
            console.log(`Print stop successful: ${result.message}`);
            return true;
          } else {
            console.error(`Failed to stop print: ${result.message}`);
            throw new Error(result.message);
          }
        } catch (error) {
          console.error(`Error from bambulabs-bridge:`, error);
          throw error;
        }
      } else {
        // Use moonraker-bridge-py.js
        const moonrakerBridge = require('../moonraker-bridge-py');
        console.log(`Using moonraker-bridge-py to cancel print`);
        
        try {
          const result = await moonrakerBridge.cancelPrint(this.baseUrl, this.apiKey);
          
          if (result.success) {
            console.log(`Print cancel successful: ${result.message}`);
            return true;
          } else {
            console.error(`Failed to cancel print: ${result.message}`);
            throw new Error(result.message);
          }
        } catch (error) {
          console.error(`Error from moonraker-bridge:`, error);
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error stopping print:`, error);
      return false;
    }
  }
} 