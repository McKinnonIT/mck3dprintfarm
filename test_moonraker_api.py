#!/usr/bin/env python3
import asyncio
import sys
import os
from moonraker_api import MoonrakerClient, MoonrakerListener

async def test_moonraker_api():
    # Print Python and module info
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"moonraker_api module path: {os.path.abspath(os.path.dirname(sys.modules['moonraker_api'].__file__))}")
    
    # Replace with your Moonraker printer's URL and API key (if needed)
    printer_url = "http://192.168.1.212"  # Replace with your printer's IP
    api_key = None  # Replace with your API key if required
    
    # Extract host and port from URL properly
    import urllib.parse
    parsed_url = urllib.parse.urlparse(printer_url)
    netloc = parsed_url.netloc
    
    # Split the host and port if specified
    if ':' in netloc:
        host, port = netloc.split(':')
        port = int(port)
    else:
        host = netloc
        port = 7125
    
    print(f"Testing connection to Moonraker at {host}:{port}")
    
    try:
        # Create a dummy listener
        listener = MoonrakerListener()
        print("Created MoonrakerListener")
        
        # Connect to printer - pass host and port separately
        client = MoonrakerClient(
            host=host,
            port=port,
            listener=listener,
            api_key=api_key,
            timeout=3
        )
        print("Created MoonrakerClient")
        
        # Connect to the client
        print("Connecting to client...")
        await client.connect()
        print("Successfully connected to client")
        
        # Get server info
        print("Getting server info...")
        server_info = await client.get_server_info()
        print(f"Server info: {server_info}")
        
        # Get printer info
        print("\nGetting Klipper status...")
        klipper_status = await client.get_klipper_status()
        print(f"Klipper status: {klipper_status}")
        
        # Get information about supported methods
        print("\nGetting supported modules...")
        modules = await client.get_supported_modules()
        print(f"Supported modules: {modules}")
        
        # Try file operations using the generic call_method
        print("\nTrying to list files...")
        files = await client.call_method("server.files.list", root="gcodes")
        print(f"Files: {files}")
        
        # Try uploading a test file
        # Create a test file
        test_file_path = "/tmp/test_gcode.gcode"
        with open(test_file_path, "w") as f:
            f.write("; Test G-code file\nG28 ; Home all axes\n")
        
        print("\nTrying to upload a test file...")
        # We need to use the client.request method for uploads
        upload_params = {
            "path": test_file_path,
            "root": "gcodes"
        }
        
        # This is just a placeholder - actual file upload would need to use a different approach
        print("NOTE: Direct file upload not implemented in this test script")
        
        # Try sending a GCode command
        print("\nTrying to send a GCode command...")
        try:
            gcode_result = await client.call_method("printer.gcode.script", script="G28")
            print(f"GCode send result: {gcode_result}")
        except Exception as e:
            print(f"Error sending GCode: {str(e)}")
        
        print("\nTest completed successfully!")
        
        # Clean up
        await client.disconnect()
        return True
    except Exception as e:
        print(f"Error during test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_moonraker_api())
    sys.exit(0 if success else 1) 