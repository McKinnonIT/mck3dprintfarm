/**
 * Direct PrusaLinkPy Implementation
 * This bridge directly calls the Python script that uses PrusaLinkPy library
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find a working Python executable
function findPython() {
  const pythonCommands = ['python3', 'python', 'py'];
  
  for (const cmd of pythonCommands) {
    try {
      const result = require('child_process').spawnSync(cmd, ['-c', 'print("test")']);
      if (result.status === 0) {
        console.log(`Found Python executable: ${cmd}`);
        return cmd;
      }
    } catch (error) {
      console.log(`Command ${cmd} not found`);
    }
  }
  
  throw new Error('No Python executable found');
}

// Call the Python script with arguments
async function callPythonScript(args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'prusalink-direct.py');
    
    // Ensure the script exists and is executable
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python script not found at ${scriptPath}`));
    }
    
    try {
      const pythonCmd = findPython();
      console.log(`Executing: ${pythonCmd} ${scriptPath} ${args.join(' ')}`);
      
      const process = spawn(pythonCmd, [scriptPath, ...args], {
        timeout: 600000  // 10 minute timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python script output: ${error.message}\nOutput: ${stdout}`));
          }
        } else {
          reject(new Error(`Python script exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    } catch (error) {
      reject(new Error(`Error calling Python script: ${error.message}`));
    }
  });
}

// Get job status from printer (includes print times, temperatures, etc.)
async function getJobStatus(printerIp, apiKey) {
  console.log(`[DEBUG] Getting job status for ${printerIp} using direct Python script`);
  
  try {
    const result = await callPythonScript(['status', printerIp, apiKey]);
    
    // Return a standardized format
    if (result.success) {
      console.log(`[DEBUG] Successfully got status from ${printerIp}`);
      
      // Extract the time data and temperatures
      const data = result.data;
      const status = {
        success: true,
        data: {
          printer: data.printer || {},
          telemetry: data.telemetry || {},
          status: data.status || {},
          raw_endpoints: data.raw_endpoints || {}
        }
      };
      
      // Log detailed time information
      if (data.status && data.status.print_time_elapsed !== undefined) {
        console.log(`[DEBUG] Print time elapsed: ${data.status.print_time_elapsed}s`);
      }
      
      if (data.status && data.status.print_time_remaining !== undefined) {
        console.log(`[DEBUG] Print time remaining: ${data.status.print_time_remaining}s`);
      }
      
      return status;
    } else {
      console.error(`[ERROR] Failed to get status from ${printerIp}: ${result.message}`);
      return {
        success: false,
        message: result.message,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`[ERROR] Exception getting status: ${error.message}`);
    return {
      success: false,
      message: "Failed to get printer status",
      error: error.message
    };
  }
}

// Upload file to printer
async function uploadFileToPrinter(printerIp, apiKey, filePath, remotePath, printAfterUpload = false) {
  console.log(`[DEBUG] Uploading file to ${printerIp} using direct Python script`);
  
  try {
    const args = [
      'upload',
      printerIp,
      apiKey,
      '--file', filePath,
      '--remote', remotePath
    ];
    
    if (printAfterUpload) {
      args.push('--print-after');
    }
    
    const result = await callPythonScript(args);
    
    if (result.success) {
      console.log(`[DEBUG] Successfully uploaded file to ${printerIp}`);
      return {
        success: true,
        message: result.message
      };
    } else {
      console.error(`[ERROR] Failed to upload file to ${printerIp}: ${result.message}`);
      return {
        success: false,
        message: result.message,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`[ERROR] Exception uploading file: ${error.message}`);
    return {
      success: false,
      message: "Failed to upload file",
      error: error.message
    };
  }
}

// Start print job
async function startPrintJob(printerIp, apiKey, filePath) {
  console.log(`[DEBUG] Starting print job on ${printerIp} using direct Python script`);
  
  try {
    const result = await callPythonScript([
      'print',
      printerIp,
      apiKey,
      '--file', filePath
    ]);
    
    if (result.success) {
      console.log(`[DEBUG] Successfully started print on ${printerIp}`);
      return {
        success: true,
        message: result.message
      };
    } else {
      console.error(`[ERROR] Failed to start print on ${printerIp}: ${result.message}`);
      return {
        success: false,
        message: result.message,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`[ERROR] Exception starting print: ${error.message}`);
    return {
      success: false,
      message: "Failed to start print",
      error: error.message
    };
  }
}

// Stop print job
async function stopPrintJob(printerIp, apiKey) {
  console.log(`[DEBUG] Stopping print job on ${printerIp} using direct Python script`);
  
  try {
    const result = await callPythonScript(['stop', printerIp, apiKey]);
    
    if (result.success) {
      console.log(`[DEBUG] Successfully stopped print on ${printerIp}`);
      return {
        success: true,
        message: result.message
      };
    } else {
      console.error(`[ERROR] Failed to stop print on ${printerIp}: ${result.message}`);
      return {
        success: false,
        message: result.message,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`[ERROR] Exception stopping print: ${error.message}`);
    return {
      success: false,
      message: "Failed to stop print",
      error: error.message
    };
  }
}

// Test connection to printer
async function testConnection(printerIp, apiKey) {
  console.log(`[DEBUG] Testing connection to ${printerIp} using direct Python script`);
  
  try {
    const result = await callPythonScript(['connect', printerIp, apiKey]);
    
    return {
      success: result.success,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    console.error(`[ERROR] Exception testing connection: ${error.message}`);
    return {
      success: false,
      message: "Failed to connect to printer",
      error: error.message
    };
  }
}

// Export all functions
module.exports = {
  getJobStatus,
  uploadFileToPrinter,
  startPrintJob,
  stopPrintJob,
  testConnection
}; 