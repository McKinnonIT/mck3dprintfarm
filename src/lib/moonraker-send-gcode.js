// Moonraker GCode sender using Python API
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// We know python3 works from our test
const pythonExecutable = 'python3';

/**
 * Sends a GCode command to a Moonraker printer
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @param {string} gcode - The GCode command to send
 * @returns {Promise<object>} - Result of the operation
 */
async function sendGCode(printerUrl, apiKey, gcode) {
  return new Promise((resolve, reject) => {
    // Create a temporary Python script to execute
    const pythonScript = `
#!/usr/bin/env python3
import asyncio
import sys
import os
import json
import traceback
import socket
import urllib.parse

# Set a default socket timeout
socket.setdefaulttimeout(3)

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

async def main():
    try:
        # Get printer URL from arguments
        printer_url = "${printerUrl}"
        api_key = ${apiKey ? `"${apiKey}"` : 'None'}
        gcode = "${gcode.replace(/"/g, '\\"')}"
        
        # Parse URL to extract host and port
        parsed_url = urllib.parse.urlparse(printer_url)
        netloc = parsed_url.netloc
        
        # Split the host and port if specified
        if ':' in netloc:
            host, port = netloc.split(':')
            port = int(port)
        else:
            host = netloc
            port = 7125
        
        print(f"DEBUG: Connecting to Moonraker at {host}:{port}", file=sys.stderr)
        
        # Create a listener
        listener = MoonrakerListener()
        
        # Create client
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=listener,
            api_key=api_key,
            timeout=3
        )
        
        # Connect to client
        await client.connect()
        
        # Check if connection works by getting server info
        print(f"DEBUG: Testing connection with server.info", file=sys.stderr)
        server_info = await client.get_server_info()
        print(f"DEBUG: Server info: {server_info}", file=sys.stderr)
        
        # Send the GCode command
        print(f"DEBUG: Sending GCode: {gcode}", file=sys.stderr)
        result = await client.call_method("printer.gcode.script", script=gcode)
        print(f"DEBUG: GCode result: {result}", file=sys.stderr)
        
        # Return success response
        return {
            "success": True,
            "message": "GCode command sent successfully",
            "data": {
                "result": result
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
            "error": "".join(traceback_details)
        }

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": str(e),
            "error": traceback.format_exc()
        }))
`;
    
    // Create a temporary file for the script
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `moonraker_send_gcode_${Date.now()}.py`);
    
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Log command being executed for debugging
    console.log(`[moonraker-send-gcode] Executing: ${pythonExecutable} ${scriptPath}`);
    
    // Execute the Python script with a timeout
    const pythonProcess = spawn(pythonExecutable, [scriptPath]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`[moonraker-send-gcode] ${data.toString()}`);
    });
    
    // Set a timeout to kill the process if it takes too long
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      console.error('[moonraker-send-gcode] Process timed out after 30 seconds');
      
      resolve({
        success: false,
        message: 'Operation timed out after 30 seconds'
      });
    }, 30000);
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (error) {
        console.error(`[moonraker-send-gcode] Error deleting temporary script: ${error.message}`);
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error(`[moonraker-send-gcode] Error parsing Python output: ${error.message}`);
          console.error(`[moonraker-send-gcode] Raw output: ${output}`);
          
          resolve({
            success: false,
            message: 'Failed to parse Python script output',
            error: error.message,
            rawOutput: output
          });
        }
      } else {
        console.error(`[moonraker-send-gcode] Python process exited with code ${code}`);
        console.error(`[moonraker-send-gcode] Error output: ${errorOutput}`);
        
        resolve({
          success: false,
          message: `Python process exited with code ${code}`,
          error: errorOutput,
          rawOutput: output
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[moonraker-send-gcode] Python process error: ${error.message}`);
      
      resolve({
        success: false,
        message: error.message
      });
    });
  });
}

module.exports = { sendGCode }; 