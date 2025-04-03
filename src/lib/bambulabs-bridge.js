const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'bambulabs-bridge');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Check for the available Python executable
async function findPythonExecutable() {
  const possibleExecutables = ['python3', 'python', 'py'];
  
  for (const executable of possibleExecutables) {
    try {
      const process = spawn(executable, ['--version']);
      
      // Create a promise to get the result
      const result = await new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve(executable);
          } else {
            resolve(null);
          }
        });
        
        process.on('error', () => {
          resolve(null);
        });
      });
      
      if (result) {
        console.log(`Found Python executable: ${executable}`);
        return executable;
      }
    } catch (error) {
      // Ignore errors and try the next executable
    }
  }
  
  console.error('No Python executable found. Please install Python 3.');
  return null;
}

// Cache the Python executable
let pythonExecutable = null;

// Keep track of active Python processes
const activePythonProcesses = new Set();

// Clean up process on exit (prevents zombie processes)
function registerPythonProcess(process) {
  activePythonProcesses.add(process);
  
  // Auto-cleanup after process ends
  process.on('close', () => {
    activePythonProcesses.delete(process);
  });
  
  return process;
}

// Add a periodic cleaner
setInterval(() => {
  console.log(`[bambulabs-bridge] Active Python processes: ${activePythonProcesses.size}`);
  
  // Kill any processes that have been running for more than 30 seconds
  const now = Date.now();
  for (const process of activePythonProcesses) {
    if (process.startTime && (now - process.startTime) > 30000) {
      console.log(`[bambulabs-bridge] Killing long-running Python process (${Math.round((now - process.startTime)/1000)}s)`);
      try {
        process.kill();
        activePythonProcesses.delete(process);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }
  }
}, 10000); // Check every 10 seconds

/**
 * Connects to a Bambu Lab printer and tests the connection
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @param {number} timeout - Connection timeout in seconds
 * @returns {Promise<object>} - Result of the operation
 */
async function connectPrinter(printerIp, printerSerial, accessCode, timeout = 60) {
  // Find Python executable if we don't have it yet
  if (!pythonExecutable) {
    pythonExecutable = await findPythonExecutable();
    if (!pythonExecutable) {
      return Promise.reject({
        success: false,
        message: 'Python is not installed or not found in PATH. Please install Python 3.'
      });
    }
  }

  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `connect_${Date.now()}.py`);
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    import bambulabs_api
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "bambulabs_api not installed. Install with: pip install bambulabs_api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with access code {repr('${accessCode}'[:4] + '****')}", file=sys.stderr)
    print(f"DEBUG: Printer serial: {repr('${printerSerial}')}", file=sys.stderr)
    
    # Connect to printer with specified timeout
    printer = bambulabs_api.Printer(
        hostname="${printerIp}", 
        access="${accessCode}", 
        printer_serial="${printerSerial}",
        timeout=${timeout}
    )
    
    # Try to connect
    print(f"DEBUG: Connecting to printer", file=sys.stderr)
    printer.connect()
    
    # Check if connection works by getting printer state
    print(f"DEBUG: Getting printer state", file=sys.stderr)
    state = printer.get_state()
    print(f"DEBUG: Printer state: {state}", file=sys.stderr)
    
    # Get printer info
    temp_data = {}
    try:
        temp_data["bed_temp"] = printer.get_bed_temperature()
        temp_data["target_bed_temp"] = printer.get_bed_temperature()
        temp_data["nozzle_temp"] = printer.get_nozzle_temperature()
        temp_data["target_nozzle_temp"] = printer.get_nozzle_temperature()
        temp_data["print_progress"] = printer.get_percentage()
    except Exception as e:
        print(f"DEBUG: Error getting temperature data: {str(e)}", file=sys.stderr)
    
    # Disconnect
    printer.disconnect()
    
    # Return success response
    print(json.dumps({
        "success": True,
        "message": "Successfully connected to Bambu Lab printer",
        "data": {
            "state": state,
            "temps": temp_data
        }
    }))

except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    # Return detailed error response
    print(json.dumps({
        "success": False,
        "message": str(e),
        "error": str(e),
        "traceback": "\\n".join(traceback_details)
    }))
    sys.exit(1)
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const hardTimeout = setTimeout(() => {
      console.log('[bambulabs-bridge] Python process timeout exceeded, killing process');
      try {
        pythonProcess.kill();
        activePythonProcesses.delete(pythonProcess);
      } catch (err) {
        console.error('Error killing process:', err);
      }
      
      reject({
        success: false,
        message: `Connection to printer timed out after ${timeout} seconds`,
        error: 'Timeout'
      });
    }, timeout * 1000);
    
    // Collect data from the process
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      errorOutput += stderr;
      
      // Forward debug messages to console
      if (stderr.includes('DEBUG:')) {
        console.log(`[bambulabs-bridge] ${stderr.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(hardTimeout);
      
      try {
        // Try to clean up the temporary script
        fs.unlinkSync(scriptPath);
      } catch (err) {
        // Ignore errors on cleanup
      }
      
      if (code === 0) {
        // Try to parse the output as JSON
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('[bambulabs-bridge] Failed to parse output as JSON:', output);
          reject({
            success: false,
            message: 'Failed to parse response from Python script',
            error: 'Invalid JSON',
            output
          });
        }
      } else {
        console.error(`[bambulabs-bridge] Python process exited with code ${code}:`, errorOutput);
        
        // Try to extract a JSON error message
        let errorResult = null;
        try {
          // Check if output contains JSON
          const jsonStartIndex = output.indexOf('{');
          const jsonEndIndex = output.lastIndexOf('}');
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
            errorResult = JSON.parse(jsonString);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        if (errorResult) {
          reject(errorResult);
        } else {
          reject({
            success: false,
            message: 'Error executing Python script',
            error: errorOutput || 'Unknown error',
            code
          });
        }
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(hardTimeout);
      console.error('[bambulabs-bridge] Failed to start Python process:', error);
      reject({
        success: false,
        message: 'Failed to start Python process',
        error: error.message
      });
    });
  });
}

/**
 * Gets the status of a Bambu Lab printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @returns {Promise<object>} - Result of the operation with printer status
 */
async function getJobStatus(printerIp, printerSerial, accessCode) {
  // Find Python executable if we don't have it yet
  if (!pythonExecutable) {
    pythonExecutable = await findPythonExecutable();
    if (!pythonExecutable) {
      return Promise.reject({
        success: false,
        message: 'Python is not installed or not found in PATH. Please install Python 3.'
      });
    }
  }

  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `status_${Date.now()}.py`);
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    import bambulabs_api
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "bambulabs_api not installed. Install with: pip install bambulabs_api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with access code {repr('${accessCode}'[:4] + '****')}", file=sys.stderr)
    print(f"DEBUG: Printer serial: {repr('${printerSerial}')}", file=sys.stderr)
    
    # Connect to printer
    printer = bambulabs_api.Printer(
        hostname="${printerIp}", 
        access="${accessCode}", 
        printer_serial="${printerSerial}"
    )
    
    # Try to connect
    print(f"DEBUG: Connecting to printer", file=sys.stderr)
    printer.connect()
    
    # Get printer state
    print(f"DEBUG: Getting printer state", file=sys.stderr)
    state = printer.get_state()
    print(f"DEBUG: Printer state: {state}", file=sys.stderr)
    
    # Get additional status information
    bed_temp = printer.get_bed_temperature() 
    nozzle_temp = printer.get_nozzle_temperature()
    progress = printer.get_percentage()
    remaining_time = printer.get_time()
    current_file = printer.get_file_name() if state == "printing" else None
    
    # Convert to printer status
    status = "idle"
    if state == "printing":
        status = "printing"
    elif state == "paused":
        status = "paused"
    elif state == "offline" or state == "unknown":
        status = "offline"
    
    # Disconnect
    printer.disconnect()
    
    # Return success response
    print(json.dumps({
        "success": True,
        "message": "Successfully retrieved Bambu Lab printer status",
        "data": {
            "printer": {
                "state": {
                    "text": status
                },
                "temperature": {
                    "bed": bed_temp,
                    "tool0": nozzle_temp
                },
                "progress": progress if progress is not None else 0,
                "timeRemaining": remaining_time if remaining_time is not None else 0,
                "currentFile": current_file
            }
        }
    }))

except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    # Return detailed error response
    print(json.dumps({
        "success": False,
        "message": str(e),
        "error": str(e),
        "traceback": "\\n".join(traceback_details)
    }))
    sys.exit(1)
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Collect data from the process
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      errorOutput += stderr;
      
      // Forward debug messages to console
      if (stderr.includes('DEBUG:')) {
        console.log(`[bambulabs-bridge] ${stderr.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      try {
        // Try to clean up the temporary script
        fs.unlinkSync(scriptPath);
      } catch (err) {
        // Ignore errors on cleanup
      }
      
      if (code === 0) {
        // Try to parse the output as JSON
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('[bambulabs-bridge] Failed to parse output as JSON:', output);
          reject({
            success: false,
            message: 'Failed to parse response from Python script',
            error: 'Invalid JSON',
            output
          });
        }
      } else {
        console.error(`[bambulabs-bridge] Python process exited with code ${code}:`, errorOutput);
        
        // Try to extract a JSON error message
        let errorResult = null;
        try {
          // Check if output contains JSON
          const jsonStartIndex = output.indexOf('{');
          const jsonEndIndex = output.lastIndexOf('}');
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
            errorResult = JSON.parse(jsonString);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        if (errorResult) {
          reject(errorResult);
        } else {
          reject({
            success: false,
            message: 'Error executing Python script',
            error: errorOutput || 'Unknown error',
            code
          });
        }
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[bambulabs-bridge] Failed to start Python process:', error);
      reject({
        success: false,
        message: 'Failed to start Python process',
        error: error.message
      });
    });
  });
}

/**
 * Uploads a file to a Bambu Lab printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @param {string} filePath - Path to the file to upload
 * @param {boolean} printAfterUpload - Whether to start printing after upload
 * @returns {Promise<object>} - Result of the operation
 */
async function uploadAndPrint(printerIp, printerSerial, accessCode, filePath, printAfterUpload = false) {
  // Find Python executable if we don't have it yet
  if (!pythonExecutable) {
    pythonExecutable = await findPythonExecutable();
    if (!pythonExecutable) {
      return Promise.reject({
        success: false,
        message: 'Python is not installed or not found in PATH. Please install Python 3.'
      });
    }
  }

  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `upload_${Date.now()}.py`);
    
    // Get file name from path
    const fileName = path.basename(filePath);
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    import bambulabs_api
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "bambulabs_api not installed. Install with: pip install bambulabs_api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with access code {repr('${accessCode}'[:4] + '****')}", file=sys.stderr)
    print(f"DEBUG: Printer serial: {repr('${printerSerial}')}", file=sys.stderr)
    print(f"DEBUG: File path: {repr('${filePath.replace(/\\/g, '\\\\')}')}", file=sys.stderr)
    
    # Verify file exists
    file_path = "${filePath.replace(/\\/g, '\\\\')}"
    if not os.path.exists(file_path):
        print(json.dumps({
            "success": False,
            "message": f"File not found: {file_path}",
            "error": "File not found on disk"
        }))
        sys.exit(1)
    
    # Connect to printer
    printer = bambulabs_api.Printer(
        hostname="${printerIp}", 
        access="${accessCode}", 
        printer_serial="${printerSerial}"
    )
    
    # Try to connect
    print(f"DEBUG: Connecting to printer", file=sys.stderr)
    printer.connect()
    
    # Upload the file
    print(f"DEBUG: Uploading file", file=sys.stderr)
    with open(file_path, "rb") as f:
        file_data = f.read()
        uploaded_file = printer.upload_file(f, "${fileName}")
    
    print(f"DEBUG: File uploaded as: {uploaded_file}", file=sys.stderr)
    
    # Start printing if requested
    if ${printAfterUpload}:
        print(f"DEBUG: Starting print", file=sys.stderr)
        # Assuming this is how to start a print with the uploaded file
        success = printer.start_print(uploaded_file, 1)  # plate_number=1 by default
        print(f"DEBUG: Print started: {success}", file=sys.stderr)
    
    # Disconnect
    printer.disconnect()
    
    # Return success response
    print(json.dumps({
        "success": True,
        "message": "File successfully uploaded" + (" and print started" if ${printAfterUpload} else ""),
        "data": {
            "path": uploaded_file
        }
    }))

except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    # Return detailed error response
    print(json.dumps({
        "success": False,
        "message": str(e),
        "error": str(e),
        "traceback": "\\n".join(traceback_details)
    }))
    sys.exit(1)
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Collect data from the process
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      errorOutput += stderr;
      
      // Forward debug messages to console
      if (stderr.includes('DEBUG:')) {
        console.log(`[bambulabs-bridge] ${stderr.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      try {
        // Try to clean up the temporary script
        fs.unlinkSync(scriptPath);
      } catch (err) {
        // Ignore errors on cleanup
      }
      
      if (code === 0) {
        // Try to parse the output as JSON
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('[bambulabs-bridge] Failed to parse output as JSON:', output);
          reject({
            success: false,
            message: 'Failed to parse response from Python script',
            error: 'Invalid JSON',
            output
          });
        }
      } else {
        console.error(`[bambulabs-bridge] Python process exited with code ${code}:`, errorOutput);
        
        // Try to extract a JSON error message
        let errorResult = null;
        try {
          // Check if output contains JSON
          const jsonStartIndex = output.indexOf('{');
          const jsonEndIndex = output.lastIndexOf('}');
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
            errorResult = JSON.parse(jsonString);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        if (errorResult) {
          reject(errorResult);
        } else {
          reject({
            success: false,
            message: 'Error executing Python script',
            error: errorOutput || 'Unknown error',
            code
          });
        }
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[bambulabs-bridge] Failed to start Python process:', error);
      reject({
        success: false,
        message: 'Failed to start Python process',
        error: error.message
      });
    });
  });
}

/**
 * Stops a print on a Bambu Lab printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} printerSerial - Serial number of the printer
 * @param {string} accessCode - Access code for the printer
 * @returns {Promise<object>} - Result of the operation
 */
async function stopPrint(printerIp, printerSerial, accessCode) {
  // Find Python executable if we don't have it yet
  if (!pythonExecutable) {
    pythonExecutable = await findPythonExecutable();
    if (!pythonExecutable) {
      return Promise.reject({
        success: false,
        message: 'Python is not installed or not found in PATH. Please install Python 3.'
      });
    }
  }

  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `stop_${Date.now()}.py`);
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    import bambulabs_api
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "bambulabs_api not installed. Install with: pip install bambulabs_api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with access code {repr('${accessCode}'[:4] + '****')}", file=sys.stderr)
    print(f"DEBUG: Printer serial: {repr('${printerSerial}')}", file=sys.stderr)
    
    # Connect to printer
    printer = bambulabs_api.Printer(
        hostname="${printerIp}", 
        access="${accessCode}", 
        printer_serial="${printerSerial}"
    )
    
    # Try to connect
    print(f"DEBUG: Connecting to printer", file=sys.stderr)
    printer.connect()
    
    # Stop the print
    print(f"DEBUG: Stopping print", file=sys.stderr)
    success = printer.stop_print()
    print(f"DEBUG: Print stopped: {success}", file=sys.stderr)
    
    # Disconnect
    printer.disconnect()
    
    # Return success response
    print(json.dumps({
        "success": success,
        "message": "Print stopped successfully" if success else "Failed to stop print"
    }))

except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    # Return detailed error response
    print(json.dumps({
        "success": False,
        "message": str(e),
        "error": str(e),
        "traceback": "\\n".join(traceback_details)
    }))
    sys.exit(1)
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Collect data from the process
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const stderr = data.toString();
      errorOutput += stderr;
      
      // Forward debug messages to console
      if (stderr.includes('DEBUG:')) {
        console.log(`[bambulabs-bridge] ${stderr.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      try {
        // Try to clean up the temporary script
        fs.unlinkSync(scriptPath);
      } catch (err) {
        // Ignore errors on cleanup
      }
      
      if (code === 0) {
        // Try to parse the output as JSON
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('[bambulabs-bridge] Failed to parse output as JSON:', output);
          reject({
            success: false,
            message: 'Failed to parse response from Python script',
            error: 'Invalid JSON',
            output
          });
        }
      } else {
        console.error(`[bambulabs-bridge] Python process exited with code ${code}:`, errorOutput);
        
        // Try to extract a JSON error message
        let errorResult = null;
        try {
          // Check if output contains JSON
          const jsonStartIndex = output.indexOf('{');
          const jsonEndIndex = output.lastIndexOf('}');
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
            errorResult = JSON.parse(jsonString);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        if (errorResult) {
          reject(errorResult);
        } else {
          reject({
            success: false,
            message: 'Error executing Python script',
            error: errorOutput || 'Unknown error',
            code
          });
        }
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[bambulabs-bridge] Failed to start Python process:', error);
      reject({
        success: false,
        message: 'Failed to start Python process',
        error: error.message
      });
    });
  });
}

// Export the functions
module.exports = {
  connectPrinter,
  getJobStatus,
  uploadAndPrint,
  stopPrint
}; 