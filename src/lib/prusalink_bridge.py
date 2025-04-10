#!/usr/bin/env python3

import argparse
import sys
import json
import asyncio
import os
# Import only the client module needed for auth
from pyprusalink import client as pyprusalink_client 
# PrusaLink class import is unused
# from pyprusalink import PrusaLink 
# ConflictBehaviour enum does not exist in installed v2.1.1
# from pyprusalink.types import ConflictBehaviour 
# aiohttp imports are unused as we use httpx
# from aiohttp import ClientError, ClientResponseError
import traceback # Import traceback
from httpx import AsyncClient # Import httpx AsyncClient
# Import the specific error type as well
from pyprusalink.types import PrusaLinkError

# Wrapper function to handle async operations and print JSON result
async def run_prusalink_command(ip, apikey, filepath, filename, print_now):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Simple log to stdout for Docker capture (can be refined later)
    def log_message(message):
        """Prints a log message to stdout."""
        print(f"[Python Bridge Log] {message}", file=sys.stderr) # Log to stderr

    log_message(f"--- Starting PrusaLink command ---")
    log_message(f"Args: ip={ip}, apikey={'*' * len(apikey) if apikey else 'None'}, filepath={filepath}, filename={filename}, print_now={print_now}")

    # Basic validation
    if not os.path.exists(filepath):
        result = {"success": False, "message": f"File not found on server: {filepath}", "error": "File does not exist"}
        log_message(f"Error: {result['message']}")
        print(json.dumps(result)) # Print JSON result to stdout
        return
    if not ip or not apikey:
        result = {"success": False, "message": "Printer IP and API Key are required", "error": "Missing credentials"}
        log_message(f"Error: {result['message']}")
        print(json.dumps(result)) # Print JSON result to stdout
        return

    result = None # Initialize result
    host_url = f"http://{ip}"

    try:
        # Create an httpx client with Digest Auth from pyprusalink's ApiClient
        # We need the ApiClient instance just to get the configured auth object
        temp_api_client = pyprusalink_client.ApiClient(AsyncClient(), host_url, 'maker', apikey)
        digest_auth = temp_api_client._auth
        await temp_api_client._async_client.aclose() # Close the dummy client

        async with AsyncClient(timeout=120.0, auth=digest_auth) as http_client: # Increase timeout for upload
            log_message(f"Preparing PrusaLink connection/upload to {host_url}...")
            
            # 1. Test connection using get_version via raw request
            try:
                log_message("Attempting GET /api/version for connection test...")
                version_response = await http_client.get(f"{host_url}/api/version")
                version_response.raise_for_status() # Raise HTTP errors
                version_info = version_response.json()
                log_message(f"Successfully connected. PrusaLink Version: {version_info.get('version', 'N/A')}")
            except Exception as connect_err:
                 log_message(f"Error during initial connection/version check: {connect_err}")
                 raise PrusaLinkError(f"Failed initial connection test: {connect_err}") from connect_err

            # 2. Upload the file using POST request to /api/v1/files/usb endpoint
            #    This endpoint appears to handle both upload and starting the print implicitly.
            upload_path_v1_usb = f"/api/v1/files/usb/{filename}" # Use V1 USB path
            upload_url = f"{host_url}{upload_path_v1_usb}"
            log_message(f"Attempting to upload '{filepath}' via POST to V1 USB '{upload_url}' (Implicit print start: {print_now})...")
            
            try:
                with open(filepath, 'rb') as f:
                    file_content = f.read()
                
                log_message(f"Read {len(file_content)} bytes from file. Sending POST request...")
                upload_response = await http_client.post(
                    upload_url, # Use V1 USB URL
                    content=file_content,
                    headers={'Content-Type': 'application/octet-stream'}
                )
                # Check for 201 Created or 204 No Content
                if upload_response.status_code not in [201, 204]:
                    log_message(f"Unexpected status code {upload_response.status_code} during POST V1 USB upload/print. Response: {await upload_response.aread()}")
                upload_response.raise_for_status() # Raise HTTP errors (4xx, 5xx)
                log_message(f"Upload/Print command via POST to V1 USB successful (Status: {upload_response.status_code}).")
            except Exception as upload_err:
                log_message(f"Error during file upload: {upload_err}")
                # Include response details if available
                error_details = str(upload_err)
                if hasattr(upload_err, 'response') and upload_err.response is not None:
                     try:
                         error_details += f" Response: {await upload_err.response.aread()}"
                     except Exception:
                         pass # Ignore error reading response body
                raise PrusaLinkError(f"Failed upload/print via POST to V1 USB: {error_details}") from upload_err

            # If upload was successful, report overall success
            result = {"success": True, "message": f"File '{filename}' uploaded. Print started implicitly: {print_now}"}
            log_message(f"Result: Success - {result['message']}")

    except PrusaLinkError as e:
        error_message = f"PrusaLink API Error: {str(e)}"
        tb_str = traceback.format_exc()
        log_message(f"Result: Failure (PrusaLinkError) - Type: {type(e).__name__} - Message: {error_message}")
        log_message(f"Traceback:\n{tb_str}")
        result = {"success": False, "message": error_message, "error": repr(e), "details": f"{type(e).__name__}: {str(e)}"}
    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}"
        tb_str = traceback.format_exc()
        log_message(f"Result: Failure (Exception) - Type: {type(e).__name__} - Message: {error_message} - Repr: {repr(e)}")
        log_message(f"Exception Traceback:\n{tb_str}")
        result = {"success": False, "message": error_message, "error": repr(e), "details": f"{type(e).__name__}: {str(e)}"}

    log_message(f"--- Ending PrusaLink command --- Result: {result}")
    # Ensure result is always a dict before dumping
    if result is None:
        log_message("Critical error: Result was not set before final print.")
        result = {"success": False, "message": "Internal script error: No result generated.", "error": "InternalError"}

    print(json.dumps(result)) # Print JSON result to stdout

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Upload a file to a PrusaLink printer and optionally start printing.')
    parser.add_argument('--ip', required=True, help='IP address of the PrusaLink printer.')
    parser.add_argument('--apikey', required=True, help='API key (password) for the printer.')
    parser.add_argument('--filepath', required=True, help='Absolute path to the file on the server to upload.')
    parser.add_argument('--filename', required=True, help='Filename to use on the printer.')
    parser.add_argument('--printnow', action='store_true', help='Start printing immediately after upload.')

    args = parser.parse_args()

    # Run the async function
    asyncio.run(run_prusalink_command(args.ip, args.apikey, args.filepath, args.filename, args.printnow)) 