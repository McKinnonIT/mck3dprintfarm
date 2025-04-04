import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary directory for Python scripts
const TEMP_DIR = path.join(os.tmpdir(), 'prusalink-test');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const printerIp = url.searchParams.get('ip') || '127.0.0.1';
    const apiKey = url.searchParams.get('key') || 'test_api_key';
    
    // Find Python executable
    const pythonExecutable = await findPythonExecutable();
    if (!pythonExecutable) {
      return NextResponse.json({
        success: false,
        message: 'Python is not installed or not found in PATH. Please install Python 3.'
      });
    }
    
    // Create a temporary Python script to execute
    const scriptPath = path.join(TEMP_DIR, `test_fix_${Date.now()}.py`);
    
    // Create Python script content - Fixed version that explicitly checks parameter types
    const pythonScript = `
import sys
import traceback
import socket
import json

# Set timeout
socket.setdefaulttimeout(3)

try:
    # Try to import PrusaLinkPy
    import PrusaLinkPy
    
    # Print the version of PrusaLinkPy
    print("PrusaLinkPy version:", PrusaLinkPy.__version__ if hasattr(PrusaLinkPy, "__version__") else "Unknown")

    # Try with connect=True parameter (Valid parameter)
    print("Trying with connect=True parameter:")
    try:
        printer_with_connect = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}", connect=True)
        print("  Success with connect=True parameter")
    except Exception as connect_error:
        print("  Error with connect=True parameter:", str(connect_error))

    # Try with connect=False parameter (Valid parameter)
    print("Trying with connect=False parameter:")
    try:
        printer_with_connect_false = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}", connect=False)
        print("  Success with connect=False parameter")
    except Exception as connect_false_error:
        print("  Error with connect=False parameter:", str(connect_false_error))
    
    # Try without any extra parameters (Fixed approach)
    print("Trying without extra parameters (safest approach):")
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    print("  Success without extra parameters")
    
    # Result is successful if we got here
    print(json.dumps({
        "success": True,
        "message": "Test completed successfully",
        "data": {
            "details": "All tests passed without critical errors"
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
    
    // Execute the Python script
    const result = await runPythonScript(pythonExecutable, scriptPath);
    
    // Clean up the temporary script
    try {
      fs.unlinkSync(scriptPath);
    } catch (error) {
      console.error('Failed to clean up temporary Python script:', error);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Failed to run PrusaLinkPy test:", error);
    return NextResponse.json(
      { error: "Failed to run PrusaLinkPy test", details: error.message },
      { status: 500 }
    );
  }
}

// Find Python executable
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

// Run Python script and return the result
async function runPythonScript(pythonExecutable, scriptPath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonExecutable, [scriptPath]);
    
    let output = '';
    let errorOutput = '';
    
    // Set a hard timeout to kill the process if it runs too long
    const processTimeoutId = setTimeout(() => {
      console.log(`Force killing Python process after timeout`);
      try {
        pythonProcess.kill();
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
      
      if (code === 0) {
        try {
          // Check if output is JSON or plain text
          if (output.trim().startsWith('{') && output.trim().endsWith('}')) {
            const result = JSON.parse(output);
            resolve(result);
          } else {
            // For non-JSON output, create a structured response
            resolve({
              success: true,
              output: output,
              errorOutput: errorOutput
            });
          }
        } catch (error) {
          console.error('Failed to parse Python script output:', error);
          console.error('Raw output was:', output);
          console.error('Error output was:', errorOutput);
          
          resolve({
            success: false,
            message: 'Failed to parse Python script output',
            error: error.message,
            output,
            errorOutput
          });
        }
      } else {
        // Try to parse error output as JSON first
        try {
          if (output.trim().startsWith('{') && output.trim().endsWith('}')) {
            const errorResult = JSON.parse(output);
            resolve(errorResult);
          } else {
            // For non-JSON error output
            resolve({
              success: false,
              message: 'Python script execution failed',
              error: errorOutput || output || 'Unknown error',
              code,
              output,
              errorOutput
            });
          }
        } catch (parseError) {
          // If we can't parse the output as JSON, use the raw output
          resolve({
            success: false,
            message: 'Python script execution failed',
            error: errorOutput || output || 'Unknown error',
            code,
            output,
            errorOutput
          });
        }
      }
    });
  });
} 