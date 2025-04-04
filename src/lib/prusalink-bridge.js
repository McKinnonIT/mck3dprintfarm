const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'prusalink-bridge');
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

/**
 * Uploads a file to a PrusaLink printer and optionally starts printing
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @param {string} filePath - Path to the file to upload
 * @param {string} remoteName - Optional name to use on the printer (defaults to the original filename)
 * @param {boolean} printAfterUpload - Whether to start printing after upload
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

  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `upload_${Date.now()}.py`);
    
    // If no remote name is provided, use the original filename
    if (!remoteName) {
      remoteName = path.basename(filePath);
    }
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a moderate socket timeout for operations
    socket.setdefaulttimeout(60)  # 60 second timeout for operations
    
    # Also import urllib3 and set a longer timeout
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 60
    
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
    print(f"DEBUG: File path: {repr('${filePath.replace(/\\/g, '\\\\')}')}", file=sys.stderr)
    print(f"DEBUG: Remote path: {repr('${remoteName}')}", file=sys.stderr)
    
    # Connect to printer with shorter timeout
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
    
    # Set longer socket timeout for upload operation
    socket.setdefaulttimeout(180)  # 3 minutes timeout for upload
    
    # Upload file
    file_path = "${filePath.replace(/\\/g, '\\\\')}"
    remote_path = "${remoteName}"
    
    # Verify file exists
    if not os.path.exists(file_path):
        print(json.dumps({
            "success": False,
            "message": f"File not found: {file_path}",
            "error": "File not found on disk"
        }))
        sys.exit(1)
    
    # Check if file exists first
    print(f"DEBUG: Checking if file exists: {remote_path}", file=sys.stderr)
    exists = printer.exists_gcode(remote_path)
    print(f"DEBUG: File exists: {exists}", file=sys.stderr)
    
    if exists:
        # If file exists, delete it first
        print(f"DEBUG: Deleting existing file", file=sys.stderr)
        delete_result = printer.delete(remote_path)
        print(f"DEBUG: Delete result: {delete_result.status_code}", file=sys.stderr)
    
    # Upload the file
    print(f"DEBUG: Uploading file", file=sys.stderr)
    result = printer.put_gcode(file_path, remote_path, ${printAfterUpload ? 'True' : 'False'})
    print(f"DEBUG: Upload result status code: {result.status_code}", file=sys.stderr)
    
    if result.status_code >= 400:
        error_text = "Unknown error"
        try:
            error_text = result.text
        except:
            pass
        
        print(json.dumps({
            "success": False,
            "message": f"Upload failed with status code: {result.status_code}",
            "error": error_text,
            "statusCode": result.status_code
        }))
        sys.exit(1)
    
    # Return success response
    print(json.dumps({
        "success": True,
        "message": "File successfully uploaded" + (" and print started" if ${printAfterUpload ? 'True' : 'False'} else ""),
        "data": {
            "path": remote_path
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
    const processTimeoutId = setTimeout(() => {
      console.log(`[prusalink-bridge] Force killing Python process after timeout`);
      try {
        pythonProcess.kill();
        activePythonProcesses.delete(pythonProcess);
      } catch (err) {
        console.error('Error killing process:', err);
      }
    }, 300000); // 5 minute hard limit (300 seconds) for large file uploads
    
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
 * Tests connection to a PrusaLink printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @returns {Promise<object>} - Result of the operation
 */
async function testConnection(printerIp, apiKey) {
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
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
try:
    # Set a moderate socket timeout for operations
    socket.setdefaulttimeout(60)  # 60 second timeout for operations
    
    # Also import urllib3 and set a longer timeout
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 60
    
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
    print(f"DEBUG: Starting connection test to printer at {repr('${printerIp}')} with API key {repr('${apiKey}'[:4] + '****')}", file=sys.stderr)
    
    # Connect to printer with shorter timeout
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Test printer connection
    print(f"DEBUG: Testing connection with get_version()", file=sys.stderr)
    version = printer.get_version()
    print(f"DEBUG: Version API response: {version.status_code}", file=sys.stderr)
    
    print(f"DEBUG: Getting printer info", file=sys.stderr)
    printer_info = printer.get_printer()
    print(f"DEBUG: Printer info API response: {printer_info.status_code}", file=sys.stderr)
    
    # Prepare response
    response = {
        "success": version.status_code == 200,
        "message": "Connection successful" if version.status_code == 200 else f"Connection failed: {version.status_code}",
        "data": {
            "version": version.json() if version.status_code == 200 else None,
            "printer": printer_info.json() if printer_info.status_code == 200 else None
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
    }, 20000); // 20 second hard limit
    
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
 * Gets detailed job status from a PrusaLink printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key (password) for the printer
 * @returns {Promise<object>} - Result of the operation including job status info
 */
async function getJobStatus(printerIp, apiKey) {
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
    const scriptPath = path.join(TEMP_DIR, `job_status_${Date.now()}.py`);
    
    // Create Python script content
    const pythonScript = `
import sys
import traceback
import socket
import json
from datetime import datetime
try:
    # Set a moderate socket timeout for operations
    socket.setdefaulttimeout(60)  # 60 second timeout for operations
    
    # Also import urllib3 and set a longer timeout
    import urllib3
    urllib3.Timeout.DEFAULT_TIMEOUT = 60
    
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
    
    # Connect to printer with shorter timeout
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Get printer info
    printer_info = printer.get_printer()
    print(f"DEBUG: Printer info API response: {printer_info.status_code}", file=sys.stderr)
    
    # Check if OK
    if printer_info.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to get printer info: {printer_info.status_code}",
            "error": f"HTTP {printer_info.status_code}"
        }))
        sys.exit(1)
    
    # Parse printer data
    printer_data = printer_info.json()
    print(f"DEBUG: Printer data: {printer_data}", file=sys.stderr)
    
    # Get job info
    job_info = printer.get_job()
    print(f"DEBUG: Job info API response: {job_info.status_code}", file=sys.stderr)
    
    # Parse job data if available
    job_data = {}
    if job_info.status_code == 200:
        job_data = job_info.json()
        print(f"DEBUG: Job data: {job_data}", file=sys.stderr)
    
    # Try additional information sources in PrusaLinkPy
    # PrusaLinkPy may have direct methods for getting time data
    time_data = {}
    try:
        # Try to get print time information directly 
        time_info = printer.get_print_time()
        if hasattr(time_info, 'status_code') and time_info.status_code == 200:
            time_data = time_info.json()
            print(f"DEBUG: Time info: {time_data}", file=sys.stderr)
    except Exception as time_err:
        print(f"DEBUG: Error getting time info: {time_err}", file=sys.stderr)
    
    # Try to get raw telemetry data
    telemetry_data = {}
    try:
        telemetry_info = printer.get_telemetry()
        if hasattr(telemetry_info, 'status_code') and telemetry_info.status_code == 200:
            telemetry_data = telemetry_info.json()
            print(f"DEBUG: Telemetry data: {telemetry_data}", file=sys.stderr)
    except Exception as telemetry_err:
        print(f"DEBUG: Error getting telemetry: {telemetry_err}", file=sys.stderr)
        
    # Let's try a direct call to the printer API endpoints
    raw_endpoints = {}
    try:
        # Try common API endpoints
        for endpoint in ['/api/printer', '/api/job', '/api/print-job', '/api/telemetry']:
            try:
                method = getattr(printer, 'get')  # Get the underlying request method
                if method:
                    response = method(endpoint)
                    if hasattr(response, 'status_code') and response.status_code == 200:
                        raw_endpoints[endpoint] = response.json()
                        print(f"DEBUG: Raw endpoint {endpoint}: {raw_endpoints[endpoint]}", file=sys.stderr)
            except Exception as api_err:
                print(f"DEBUG: Error accessing {endpoint}: {api_err}", file=sys.stderr)
    except Exception as raw_err:
        print(f"DEBUG: Error with raw endpoints: {raw_err}", file=sys.stderr)
        
    # Get estimated print time from file info if not in job data
    file_info = {}
    if printer_data.get('state', {}).get('text', '').lower() == 'printing':
        # Using get_files instead of get_job_file which doesn't exist
        try:
            # Get active job info from progress data in job_data instead
            if 'progress' in job_data and 'file' in job_data:
                file_info = job_data['file']
                print(f"DEBUG: Using file info from job progress: {file_info}", file=sys.stderr)
        except Exception as file_err:
            print(f"DEBUG: Error getting file info: {file_err}", file=sys.stderr)
    
    # Calculate remaining time and elapsed time based on progress and time estimates
    is_printing = printer_data.get('state', {}).get('text', '').lower() == 'printing'
    
    # Try to get progress from multiple sources
    progress = 0
    
    # First try to get from printer data
    if 'progress' in printer_data:
        progress = printer_data.get('progress', 0)
        print(f"DEBUG: Found progress in printer data: {progress}", file=sys.stderr)
        
    # Then try to get from job progress completion
    if progress == 0 and 'progress' in job_data:
        # Check if progress is a dictionary before trying to access 'completion'
        if isinstance(job_data['progress'], dict) and 'completion' in job_data['progress']:
            progress = job_data['progress']['completion']
            print(f"DEBUG: Found progress in job completion: {progress}", file=sys.stderr)
        # If progress is a float value directly
        elif isinstance(job_data['progress'], (int, float)):
            progress = job_data['progress']
            print(f"DEBUG: Found progress as direct float value: {progress}", file=sys.stderr)
    
    # Ensure progress is a decimal between 0 and 1
    if progress > 1:  # Convert percentage to decimal
        progress = progress / 100
        
    print(f"DEBUG: Final calculated progress: {progress}", file=sys.stderr)
    
    print_time_elapsed = None
    print_time_remaining = None
    print_start_time = None
    
    # Try to get time data from various sources
    if is_printing:
        # First source: direct telemetry data
        if telemetry_data.get('print_duration') is not None:
            print_time_elapsed = telemetry_data.get('print_duration')
            print(f"DEBUG: Found elapsed time in telemetry: {print_time_elapsed}", file=sys.stderr)
            
        if telemetry_data.get('time_to_end') is not None:
            print_time_remaining = telemetry_data.get('time_to_end')
            print(f"DEBUG: Found remaining time in telemetry: {print_time_remaining}", file=sys.stderr)
            
        # Second source: job data
        if print_time_elapsed is None and 'progress' in job_data:
            if isinstance(job_data['progress'], dict) and 'printTime' in job_data['progress']:
                print_time_elapsed = job_data['progress']['printTime']
                print(f"DEBUG: Found elapsed time in job data: {print_time_elapsed}", file=sys.stderr)
            
        if print_time_remaining is None and 'progress' in job_data:
            if isinstance(job_data['progress'], dict) and 'printTimeLeft' in job_data['progress']:
                print_time_remaining = job_data['progress']['printTimeLeft']
                print(f"DEBUG: Found remaining time in job data: {print_time_remaining}", file=sys.stderr)
            
        # Direct API response from PrusaLink - additional data sources
        if print_time_elapsed is None and 'progress' in job_data:
            # Check if progress is a dictionary
            if isinstance(job_data['progress'], dict):
                # Check for printTime in job progress
                if 'printTime' in job_data['progress']:
                    print_time_elapsed = job_data['progress']['printTime']
                    print(f"DEBUG: Found elapsed time in job progress: {print_time_elapsed}", file=sys.stderr)
                
        if print_time_remaining is None and 'progress' in job_data:
            # Check if progress is a dictionary
            if isinstance(job_data['progress'], dict):
                # Check for printTimeLeft in job progress
                if 'printTimeLeft' in job_data['progress']:
                    print_time_remaining = job_data['progress']['printTimeLeft']
                    print(f"DEBUG: Found remaining time in job progress: {print_time_remaining}", file=sys.stderr)

        # Third source: raw endpoint data
        for endpoint, data in raw_endpoints.items():
            # Check for common structures in PrusaLink API responses
            if print_time_elapsed is None:
                if data.get('progress', {}).get('printTime') is not None:
                    print_time_elapsed = data.get('progress', {}).get('printTime')
                    print(f"DEBUG: Found elapsed time in {endpoint}: {print_time_elapsed}", file=sys.stderr)
                elif data.get('time_elapsed') is not None:
                    print_time_elapsed = data.get('time_elapsed')
                    print(f"DEBUG: Found elapsed time in {endpoint}: {print_time_elapsed}", file=sys.stderr)
                elif data.get('print_duration') is not None:
                    print_time_elapsed = data.get('print_duration')
                    print(f"DEBUG: Found elapsed time in {endpoint}: {print_time_elapsed}", file=sys.stderr)
                    
            if print_time_remaining is None:
                if data.get('progress', {}).get('printTimeLeft') is not None:
                    print_time_remaining = data.get('progress', {}).get('printTimeLeft')
                    print(f"DEBUG: Found remaining time in {endpoint}: {print_time_remaining}", file=sys.stderr)
                elif data.get('time_remaining') is not None:
                    print_time_remaining = data.get('time_remaining')
                    print(f"DEBUG: Found remaining time in {endpoint}: {print_time_remaining}", file=sys.stderr)
                elif data.get('time_to_end') is not None:
                    print_time_remaining = data.get('time_to_end')
                    print(f"DEBUG: Found remaining time in {endpoint}: {print_time_remaining}", file=sys.stderr)
                
        # Try the direct time data object
        if print_time_elapsed is None and time_data.get('time_elapsed') is not None:
            print_time_elapsed = time_data.get('time_elapsed')
            print(f"DEBUG: Found elapsed time in time_data: {print_time_elapsed}", file=sys.stderr)
            
        if print_time_remaining is None and time_data.get('time_remaining') is not None:
            print_time_remaining = time_data.get('time_remaining')
            print(f"DEBUG: Found remaining time in time_data: {print_time_remaining}", file=sys.stderr)
            
        # If time_remaining is not available directly, calculate it
        if print_time_remaining is None and print_time_elapsed is not None and progress > 0:
            print_time_remaining = (print_time_elapsed / progress) - print_time_elapsed
            print(f"DEBUG: Calculated remaining time from progress: {print_time_remaining}", file=sys.stderr)
        
        # Try to calculate times from file info and progress
        if (print_time_remaining is None or print_time_elapsed is None):
            # Try to get estimated print time from various sources
            estimated_total_time = None
            
            # Try from file info
            if 'estimated_print_time' in file_info:
                estimated_total_time = file_info['estimated_print_time']
                print(f"DEBUG: Found estimated_print_time in file info: {estimated_total_time}", file=sys.stderr)
            
            # Try from job data - estimatedPrintTime field
            if estimated_total_time is None and 'estimatedPrintTime' in job_data:
                estimated_total_time = job_data['estimatedPrintTime']
                print(f"DEBUG: Found estimatedPrintTime in job data: {estimated_total_time}", file=sys.stderr)
                
            # Try from job data - job.estimatedPrintTime field
            if estimated_total_time is None and 'job' in job_data and 'estimatedPrintTime' in job_data['job']:
                estimated_total_time = job_data['job']['estimatedPrintTime']
                print(f"DEBUG: Found estimatedPrintTime in job.estimatedPrintTime: {estimated_total_time}", file=sys.stderr)
                
            if estimated_total_time is not None:
                # Now use this to calculate times if needed
                if print_time_elapsed is None and progress > 0:
                    print_time_elapsed = estimated_total_time * progress
                    print(f"DEBUG: Calculated elapsed time from estimated total time: {print_time_elapsed}", file=sys.stderr)
                
                if print_time_remaining is None and progress < 1:
                    print_time_remaining = estimated_total_time * (1 - progress)
                    print(f"DEBUG: Calculated remaining time from estimated total time: {print_time_remaining}", file=sys.stderr)
            
            # If we still don't have print_time_remaining but have print_time_elapsed
            if print_time_remaining is None and print_time_elapsed is not None and progress > 0:
                print_time_remaining = (print_time_elapsed / progress) - print_time_elapsed
                print(f"DEBUG: Calculated remaining time from progress: {print_time_remaining}", file=sys.stderr)
        
        # Try to get print start time from file info
        if 'print_start' in job_data:
            print_start_time = job_data['print_start']
            print(f"DEBUG: Found start time in job data: {print_start_time}", file=sys.stderr)
        elif print_time_elapsed is not None:
            # Calculate approximate start time from current time and elapsed time
            current_time = datetime.now().timestamp()
            print_start_time = current_time - print_time_elapsed
            print(f"DEBUG: Calculated start time from elapsed time: {print_start_time}", file=sys.stderr)
    
    # Create response structure
    response = {
        "success": True,
        "message": "Status retrieved successfully",
        "data": {
            "printer": printer_data,
            "job": job_data,
            "file": file_info,
            "telemetry": telemetry_data,
            "time_data": time_data,
            "raw_endpoints": raw_endpoints,
            "status": {
                "is_printing": is_printing,
                "progress": progress,
                "print_time_elapsed": print_time_elapsed,
                "print_time_remaining": print_time_remaining,
                "print_start_time": print_start_time
            }
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
    }, 300000); // 5 minute hard limit (300 seconds) for large file uploads
    
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
  uploadAndPrint,
  testConnection,
  getJobStatus
}; 