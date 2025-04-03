const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'moonraker-bridge');
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
  console.log(`[moonraker-bridge] Active Python processes: ${activePythonProcesses.size}`);
  
  // Kill any processes that have been running for more than 30 seconds
  const now = Date.now();
  for (const process of activePythonProcesses) {
    if (process.startTime && (now - process.startTime) > 30000) {
      console.log(`[moonraker-bridge] Killing long-running Python process (${Math.round((now - process.startTime)/1000)}s)`);
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
 * Uploads a file to a Moonraker printer and optionally starts printing
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @param {string} filePath - Path to the file to upload
 * @param {string} remoteName - Name to use for the file on the printer
 * @param {boolean} printAfterUpload - Whether to start printing after upload
 * @returns {Promise<object>} - Result of the operation
 */
async function uploadAndPrint(printerUrl, apiKey, filePath, remoteName = '', printAfterUpload = false) {
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
    
    // If no remote name is provided, use the original filename
    if (!remoteName) {
      remoteName = path.basename(filePath);
    }
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
import asyncio
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    from moonraker_api import MoonrakerClient
    from moonraker_api.file import FileManager
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "moonraker-api not installed. Install with: pip install moonraker-api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

async def main():
    try:
        print(f"DEBUG: Starting connection to Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        print(f"DEBUG: File path: {repr('${filePath.replace(/\\/g, '\\\\')}')}", file=sys.stderr)
        print(f"DEBUG: Remote path: {repr('${remoteName}')}", file=sys.stderr)
        
        # Parse the URL to get host, port, and API path
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        host = parsed_url.netloc
        if ':' not in host:
            # Add default port if not specified
            host = f"{host}:7125"
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Check if connection works by getting server info
        print(f"DEBUG: Testing connection with server.info", file=sys.stderr)
        server_info = await client.server.info()
        print(f"DEBUG: Server info: {server_info}", file=sys.stderr)
        
        # Get the file manager
        file_manager = client.file
        
        # Verify local file exists
        file_path = "${filePath.replace(/\\/g, '\\\\')}"
        if not os.path.exists(file_path):
            print(json.dumps({
                "success": False,
                "message": f"File not found: {file_path}",
                "error": "File not found on disk"
            }))
            sys.exit(1)
        
        # Upload the file
        print(f"DEBUG: Uploading file", file=sys.stderr)
        remote_path = "gcodes/${remoteName}"
        
        # Read the file
        with open(file_path, "rb") as f:
            file_data = f.read()
            
        upload_result = await file_manager.upload(file_path=file_path, file_name="${remoteName}", directory="gcodes")
        print(f"DEBUG: Upload result: {upload_result}", file=sys.stderr)
        
        # Start printing if requested
        if ${printAfterUpload}:
            print(f"DEBUG: Starting print for file: {remote_path}", file=sys.stderr)
            print_result = await client.printer.print_start(filename="${remoteName}")
            print(f"DEBUG: Print start result: {print_result}", file=sys.stderr)
            
            return {
                "success": True,
                "message": "File uploaded and print started successfully",
                "data": {
                    "path": remote_path,
                    "upload_result": upload_result,
                    "print_result": print_result
                }
            }
        
        # Return success response
        return {
            "success": True,
            "message": "File successfully uploaded",
            "data": {
                "path": remote_path,
                "upload_result": upload_result
            }
        }
    except Exception as e:
        # Get full traceback
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        # Return detailed error response
        return {
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\\n".join(traceback_details)
        }

# Run the async function and print the result
if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result))
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[moonraker-bridge] Python process timeout after 30 seconds');
      try {
        pythonProcess.kill();
      } catch (e) {
        console.error('Error killing Python process:', e);
      }
      
      resolve({
        success: false,
        message: 'Connection to Moonraker timed out after 30 seconds'
      });
    }, 30000);
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      // Log debug messages to console
      if (text.includes('DEBUG:')) {
        console.log(`[moonraker-bridge] ${text.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.warn(`[moonraker-bridge] Could not delete temporary file: ${error.message}`);
      }
      
      if (code !== 0) {
        console.error(`[moonraker-bridge] Python process exited with code ${code}`);
        console.error(`[moonraker-bridge] Error output: ${errorOutput}`);
        
        // Try to parse error from output first
        try {
          const result = JSON.parse(output);
          if (!result.success) {
            resolve(result);
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
        
        resolve({
          success: false,
          message: errorOutput || `Process exited with code ${code}`,
          error: errorOutput
        });
        return;
      }
      
      // Try to parse the JSON output
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        console.error(`[moonraker-bridge] Error parsing output: ${error.message}`);
        console.error(`[moonraker-bridge] Raw output: ${output}`);
        
        resolve({
          success: false,
          message: `Failed to parse response: ${error.message}`,
          error: error.message,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-bridge] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

/**
 * Tests connection to a Moonraker printer
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @returns {Promise<object>} - Result of the test
 */
async function testConnection(printerUrl, apiKey) {
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
    const scriptPath = path.join(TEMP_DIR, `test_${Date.now()}.py`);
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
import asyncio
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    from moonraker_api import MoonrakerClient
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "moonraker-api not installed. Install with: pip install moonraker-api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json

async def main():
    try:
        print(f"DEBUG: Testing connection to Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host, port, and API path
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        host = parsed_url.netloc
        if ':' not in host:
            # Add default port if not specified
            host = f"{host}:7125"
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Get server info
        server_info = await client.server.info()
        print(f"DEBUG: Server info: {server_info}", file=sys.stderr)
        
        # Get printer info
        printer_info = await client.printer.info()
        print(f"DEBUG: Printer info: {printer_info}", file=sys.stderr)
        
        # Return success response
        return {
            "success": True,
            "message": "Successfully connected to Moonraker",
            "data": {
                "server_info": server_info,
                "printer_info": printer_info
            }
        }
    except Exception as e:
        # Get full traceback
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        # Return detailed error response
        return {
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\\n".join(traceback_details)
        }

# Run the async function and print the result
if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result))
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[moonraker-bridge] Python process timeout after 10 seconds');
      try {
        pythonProcess.kill();
      } catch (e) {
        console.error('Error killing Python process:', e);
      }
      
      resolve({
        success: false,
        message: 'Connection to Moonraker timed out after 10 seconds'
      });
    }, 10000);
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      // Log debug messages to console
      if (text.includes('DEBUG:')) {
        console.log(`[moonraker-bridge] ${text.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.warn(`[moonraker-bridge] Could not delete temporary file: ${error.message}`);
      }
      
      if (code !== 0) {
        console.error(`[moonraker-bridge] Python process exited with code ${code}`);
        console.error(`[moonraker-bridge] Error output: ${errorOutput}`);
        
        // Try to parse error from output first
        try {
          const result = JSON.parse(output);
          if (!result.success) {
            resolve(result);
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
        
        resolve({
          success: false,
          message: errorOutput || `Process exited with code ${code}`,
          error: errorOutput
        });
        return;
      }
      
      // Try to parse the JSON output
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        console.error(`[moonraker-bridge] Error parsing output: ${error.message}`);
        console.error(`[moonraker-bridge] Raw output: ${output}`);
        
        resolve({
          success: false,
          message: `Failed to parse response: ${error.message}`,
          error: error.message,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-bridge] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

/**
 * Gets job status from a Moonraker printer
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @returns {Promise<object>} - Current job status
 */
async function getJobStatus(printerUrl, apiKey) {
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
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
import asyncio
from datetime import datetime
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    from moonraker_api import MoonrakerClient
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "moonraker-api not installed. Install with: pip install moonraker-api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json

async def main():
    try:
        print(f"DEBUG: Getting status from Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host, port, and API path
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        host = parsed_url.netloc
        if ':' not in host:
            # Add default port if not specified
            host = f"{host}:7125"
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Get printer objects (including print_stats, extruder, heater_bed)
        objects_query = ["print_stats", "extruder", "heater_bed", "display_status"]
        printer_objects = await client.printer.objects_query(objects_query)
        print(f"DEBUG: Printer objects: {printer_objects}", file=sys.stderr)
        
        # Extract status information
        status_data = printer_objects.get("status", {})
        
        # Get print_stats data
        print_stats = status_data.get("print_stats", {})
        
        # Determine printer state
        state = print_stats.get("state", "").lower()
        if state == "ready":
            state = "idle"
            
        # Get temperature data
        bed_temp = status_data.get("heater_bed", {}).get("temperature", 0)
        bed_target = status_data.get("heater_bed", {}).get("target", 0)
        
        tool_temp = status_data.get("extruder", {}).get("temperature", 0)
        tool_target = status_data.get("extruder", {}).get("target", 0)
        
        # Get progress data
        progress = 0
        if state == "printing":
            # Calculate progress
            if "progress" in print_stats:
                progress = print_stats.get("progress", 0)
            elif "display_status" in status_data:
                progress = status_data.get("display_status", {}).get("progress", 0)
        
        # Get time data
        print_time_elapsed = print_stats.get("print_duration", None)
        estimated_time = None
        print_time_remaining = None
        
        # Try to calculate remaining time
        if print_time_elapsed is not None and progress > 0 and progress < 1:
            # Estimate total time based on elapsed time and progress
            estimated_time = print_time_elapsed / progress
            # Calculate remaining time
            print_time_remaining = estimated_time - print_time_elapsed
        
        # Get filename
        filename = print_stats.get("filename", "")
        
        # Create response structure
        job_data = {}
        if state == "printing" or state == "paused":
            job_data = {
                "filename": filename,
                "progress": progress,
                "print_time_elapsed": print_time_elapsed,
                "print_time_remaining": print_time_remaining
            }
        
        # Return success response
        return {
            "success": True,
            "message": "Status retrieved successfully",
            "data": {
                "printer": {
                    "state": {
                        "text": state
                    },
                    "temperature": {
                        "bed": bed_temp,
                        "bed_target": bed_target,
                        "tool0": tool_temp,
                        "tool0_target": tool_target
                    },
                    "progress": progress
                },
                "job": job_data,
                "raw_data": printer_objects,
                "status": {
                    "is_printing": state == "printing",
                    "progress": progress,
                    "print_time_elapsed": print_time_elapsed,
                    "print_time_remaining": print_time_remaining
                }
            }
        }
    except Exception as e:
        # Get full traceback
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        # Return detailed error response
        return {
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\\n".join(traceback_details)
        }

# Run the async function and print the result
if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result))
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[moonraker-bridge] Python process timeout after 10 seconds');
      try {
        pythonProcess.kill();
      } catch (e) {
        console.error('Error killing Python process:', e);
      }
      
      resolve({
        success: false,
        message: 'Connection to Moonraker timed out after 10 seconds'
      });
    }, 10000);
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      // Log debug messages to console
      if (text.includes('DEBUG:')) {
        console.log(`[moonraker-bridge] ${text.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.warn(`[moonraker-bridge] Could not delete temporary file: ${error.message}`);
      }
      
      if (code !== 0) {
        console.error(`[moonraker-bridge] Python process exited with code ${code}`);
        console.error(`[moonraker-bridge] Error output: ${errorOutput}`);
        
        // Try to parse error from output first
        try {
          const result = JSON.parse(output);
          if (!result.success) {
            resolve(result);
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
        
        resolve({
          success: false,
          message: errorOutput || `Process exited with code ${code}`,
          error: errorOutput
        });
        return;
      }
      
      // Try to parse the JSON output
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        console.error(`[moonraker-bridge] Error parsing output: ${error.message}`);
        console.error(`[moonraker-bridge] Raw output: ${output}`);
        
        resolve({
          success: false,
          message: `Failed to parse response: ${error.message}`,
          error: error.message,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-bridge] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

/**
 * Starts printing a file that already exists on the printer
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @param {string} fileName - Name of the file to print
 * @returns {Promise<object>} - Result of the operation
 */
async function startExistingPrint(printerUrl, apiKey, fileName) {
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
    const scriptPath = path.join(TEMP_DIR, `start_print_${Date.now()}.py`);
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
import asyncio
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    from moonraker_api import MoonrakerClient
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "moonraker-api not installed. Install with: pip install moonraker-api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json

async def main():
    try:
        print(f"DEBUG: Starting print job for file {repr('${fileName}')} on Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host, port, and API path
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        host = parsed_url.netloc
        if ':' not in host:
            # Add default port if not specified
            host = f"{host}:7125"
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Start the print job
        print_result = await client.printer.print_start(filename="${fileName}")
        print(f"DEBUG: Print start result: {print_result}", file=sys.stderr)
        
        # Return success response
        return {
            "success": True,
            "message": "Print job started successfully",
            "data": {
                "file": "${fileName}",
                "print_result": print_result
            }
        }
    except Exception as e:
        # Get full traceback
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        # Return detailed error response
        return {
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\\n".join(traceback_details)
        }

# Run the async function and print the result
if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result))
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[moonraker-bridge] Python process timeout after 10 seconds');
      try {
        pythonProcess.kill();
      } catch (e) {
        console.error('Error killing Python process:', e);
      }
      
      resolve({
        success: false,
        message: 'Connection to Moonraker timed out after 10 seconds'
      });
    }, 10000);
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      // Log debug messages to console
      if (text.includes('DEBUG:')) {
        console.log(`[moonraker-bridge] ${text.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.warn(`[moonraker-bridge] Could not delete temporary file: ${error.message}`);
      }
      
      if (code !== 0) {
        console.error(`[moonraker-bridge] Python process exited with code ${code}`);
        console.error(`[moonraker-bridge] Error output: ${errorOutput}`);
        
        // Try to parse error from output first
        try {
          const result = JSON.parse(output);
          if (!result.success) {
            resolve(result);
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
        
        resolve({
          success: false,
          message: errorOutput || `Process exited with code ${code}`,
          error: errorOutput
        });
        return;
      }
      
      // Try to parse the JSON output
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        console.error(`[moonraker-bridge] Error parsing output: ${error.message}`);
        console.error(`[moonraker-bridge] Raw output: ${output}`);
        
        resolve({
          success: false,
          message: `Failed to parse response: ${error.message}`,
          error: error.message,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-bridge] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

/**
 * Cancels an active print job
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @returns {Promise<object>} - Result of the operation
 */
async function cancelPrint(printerUrl, apiKey) {
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
    const scriptPath = path.join(TEMP_DIR, `cancel_print_${Date.now()}.py`);
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
import asyncio
try:
    # Set a shorter socket timeout to handle offline printers quickly
    socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations
    
    from moonraker_api import MoonrakerClient
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "moonraker-api not installed. Install with: pip install moonraker-api",
        "error": "Module not found"
    }))
    sys.exit(1)

import json

async def main():
    try:
        print(f"DEBUG: Cancelling print job on Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host, port, and API path
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        host = parsed_url.netloc
        if ':' not in host:
            # Add default port if not specified
            host = f"{host}:7125"
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Cancel the print job
        cancel_result = await client.printer.print_cancel()
        print(f"DEBUG: Print cancel result: {cancel_result}", file=sys.stderr)
        
        # Return success response
        return {
            "success": True,
            "message": "Print job cancelled successfully",
            "data": {
                "cancel_result": cancel_result
            }
        }
    except Exception as e:
        # Get full traceback
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        # Return detailed error response
        return {
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\\n".join(traceback_details)
        }

# Run the async function and print the result
if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result))
`;
    
    // Write the script to a file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [scriptPath]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[moonraker-bridge] Python process timeout after 10 seconds');
      try {
        pythonProcess.kill();
      } catch (e) {
        console.error('Error killing Python process:', e);
      }
      
      resolve({
        success: false,
        message: 'Connection to Moonraker timed out after 10 seconds'
      });
    }, 10000);
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      // Log debug messages to console
      if (text.includes('DEBUG:')) {
        console.log(`[moonraker-bridge] ${text.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.warn(`[moonraker-bridge] Could not delete temporary file: ${error.message}`);
      }
      
      if (code !== 0) {
        console.error(`[moonraker-bridge] Python process exited with code ${code}`);
        console.error(`[moonraker-bridge] Error output: ${errorOutput}`);
        
        // Try to parse error from output first
        try {
          const result = JSON.parse(output);
          if (!result.success) {
            resolve(result);
            return;
          }
        } catch (e) {
          // If parsing fails, fall through to generic error
        }
        
        resolve({
          success: false,
          message: errorOutput || `Process exited with code ${code}`,
          error: errorOutput
        });
        return;
      }
      
      // Try to parse the JSON output
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        console.error(`[moonraker-bridge] Error parsing output: ${error.message}`);
        console.error(`[moonraker-bridge] Raw output: ${output}`);
        
        resolve({
          success: false,
          message: `Failed to parse response: ${error.message}`,
          error: error.message,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-bridge] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

module.exports = {
  uploadAndPrint,
  testConnection,
  getJobStatus,
  startExistingPrint,
  cancelPrint
}; 