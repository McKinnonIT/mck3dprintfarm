const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'moonraker-bridge');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Cache the Python executable
let pythonExecutable = process.env.DOCKER_ENV ? '/app/venv/bin/python' : 'python3';

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
  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `upload_${Date.now()}.py`);
    
    // If no remote name is provided, use the original filename
    if (!remoteName) {
      remoteName = path.basename(filePath);
    }
    
    // Add timestamp to filename to avoid conflicts with existing files
    const timestamp = Date.now();
    const origName = remoteName;
    const parts = remoteName.split('.');
    if (parts.length > 1) {
      // Insert timestamp before extension
      const ext = parts.pop();
      remoteName = `${parts.join('.')}_${timestamp}.${ext}`;
    } else {
      // No extension, just append timestamp
      remoteName = `${remoteName}_${timestamp}`;
    }
    
    console.log(`[moonraker-bridge] Adding timestamp to prevent filename conflicts: "${origName}" -> "${remoteName}"`);
    
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    // Create Python script content
    const pythonScript = `
#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import asyncio
import os
import urllib.parse

# Set a shorter socket timeout to handle offline printers quickly
socket.setdefaulttimeout(5)  # Increased from 3 to 5 seconds

# Use pre-installed packages if available, otherwise try to import or install
try:
    # Try importing directly first
    from moonraker_api import MoonrakerClient, MoonrakerListener
    import requests
    import aiohttp
    print("Using pre-installed packages", file=sys.stderr)
except ImportError:
    print("Some packages are missing, will try to import or install them", file=sys.stderr)
    
    # Check if required packages are installed and install them if needed
    required_packages = ['moonraker-api', 'requests', 'aiohttp']
    missing_packages = []

    for package in required_packages:
        try:
            if package == 'moonraker-api':
                from moonraker_api import MoonrakerClient, MoonrakerListener
                print(f"Successfully imported {package}", file=sys.stderr)
            elif package == 'requests':
                import requests
                print(f"Successfully imported {package}", file=sys.stderr)
            elif package == 'aiohttp':
                import aiohttp
                print(f"Successfully imported {package}", file=sys.stderr)
        except ImportError:
            missing_packages.append(package)

    # Install missing packages
    if missing_packages:
        print(f"Packages not found: {', '.join(missing_packages)}, trying to install...", file=sys.stderr)
        import subprocess
        try:
            # Attempt to install the packages
            for package in missing_packages:
                print(f"Installing {package}...", file=sys.stderr)
                # Try system-wide install first, then fall back to --user
                try:
                    result = subprocess.run(
                        [sys.executable, "-m", "pip", "install", package],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        check=True
                    )
                except subprocess.CalledProcessError:
                    print(f"System-wide install failed, trying user install...", file=sys.stderr)
                    result = subprocess.run(
                        [sys.executable, "-m", "pip", "install", "--user", package],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        check=True
                    )
                
                print(f"Installation output for {package}: {result.stdout}", file=sys.stderr)
            
            # Try importing again
            try:
                from moonraker_api import MoonrakerClient, MoonrakerListener
                import requests
                import aiohttp
                print("Successfully installed and imported required packages", file=sys.stderr)
            except ImportError as e:
                print(json.dumps({
                    "success": False,
                    "message": f"Failed to install required packages. Please install them manually with: pip install {' '.join(missing_packages)}",
                    "error": f"ImportError: {str(e)}"
                }))
                sys.exit(1)
        except subprocess.CalledProcessError as e:
            print(f"Error installing packages: {e.stderr}", file=sys.stderr)
            print(json.dumps({
                "success": False,
                "message": f"Failed to install required packages. Please install them manually with: pip install {' '.join(missing_packages)}",
                "error": f"Installation error: {e.stderr}"
            }))
            sys.exit(1)
        except Exception as e:
            print(f"Unexpected error during installation: {str(e)}", file=sys.stderr)
            print(json.dumps({
                "success": False,
                "message": "Failed to install required packages due to an unexpected error.",
                "error": str(e)
            }))
            sys.exit(1)

# Now continue with the main functionality
async def main():
    client = None
    try:
        print(f"DEBUG: Starting upload to Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        print(f"DEBUG: File path: {repr('${filePath.replace(/\\/g, '\\\\')}')}", file=sys.stderr)
        print(f"DEBUG: Remote name: {repr('${remoteName}')}", file=sys.stderr)
        
        # Parse the URL to get host and port
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        # Connect to printer with longer timeout
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=MoonrakerListener(),
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=10  # Increased timeout from 3 to 10 seconds
        )
        
        # Connect to the client
        await client.connect()
        
        # Check if connection works by getting server info
        print(f"DEBUG: Testing connection with server.info", file=sys.stderr)
        server_info = await client.get_server_info()
        print(f"DEBUG: Server info: {server_info}", file=sys.stderr)
        
        # Get the file list with a timeout to prevent hanging
        print(f"DEBUG: Getting file list", file=sys.stderr)
        try:
            files = await asyncio.wait_for(
                client.call_method("server.files.list", root="gcodes"),
                timeout=8.0  # Set an explicit timeout for this operation
            )
            print(f"DEBUG: Files: {files}", file=sys.stderr)
        except asyncio.TimeoutError:
            print(f"DEBUG: Timeout while getting file list", file=sys.stderr)
            # Continue without file list if timed out
        
        # Define the remote path
        remote_path = "gcodes/${remoteName}"
        
        # Read the file for upload
        file_path = "${filePath.replace(/\\/g, '\\\\')}"
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        # For file uploads, we need to use the HTTP API directly
        # Build the URL for upload
        protocol = "https://" if False else "http://"  # Always use http for now
        base_url = f"{protocol}{host}:{port}"
        upload_url = f"{base_url}/server/files/upload"
        
        # Upload the file using HTTP POST with multipart/form-data
        files = {
            'file': ('${remoteName}', file_data, 'application/octet-stream')
        }
        data = {
            'root': 'gcodes'
        }
        
        headers = {}
        if "${apiKey}":
            headers['X-Api-Key'] = "${apiKey}"
        
        print(f"DEBUG: Uploading file using HTTP POST to {upload_url}", file=sys.stderr)
        response = requests.post(upload_url, files=files, data=data, headers=headers)
        
        # Check the response
        if response.status_code not in (200, 201):
            error_message = f"Upload failed with status {response.status_code}: {response.text}"
            print(f"DEBUG: {error_message}", file=sys.stderr)
            
            # Special handling for 403 errors which are common with Moonraker
            if response.status_code == 403:
                try:
                    error_json = response.json()
                    error_text = error_json.get('error', {}).get('message', '')
                    
                    if "File is loaded" in error_text or "File currently in use" in error_text:
                        error_message = "Cannot upload: A file with the same name is currently loaded on the printer. " + \
                                       "The file has been renamed to avoid conflicts."
                    elif "upload not permitted" in error_text:
                        error_message = "Upload not permitted: The printer is currently printing or preparing to print."
                except Exception:
                    # If we can't parse the JSON, use the generic error message
                    pass
            
            raise Exception(error_message)
        
        # Parse the response
        upload_result = response.json()
        print(f"DEBUG: Upload result: {upload_result}", file=sys.stderr)
        
        # Start printing if requested
        if ${printAfterUpload ? 'True' : 'False'}:
            print(f"DEBUG: Starting print for file: {remote_path}", file=sys.stderr)
            
            # Use HTTP API to start print
            print_url = f"{base_url}/printer/print/start"
            print_headers = {
                'Content-Type': 'application/json'
            }
            if "${apiKey}":
                print_headers['X-Api-Key'] = "${apiKey}"
            
            print_data = json.dumps({"filename": "${remoteName}"})
            print_response = requests.post(print_url, data=print_data, headers=print_headers)
            
            if print_response.status_code != 200:
                error_message = f"Print start failed with status {print_response.status_code}: {print_response.text}"
                print(f"DEBUG: {error_message}", file=sys.stderr)
                raise Exception(error_message)
            
            print_result = print_response.json()
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
                "upload_result": upload_result,
                "_localFilePath": file_path
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
    try:
        result = asyncio.run(main())
        print(json.dumps(result))
    except asyncio.CancelledError:
        print(json.dumps({
            "success": False,
            "message": "Operation was cancelled. The connection to the printer might have timed out.",
            "error": "asyncio.CancelledError"
        }))
    except Exception as e:
        # Get full traceback for debugging
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback_details = traceback.format_exc()
        print(f"TRACEBACK: {traceback_details}", file=sys.stderr)
        
        print(json.dumps({
            "success": False,
            "message": str(e),
            "error": traceback_details
        }))
    finally:
        # Ensure we clean up any remaining tasks
        for task in asyncio.all_tasks() if hasattr(asyncio, 'all_tasks') else asyncio.Task.all_tasks():
            try:
                task.cancel()
            except:
                pass
        
        # Close any unclosed client sessions
        if 'aiohttp' in sys.modules:
            # Force close any remaining client sessions
            for session in aiohttp.ClientSession._instances:
                if not session.closed:
                    print(f"DEBUG: Cleaning up unclosed client session", file=sys.stderr)
                    try:
                        session._connector._close()
                    except:
                        pass
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
#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import asyncio

# First check and try to install moonraker-api if missing
try:
    from moonraker_api import MoonrakerClient, MoonrakerListener
    print("Successfully imported moonraker_api package", file=sys.stderr)
except ImportError:
    print("moonraker-api package not found, trying to install...", file=sys.stderr)
    import subprocess
    try:
        # Attempt to install the package
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "moonraker-api"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        print(f"Installation output: {result.stdout}", file=sys.stderr)
        
        # Try importing again
        try:
            from moonraker_api import MoonrakerClient, MoonrakerListener
            print("Successfully installed and imported moonraker_api package", file=sys.stderr)
        except ImportError as e:
            print(json.dumps({
                "success": False,
                "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
                "error": f"ImportError: {str(e)}"
            }))
            sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error installing package: {e.stderr}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
            "error": f"Installation error: {e.stderr}"
        }))
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during installation: {str(e)}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api due to an unexpected error.",
            "error": str(e)
        }))
        sys.exit(1)

# Set a shorter socket timeout to handle offline printers quickly
socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations

async def main():
    try:
        print(f"DEBUG: Testing connection to Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host and port
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=MoonrakerListener(),
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Connect to the client
        await client.connect()
        
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
#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import asyncio
from datetime import datetime

# First check and try to install moonraker-api if missing
try:
    from moonraker_api import MoonrakerClient, MoonrakerListener
    print("Successfully imported moonraker_api package", file=sys.stderr)
except ImportError:
    print("moonraker-api package not found, trying to install...", file=sys.stderr)
    import subprocess
    try:
        # Attempt to install the package
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "moonraker-api"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        print(f"Installation output: {result.stdout}", file=sys.stderr)
        
        # Try importing again
        try:
            from moonraker_api import MoonrakerClient, MoonrakerListener
            print("Successfully installed and imported moonraker_api package", file=sys.stderr)
        except ImportError as e:
            print(json.dumps({
                "success": False,
                "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
                "error": f"ImportError: {str(e)}"
            }))
            sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error installing package: {e.stderr}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
            "error": f"Installation error: {e.stderr}"
        }))
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during installation: {str(e)}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api due to an unexpected error.",
            "error": str(e)
        }))
        sys.exit(1)

# Set a shorter socket timeout to handle offline printers quickly
socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations

async def main():
    try:
        print(f"DEBUG: Getting status from Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host and port
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=MoonrakerListener(),
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Connect to the client
        await client.connect()
        
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
#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import asyncio

# First check and try to install moonraker-api if missing
try:
    from moonraker_api import MoonrakerClient, MoonrakerListener
    print("Successfully imported moonraker_api package", file=sys.stderr)
except ImportError:
    print("moonraker-api package not found, trying to install...", file=sys.stderr)
    import subprocess
    try:
        # Attempt to install the package
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "moonraker-api"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        print(f"Installation output: {result.stdout}", file=sys.stderr)
        
        # Try importing again
        try:
            from moonraker_api import MoonrakerClient, MoonrakerListener
            print("Successfully installed and imported moonraker_api package", file=sys.stderr)
        except ImportError as e:
            print(json.dumps({
                "success": False,
                "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
                "error": f"ImportError: {str(e)}"
            }))
            sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error installing package: {e.stderr}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
            "error": f"Installation error: {e.stderr}"
        }))
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during installation: {str(e)}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api due to an unexpected error.",
            "error": str(e)
        }))
        sys.exit(1)

# Set a shorter socket timeout to handle offline printers quickly
socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations

async def main():
    try:
        print(f"DEBUG: Starting print job for file {repr('${fileName}')} on Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host and port
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=MoonrakerListener(),
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Connect to the client
        await client.connect()
        
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
#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import asyncio

# First check and try to install moonraker-api if missing
try:
    from moonraker_api import MoonrakerClient, MoonrakerListener
    print("Successfully imported moonraker_api package", file=sys.stderr)
except ImportError:
    print("moonraker-api package not found, trying to install...", file=sys.stderr)
    import subprocess
    try:
        # Attempt to install the package
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--user", "moonraker-api"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        print(f"Installation output: {result.stdout}", file=sys.stderr)
        
        # Try importing again
        try:
            from moonraker_api import MoonrakerClient, MoonrakerListener
            print("Successfully installed and imported moonraker_api package", file=sys.stderr)
        except ImportError as e:
            print(json.dumps({
                "success": False,
                "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
                "error": f"ImportError: {str(e)}"
            }))
            sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error installing package: {e.stderr}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api. Please install it manually with: pip install --user moonraker-api",
            "error": f"Installation error: {e.stderr}"
        }))
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during installation: {str(e)}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "message": "Failed to install moonraker-api due to an unexpected error.",
            "error": str(e)
        }))
        sys.exit(1)

# Set a shorter socket timeout to handle offline printers quickly
socket.setdefaulttimeout(3)  # 3 second timeout for all socket operations

async def main():
    try:
        print(f"DEBUG: Cancelling print job on Moonraker at {repr('${printerUrl}')} with API key {repr('${apiKey}'[:4] + '****' if '${apiKey}' else 'none')}", file=sys.stderr)
        
        # Parse the URL to get host and port
        import urllib.parse
        parsed_url = urllib.parse.urlparse('${printerUrl}')
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        # Connect to printer with shorter timeout
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=MoonrakerListener(),
            api_key="${apiKey}" if '${apiKey}' else None,
            timeout=3
        )
        
        # Connect to the client
        await client.connect()
        
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