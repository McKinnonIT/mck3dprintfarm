import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Test endpoint for PrusaLink connection using direct Python script
 * that doesn't pass any connect parameter
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get printer details from query params
    const url = new URL(request.url);
    const ip = url.searchParams.get('ip') || '';
    const key = url.searchParams.get('key') || '';

    if (!ip || !key) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: ip and key" },
        { status: 400 }
      );
    }

    console.log(`Running PrusaLink test with IP: ${ip}`);

    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'prusalink-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a temporary Python script
    const scriptPath = path.join(tempDir, `test_${Date.now()}.py`);
    
    // Write Python script that doesn't use connect parameter
    const pythonScript = `
import sys
import json
import traceback
import socket

# Set timeouts
socket.setdefaulttimeout(5)

try:
    import PrusaLinkPy
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy"
    }))
    sys.exit(1)

try:
    # Create instance WITHOUT specifying connect parameter
    printer = PrusaLinkPy.PrusaLinkPy("${ip}", "${key}")
    
    # Get version
    version_result = printer.get_version()
    if version_result.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to connect to printer: {version_result.status_code}"
        }))
        sys.exit(1)
        
    # Get printer info
    printer_info = printer.get_printer()
    printer_data = printer_info.json() if printer_info.status_code == 200 else None
    
    # Return combined data
    print(json.dumps({
        "success": True,
        "message": "Connection successful",
        "data": {
            "version": version_result.json(),
            "printer": printer_data,
            "connected": True
        }
    }))
except Exception as e:
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    print(json.dumps({
        "success": False,
        "message": str(e),
        "error": str(e),
        "traceback": "\\n".join(traceback_details)
    }))
    sys.exit(1)
`;
    
    // Write script to temporary file
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Find Python executable
    const pythonExecutables = ['python3', 'python', 'py'];
    let pythonProcess;
    
    // Try different Python executables
    for (const executable of pythonExecutables) {
      try {
        pythonProcess = spawn(executable, [scriptPath]);
        break;
      } catch (err) {
        // Try next executable
        continue;
      }
    }
    
    if (!pythonProcess) {
      return NextResponse.json(
        { success: false, message: "Could not find Python executable. Please install Python 3." },
        { status: 500 }
      );
    }
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      try {
        pythonProcess.kill();
      } catch (err) { /* ignore */ }
      return NextResponse.json(
        { success: false, message: "Request timed out" },
        { status: 504 }
      );
    }, 10000);
    
    // Collect output
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`[prusalink-test] ${data.toString().trim()}`);
    });
    
    // Handle completion
    const response = await new Promise<NextResponse>((resolve) => {
      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Clean up temp file
        try {
          fs.unlinkSync(scriptPath);
        } catch (err) { /* ignore */ }
        
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(NextResponse.json(result));
          } catch (err) {
            resolve(NextResponse.json(
              { 
                success: false, 
                message: "Failed to parse Python output",
                error: err.message,
                output
              },
              { status: 500 }
            ));
          }
        } else {
          try {
            const error = JSON.parse(output);
            resolve(NextResponse.json(error, { status: 500 }));
          } catch (err) {
            resolve(NextResponse.json(
              { 
                success: false, 
                message: "Python script failed",
                error: errorOutput || output,
                code
              },
              { status: 500 }
            ));
          }
        }
      });
    });
    
    return response;
  } catch (error: any) {
    console.error("Error testing PrusaLink connection:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Unknown error",
        error
      },
      { status: 500 }
    );
  }
} 