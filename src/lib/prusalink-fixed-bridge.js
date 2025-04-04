/**
 * Fixed version of prusalink-bridge.js that applies a patch to fix the connect parameter issue
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'prusalink-bridge');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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
  console.log(`[prusalink-bridge] Active Python processes: ${activePythonProcesses.size}`);
  
  // Kill any processes that have been running for more than 30 seconds
  const now = Date.now();
  for (const process of activePythonProcesses) {
    if (process.startTime && (now - process.startTime) > 30000) {
      console.log(`[prusalink-bridge] Killing long-running Python process (${Math.round((now - process.startTime)/1000)}s)`);
      try {
        process.kill();
        activePythonProcesses.delete(process);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }
  }
}, 10000); // Check every 10 seconds

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

/**
 * Creates the monkey patch code to fix PrusaLinkPy connect parameter issue
 * @returns {string} Python code that patches PrusaLinkPy
 */
function getPrusaLinkPyPatchCode() {
  return `
def patch_prusalinkpy():
    """Fix the PrusaLinkPy connect parameter issue with monkey patching"""
    try:
        import sys
        import PrusaLinkPy
        
        # Store the original __init__ method
        original_init = PrusaLinkPy.PrusaLinkPy.__init__
        
        # Create a patched init function that safely handles connect parameter
        def patched_init(self, ip, api_key, **kwargs):
            # Extract connect parameter if present and validate its type
            connect = kwargs.pop('connect', None)
            
            # If connect is a dictionary, object, or non-boolean type, set it to None
            if not isinstance(connect, (bool, int, float, type(None))):
                print(f"Warning: Invalid connect parameter type: {type(connect)}. Setting to None.", file=sys.stderr)
                connect = None
            
            # Only pass connect parameter if it's a valid type
            if connect is not None:
                kwargs['connect'] = connect
                
            # Call the original init with sanitized parameters
            return original_init(self, ip, api_key, **kwargs)
        
        # Replace with our patched version
        PrusaLinkPy.PrusaLinkPy.__init__ = patched_init
        
        print("Successfully patched PrusaLinkPy.__init__ to handle invalid connect parameters", file=sys.stderr)
        return True
    except Exception as e:
        print(f"Failed to patch PrusaLinkPy: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return False

# Apply the patch
patch_prusalinkpy()
`;
}

/**
 * Uploads a file to a PrusaLink printer and optionally starts a print
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @param {string} filePath - Path to the file to upload
 * @param {string} remoteName - Name to use for the file on the printer (default: original filename)
 * @param {boolean} printAfterUpload - Whether to start printing after the upload completes
 * @returns {Promise<object>} - Result of the operation
 */
async function uploadAndPrint(printerIp, apiKey, filePath, remoteName = '', printAfterUpload = false) {
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

  // Get file size
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
  console.log(`Uploading file ${filePath} (${fileSizeInMB.toFixed(2)} MB) to PrusaLink printer at ${printerIp}`);

  // Determine remote filename if not provided
  if (!remoteName) {
    remoteName = path.basename(filePath);
  }

  return new Promise((resolve, reject) => {
    // Set a longer timeout for uploads (5 minutes)
    const UPLOAD_TIMEOUT = 5 * 60 * 1000;
    
    // Create a temporary Python script
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `upload_${Date.now()}.py`);
    
    // Write the Python script to handle file upload
    const pythonScript = `
import sys
import traceback
import socket
import json
import os
try:
    # Set socket timeout for uploads
    socket.setdefaulttimeout(180)  # 3 minute timeout for uploads
    
    # Also import urllib3 and set a longer timeout for uploads
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 180
    
    ${getPrusaLinkPyPatchCode()}
    
    import PrusaLinkPy
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os
import time

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with API key {repr('${apiKey}'[:4] + '****')}", file=sys.stderr)
    
    # Connect to printer with safer parameters
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Check if connection works
    print(f"DEBUG: Testing connection with get_version()", file=sys.stderr)
    version = printer.get_version()
    print(f"DEBUG: Version API response: {version.status_code}", file=sys.stderr)
    
    if version.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}",
            "data": { "status": version.status_code }
        }))
        sys.exit(1)
    
    # Get file stats
    file_size = os.path.getsize("${filePath.replace(/\\/g, '\\\\')}")
    print(f"DEBUG: Uploading file: ${remoteName} (Size: {file_size / 1024 / 1024:.2f} MB)", file=sys.stderr)
    
    # Upload the file - this may take some time for large files
    print(f"DEBUG: Starting file upload", file=sys.stderr)
    start_time = time.time()
    upload_result = printer.upload_file("${filePath.replace(/\\/g, '\\\\')}", "${remoteName}")
    upload_time = time.time() - start_time
    print(f"DEBUG: Upload completed in {upload_time:.2f} seconds", file=sys.stderr)
    print(f"DEBUG: Upload result: {upload_result.status_code}", file=sys.stderr)
    
    if upload_result.status_code < 200 or upload_result.status_code >= 300:
        print(json.dumps({
            "success": False,
            "message": f"Failed to upload file: {upload_result.status_code}",
            "data": { "status": upload_result.status_code }
        }))
        sys.exit(1)
    
    # Get final upload details
    try:
        upload_data = upload_result.json()
        print(f"DEBUG: Upload response data: {upload_data}", file=sys.stderr)
    except:
        upload_data = { "message": "File uploaded successfully" }
    
    # Start print if requested
    if ${printAfterUpload}:
        print(f"DEBUG: Starting print of uploaded file", file=sys.stderr)
        print_result = printer.select_file("${remoteName}")
        print(f"DEBUG: Print start result: {print_result.status_code}", file=sys.stderr)
        
        if print_result.status_code < 200 or print_result.status_code >= 300:
            print(json.dumps({
                "success": True,
                "message": "File uploaded successfully but failed to start print",
                "data": {
                    "upload": upload_data,
                    "print": {
                        "status": print_result.status_code,
                        "error": "Failed to start print"
                    }
                }
            }))
            sys.exit(0)
            
        print(json.dumps({
            "success": True,
            "message": "File uploaded and print started successfully",
            "data": {
                "upload": upload_data,
                "print": {
                    "status": print_result.status_code,
                    "started": True
                }
            }
        }))
    else:
        print(json.dumps({
            "success": True,
            "message": "File uploaded successfully",
            "data": {
                "upload": upload_data
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
    fs.writeFileSync(tmpFile, pythonScript);
    
    // Execute the Python script and register for cleanup
    const pythonProcess = registerPythonProcess(spawn(pythonExecutable, [tmpFile]));
    pythonProcess.startTime = Date.now(); // Track process start time
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const processTimeoutId = setTimeout(() => {
      console.log(`[prusalink-bridge] Force killing Python upload process after timeout (${UPLOAD_TIMEOUT/1000}s)`);
      try {
        pythonProcess.kill();
        activePythonProcesses.delete(pythonProcess);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }, UPLOAD_TIMEOUT);
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Log progress messages for better debugging
      console.log(`[prusalink-upload] ${data.toString().trim()}`);
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject({
        success: false,
        message: `Failed to start Python process: ${error.message}`,
        error: error.message
      });
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      // Clear the hard timeout
      clearTimeout(processTimeoutId);
      
      // Clean up the temporary script
      try {
        fs.unlinkSync(tmpFile);
      } catch (error) {
        console.error('Failed to clean up temporary Python script:', error);
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python script output:', error);
          console.error('Raw output was:', output);
          console.error('Error output was:', errorOutput);
          
          reject({
            success: false,
            message: 'Failed to parse Python script output',
            error: error.message,
            output
          });
        }
      } else {
        // Try to parse error output as JSON first
        try {
          const errorResult = JSON.parse(output);
          console.error('Python error details:', errorResult);
          reject(errorResult);
        } catch (parseError) {
          // If we can't parse the output as JSON, use the raw output
          console.error('Python script failed with code:', code);
          console.error('Output:', output);
          console.error('Error output:', errorOutput);
          
          reject({
            success: false,
            message: 'Python script execution failed',
            error: errorOutput || output || 'Unknown error',
            code
          });
        }
      }
    });
  });
}

/**
 * Stops a print job on a PrusaLink printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @returns {Promise<object>} - Result of the operation
 */
async function stopPrintJob(printerIp, apiKey) {
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
    const scriptPath = path.join(TEMP_DIR, `stop_print_${Date.now()}.py`);
    
    // Create Python script content with patch applied
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a moderate socket timeout to handle operations
    socket.setdefaulttimeout(60)  # 60 second timeout for operations
    
    # Also import urllib3 and set a moderate timeout
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 60
    
    ${getPrusaLinkPyPatchCode()}
    
    import PrusaLinkPy
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with API key {repr('${apiKey}'[:4] + '****')}", file=sys.stderr)
    
    # Connect to printer with shorter timeout - connect parameter is safely handled now
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Check if connection works
    print(f"DEBUG: Testing connection with get_version()", file=sys.stderr)
    version = printer.get_version()
    print(f"DEBUG: Version API response: {version.status_code}", file=sys.stderr)
    
    if version.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}",
            "data": { "status": version.status_code }
        }))
        sys.exit(1)
    
    # Get job status to ensure it's printing
    print(f"DEBUG: Getting job status", file=sys.stderr)
    job_info = printer.get_job()
    print(f"DEBUG: Job info API response: {job_info.status_code}", file=sys.stderr)
    
    # Check if there's an active job
    if job_info.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to get job status: {job_info.status_code}",
            "data": { "status": job_info.status_code }
        }))
        sys.exit(1)
    
    job_data = job_info.json()
    if 'state' in job_data and job_data['state'] == 'Printing':
        # Cancel the print job
        print(f"DEBUG: Canceling print job", file=sys.stderr)
        cancel_result = printer.cancel()
        print(f"DEBUG: Cancel result: {cancel_result.status_code}", file=sys.stderr)
        
        if cancel_result.status_code >= 200 and cancel_result.status_code < 300:
            print(json.dumps({
                "success": True,
                "message": "Print job canceled successfully",
                "data": {
                    "status": cancel_result.status_code
                }
            }))
        else:
            print(json.dumps({
                "success": False,
                "message": f"Failed to cancel print job: {cancel_result.status_code}",
                "data": { "status": cancel_result.status_code }
            }))
            sys.exit(1)
    else:
        print(json.dumps({
            "success": False,
            "message": "No active print job to cancel",
            "data": job_data
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
    const processTimeoutId = setTimeout(() => {
      console.log(`[prusalink-bridge] Force killing Python process after timeout`);
      try {
        pythonProcess.kill();
        activePythonProcesses.delete(pythonProcess);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }, 20000);
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject({
        success: false,
        message: `Failed to start Python process: ${error.message}`,
        error: error.message
      });
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      // Clear the hard timeout
      clearTimeout(processTimeoutId);
      
      // Clean up the temporary script
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.error('Failed to clean up temporary Python script:', error);
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python script output:', error);
          console.error('Raw output was:', output);
          console.error('Error output was:', errorOutput);
          
          reject({
            success: false,
            message: 'Failed to parse Python script output',
            error: error.message,
            output
          });
        }
      } else {
        // Try to parse error output as JSON first
        try {
          const errorResult = JSON.parse(output);
          console.error('Python error details:', errorResult);
          reject(errorResult);
        } catch (parseError) {
          // If we can't parse the output as JSON, use the raw output
          console.error('Python script failed with code:', code);
          console.error('Output:', output);
          console.error('Error output:', errorOutput);
          
          reject({
            success: false,
            message: 'Python script execution failed',
            error: errorOutput || output || 'Unknown error',
            code
          });
        }
      }
    });
  });
}

/**
 * Connects to a PrusaLink printer and establishes a connection
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @param {number} timeout - Optional timeout in seconds (defaults to 60)
 * @returns {Promise<object>} - Result of the operation
 */
async function connectPrinter(printerIp, apiKey, timeout = 60) {
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
    
    // Create Python script content with patch applied
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a moderate socket timeout to handle operations
    socket.setdefaulttimeout(60)  # 60 second timeout for operations
    
    # Also import urllib3 and set a moderate timeout
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 60
    
    ${getPrusaLinkPyPatchCode()}
    
    import PrusaLinkPy
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy",
        "error": "Module not found"
    }))
    sys.exit(1)

import json
import os

try:
    print(f"DEBUG: Starting connection to printer at {repr('${printerIp}')} with API key {repr('${apiKey}'[:4] + '****')}", file=sys.stderr)
    
    # Connect to printer with shorter timeout - connect parameter is safely handled now
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Test printer connection
    print(f"DEBUG: Testing connection with get_version()", file=sys.stderr)
    version = printer.get_version()
    print(f"DEBUG: Version API response: {version.status_code}", file=sys.stderr)
    
    if version.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}",
            "data": { "status": version.status_code }
        }))
        sys.exit(1)
    
    print(f"DEBUG: Getting printer info", file=sys.stderr)
    printer_info = printer.get_printer()
    print(f"DEBUG: Printer info API response: {printer_info.status_code}", file=sys.stderr)
    
    # Prepare detailed response
    response = {
        "success": version.status_code == 200,
        "message": "Connection successful" if version.status_code == 200 else f"Connection failed: {version.status_code}",
        "data": {
            "version": version.json() if version.status_code == 200 else None,
            "printer": printer_info.json() if printer_info.status_code == 200 else None,
            "connected": True
        }
    }
    
    print(json.dumps(response))
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
    const processTimeoutId = setTimeout(() => {
      console.log(`[prusalink-bridge] Force killing Python process after timeout`);
      try {
        pythonProcess.kill();
        activePythonProcesses.delete(pythonProcess);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }, Math.max(120, timeout) * 1000); // At least 2 minutes or the provided timeout value
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject({
        success: false,
        message: `Failed to start Python process: ${error.message}`,
        error: error.message
      });
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      // Clear the hard timeout
      clearTimeout(processTimeoutId);
      
      // Clean up the temporary script
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.error('Failed to clean up temporary Python script:', error);
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python script output:', error);
          console.error('Raw output was:', output);
          console.error('Error output was:', errorOutput);
          
          reject({
            success: false,
            message: 'Failed to parse Python script output',
            error: error.message,
            output
          });
        }
      } else {
        // Try to parse error output as JSON first
        try {
          const errorResult = JSON.parse(output);
          console.error('Python error details:', errorResult);
          reject(errorResult);
        } catch (parseError) {
          // If we can't parse the output as JSON, use the raw output
          console.error('Python script failed with code:', code);
          console.error('Output:', output);
          console.error('Error output:', errorOutput);
          
          reject({
            success: false,
            message: 'Python script execution failed',
            error: errorOutput || output || 'Unknown error',
            code
          });
        }
      }
    });
  });
}

module.exports = {
  stopPrintJob,
  connectPrinter,
  uploadAndPrint
}; 