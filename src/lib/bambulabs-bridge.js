/**
 * Direct HTTP API client for Bambu Lab printers
 * No Python dependencies required
 */

const https = require('https');
const http = require('http');
const fetch = require('node-fetch');

/**
 * Creates basic auth credentials for Bambu Lab printers
 * @param {string} accessCode - The printer access code 
 * @returns {string} - Base64 encoded credentials
 */
function createBasicAuthCredentials(accessCode) {
  const credentials = `bblp:${accessCode}`;
  return Buffer.from(credentials).toString('base64');
}

/**
 * Connects to a Bambu Lab printer and gets basic status
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer (optional)
 * @param {string} accessCode - Access code for the printer
 * @param {number} timeout - Connection timeout in seconds
 * @returns {Promise<object>} - Result of the operation
 */
async function connectPrinter(printerIp, printerSerial, accessCode, timeout = 10) {
  try {
    console.log(`[bambu-api] Connecting to printer at ${printerIp}`);
    
    // Create a controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
    
    // Use node-fetch to connect to the Bambu Lab API
    const response = await fetch(`http://${printerIp}:8888/api/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${createBasicAuthCredentials(accessCode)}`,
        'Accept': 'application/json',
      },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    // Now fetch status info
    const statusResponse = await fetch(`http://${printerIp}:8888/api/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${createBasicAuthCredentials(accessCode)}`,
        'Accept': 'application/json',
      }
    });
    
    let status = {};
    if (statusResponse.ok) {
      status = await statusResponse.json();
    }
    
    return {
      success: true,
      message: "Successfully connected to Bambu Lab printer",
      data: {
        info: data,
        state: status.status ? status.status.state : "unknown",
        temps: {
          bed_temp: parseFloat(status.status?.temperature?.bed_temperature || 0),
          target_bed_temp: parseFloat(status.status?.temperature?.bed_target || 0),
          nozzle_temp: parseFloat(status.status?.temperature?.nozzle_temperature || 0),
          target_nozzle_temp: parseFloat(status.status?.temperature?.nozzle_target || 0),
          print_progress: parseFloat(status.status?.progress || 0) * 100
        }
      }
    };
  } catch (error) {
    console.error(`[bambu-api] Connection error:`, error.message);
    return {
        success: false,
      message: `Failed to connect to printer: ${error.message}`,
        error: error.message
    };
  }
}

/**
 * Gets job status from a Bambu Lab printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer (optional)
 * @param {string} accessCode - Access code for the printer
 * @returns {Promise<object>} - Result of the operation
 */
async function getJobStatus(printerIp, printerSerial, accessCode) {
  try {
    console.log(`[bambu-api] Getting job status from printer at ${printerIp}`);
    
    // Fetch printer status
    const statusResponse = await fetch(`http://${printerIp}:8888/api/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${createBasicAuthCredentials(accessCode)}`,
        'Accept': 'application/json',
      }
    });
    
    if (!statusResponse.ok) {
      throw new Error(`HTTP error ${statusResponse.status}: ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    
    // Fetch print job info if available
    const printResponse = await fetch(`http://${printerIp}:8888/api/print`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${createBasicAuthCredentials(accessCode)}`,
        'Accept': 'application/json',
      }
    });
    
    let printData = {};
    if (printResponse.ok) {
      printData = await printResponse.json();
    }
    
    // Extract the most important data
    const result = {
      status: statusData.status || {},
      print: printData.print || {},
      state: "unknown",
      temps: {
        bed_temp: 0,
        target_bed_temp: 0,
        nozzle_temp: 0,
        target_nozzle_temp: 0
      },
      job: {
        progress: 0,
        fileName: "",
        printTimeRemaining: 0,
        printTimeElapsed: 0
      }
    };
    
    // Extract state
    if (statusData.status && statusData.status.state) {
      result.state = statusData.status.state;
    }
    
    // Extract temperatures
    if (statusData.status && statusData.status.temperature) {
      result.temps.bed_temp = parseFloat(statusData.status.temperature.bed_temperature || 0);
      result.temps.target_bed_temp = parseFloat(statusData.status.temperature.bed_target || 0);
      result.temps.nozzle_temp = parseFloat(statusData.status.temperature.nozzle_temperature || 0);
      result.temps.target_nozzle_temp = parseFloat(statusData.status.temperature.nozzle_target || 0);
    }
    
    // Extract job data
    if (statusData.status) {
      result.job.progress = parseFloat(statusData.status.progress || 0) * 100;
      result.job.fileName = statusData.status.gcode_file || "";
      
      // Calculate times
      const totalTime = parseFloat(statusData.status.total_time_used || 0);
      const remainingTime = parseFloat(statusData.status.remaining_time || 0);
      
      result.job.printTimeElapsed = totalTime;
      result.job.printTimeRemaining = remainingTime;
    }
    
    return {
      success: true,
      message: "Successfully retrieved job status",
      data: result
    };
  } catch (error) {
    console.error(`[bambu-api] Error getting job status:`, error.message);
    return {
        success: false,
      message: `Failed to get job status: ${error.message}`,
        error: error.message
    };
  }
}

/**
 * Uploads a file to a Bambu Lab printer and optionally starts printing
 * Note: File upload requires the AMS (LAN File Transfer) feature of Bambu Lab Cloud
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @param {string} filePath - Path to the file to upload
 * @param {boolean} printAfterUpload - Whether to start printing after upload
 * @returns {Promise<object>} - Result of the operation
 */
async function uploadAndPrint(printerIp, printerSerial, accessCode, filePath, printAfterUpload = false) {
  return {
        success: false,
    message: "File upload to Bambu Lab printers requires the AMS feature and is not supported via HTTP API",
    error: "Not supported via HTTP API"
  };
}

/**
 * Stops a print job on a Bambu Lab printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @returns {Promise<object>} - Result of the operation
 */
async function stopPrint(printerIp, printerSerial, accessCode) {
  try {
    console.log(`[bambu-api] Stopping print on printer at ${printerIp}`);
    
    // Send command to stop print
    const response = await fetch(`http://${printerIp}:8888/api/print/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${createBasicAuthCredentials(accessCode)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: "stop"
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: "Successfully stopped print job",
      data: data
    };
        } catch (error) {
    console.error(`[bambu-api] Error stopping print:`, error.message);
    return {
            success: false,
      message: `Failed to stop print: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Gets active process count (compatibility function)
 */
function getActiveProcessCount() {
  return 0;
}

// Export the functions
module.exports = {
  connectPrinter,
  getJobStatus,
  uploadAndPrint,
  stopPrint,
  getActiveProcessCount
}; 