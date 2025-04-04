import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { Buffer } from "buffer";

/**
 * Simple endpoint to upload files to PrusaLink printers without using connect parameter
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data from request
    const formData = await request.formData();
    const fileData = formData.get("file") as File;
    const printerIp = formData.get("ip") as string;
    const apiKey = formData.get("apiKey") as string;
    const printAfterUpload = formData.get("printAfterUpload") === "true";

    if (!fileData || !printerIp || !apiKey) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: file, ip, and apiKey" },
        { status: 400 }
      );
    }

    // Create a temporary directory for the upload
    const tempDir = path.join(os.tmpdir(), 'prusalink-upload');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Write the file to temp directory
    const tempFilePath = path.join(tempDir, fileData.name);
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempFilePath, fileBuffer);

    console.log(`File saved to ${tempFilePath}, size: ${fileBuffer.length} bytes`);

    // Create the Python script for upload that doesn't use connect parameter
    const scriptPath = path.join(tempDir, `upload_${Date.now()}.py`);
    const pythonScript = `
import sys
import json
import traceback
import socket
import time
import os

# Set timeouts
socket.setdefaulttimeout(30)  # Longer timeout for file uploads

try:
    import PrusaLinkPy
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy"
    }))
    sys.exit(1)

try:
    # Get file stats
    file_path = r"${tempFilePath.replace(/\\/g, '\\\\')}"
    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    print(f"DEBUG: File size: {file_size} bytes", file=sys.stderr)
    
    # Create instance WITHOUT specifying connect parameter
    printer = PrusaLinkPy.PrusaLinkPy("${printerIp}", "${apiKey}")
    
    # Test connection first
    version = printer.get_version()
    if version.status_code != 200:
        print(json.dumps({
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}"
        }))
        sys.exit(1)
    
    # Upload the file
    print(f"DEBUG: Starting file upload", file=sys.stderr)
    start_time = time.time()
    upload_result = printer.upload_file(file_path, file_name)
    upload_time = time.time() - start_time
    print(f"DEBUG: Upload completed in {upload_time:.2f} seconds", file=sys.stderr)
    
    if upload_result.status_code < 200 or upload_result.status_code >= 300:
        print(json.dumps({
            "success": False,
            "message": f"Failed to upload file: {upload_result.status_code}"
        }))
        sys.exit(1)
    
    print_started = False
    
    # Start print if requested
    if ${printAfterUpload}:
        print(f"DEBUG: Starting print job", file=sys.stderr)
        print_result = printer.select_file(file_name)
        
        if print_result.status_code >= 200 and print_result.status_code < 300:
            print_started = True
            print(f"DEBUG: Print started successfully", file=sys.stderr)
        else:
            print(f"DEBUG: Failed to start print: {print_result.status_code}", file=sys.stderr)
    
    # Return success response
    print(json.dumps({
        "success": True,
        "message": "File uploaded" + (" and print started" if print_started else ""),
        "data": {
            "filename": file_name,
            "filesize": file_size,
            "upload_time": upload_time,
            "print_started": print_started
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
      // Clean up temp files
      try {
        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(scriptPath);
      } catch (err) { /* ignore */ }
      
      return NextResponse.json(
        { success: false, message: "Could not find Python executable. Please install Python 3." },
        { status: 500 }
      );
    }
    
    // Set timeout (5 minutes for large files)
    const timeoutId = setTimeout(() => {
      try {
        pythonProcess.kill();
      } catch (err) { /* ignore */ }
      
      // Clean up temp files
      try {
        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(scriptPath);
      } catch (err) { /* ignore */ }
      
      return NextResponse.json(
        { success: false, message: "Upload request timed out after 5 minutes" },
        { status: 504 }
      );
    }, 5 * 60 * 1000);
    
    // Collect output
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`[prusalink-upload] ${data.toString().trim()}`);
    });
    
    // Handle completion
    const response = await new Promise<NextResponse>((resolve) => {
      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Clean up temp files
        try {
          fs.unlinkSync(tempFilePath);
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
    console.error("Error uploading to PrusaLink printer:", error);
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