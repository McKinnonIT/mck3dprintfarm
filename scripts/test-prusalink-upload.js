#!/usr/bin/env node

/**
 * This is a standalone script to test uploading a file to a PrusaLink printer.
 * It uses the PrusaLinkPy library directly.
 * 
 * Usage:
 *   node test-prusalink-upload.js <printer-ip> <api-key> <file-path> [print]
 * 
 * Examples:
 *   node test-prusalink-upload.js 192.168.1.123 abcd1234 path/to/file.bgcode
 *   node test-prusalink-upload.js 192.168.1.123 abcd1234 path/to/file.bgcode print
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node test-prusalink-upload.js <printer-ip> <api-key> <file-path> [print]');
  process.exit(1);
}

const printerIp = args[0];
const apiKey = args[1];
const filePath = args[2];
const shouldPrint = args[3] === 'print';

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'prusalink-test');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Create and run the test script
async function runTest() {
  // Find a Python executable
  const pythonExecutable = await findPythonExecutable();
  if (!pythonExecutable) {
    console.error('Python not found. Please install Python 3 and try again.');
    process.exit(1);
  }
  
  console.log(`Using Python executable: ${pythonExecutable}`);
  
  // Create a temporary Python script
  const scriptPath = path.join(TEMP_DIR, `upload_test_${Date.now()}.py`);
  
  const fileName = path.basename(filePath);
  
  const pythonScript = `
import sys
import traceback
try:
    import PrusaLinkPy
except ImportError:
    print("ERROR: PrusaLinkPy not installed. Install with: pip install prusaLinkPy")
    sys.exit(1)

import json
import os

try:
    print(f"Connecting to printer at {repr('${printerIp}')} with API key {repr('${apiKey}'[:4] + '****')}")
    print(f"File path: {repr('${filePath.replace(/\\/g, '\\\\')}')}")
    print(f"File name: {repr('${fileName}')}")
    print(f"Print after upload: {repr('${shouldPrint ? 'True' : 'False'}')}")
    
    # Verify file exists
    if not os.path.exists("${filePath.replace(/\\/g, '\\\\')}"):
        print(f"Error: File not found: ${filePath.replace(/\\/g, '\\\\')}")
        sys.exit(1)
    
    # Connect to printer
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Check if connection works
    print(f"Testing connection...")
    version = printer.get_version()
    print(f"Version API response: {version.status_code}")
    
    if version.status_code != 200:
        print(f"Error: Failed to connect to printer: {version.status_code}")
        sys.exit(1)

    # Get printer info
    printer_info = printer.get_printer()
    print(f"Printer info:")
    print(json.dumps(printer_info.json(), indent=2))
    
    # Check if file exists first
    print(f"Checking if file exists: {fileName}")
    exists = printer.exists_gcode(fileName)
    print(f"File exists: {exists}")
    
    if exists:
        # If file exists, delete it first
        print(f"Deleting existing file")
        delete_result = printer.delete(fileName)
        print(f"Delete result: {delete_result.status_code}")
    
    # Upload the file
    print(f"Uploading file...")
    result = printer.put_gcode("${filePath.replace(/\\/g, '\\\\')}", fileName, ${shouldPrint ? 'True' : 'False'})
    print(f"Upload result: {result.status_code}")
    
    if result.status_code >= 400:
        try:
            print(f"Upload failed: {result.text}")
        except:
            print(f"Upload failed with status code: {result.status_code}")
        sys.exit(1)
    else:
        print(f"Upload successful!")
        
        # Check print status if printing
        if ${shouldPrint ? 'True' : 'False'}:
            print(f"Print started. Checking job status...")
            job_info = printer.get_job()
            print(json.dumps(job_info.json(), indent=2))
    
except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    print("Error:", str(e))
    print("\\n".join(traceback_details))
    sys.exit(1)
`;
  
  // Write the script to a file
  fs.writeFileSync(scriptPath, pythonScript);
  
  // Execute the Python script
  const pythonProcess = spawn(pythonExecutable, [scriptPath], { stdio: 'inherit' });
  
  pythonProcess.on('close', (code) => {
    // Clean up the temporary script
    try {
      fs.unlinkSync(scriptPath);
    } catch (error) {
      console.error('Failed to clean up temporary Python script:', error);
    }
    
    process.exit(code);
  });
}

async function findPythonExecutable() {
  const possibleExecutables = ['python3', 'python', 'py'];
  
  for (const executable of possibleExecutables) {
    try {
      const process = spawn(executable, ['--version']);
      
      // Create a promise to get the result
      const result = await new Promise((resolve) => {
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            console.log(`Found Python: ${output.trim()}`);
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        process.on('error', () => {
          resolve(false);
        });
      });
      
      if (result) {
        return executable;
      }
    } catch (error) {
      // Ignore errors and try the next executable
    }
  }
  
  return null;
}

// Run the test
runTest().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 