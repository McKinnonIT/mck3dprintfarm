#!/usr/bin/env python3
"""
Direct PrusaLink API Implementation using pyprusalink library
This script provides a bridge between the Node.js application and pyprusalink

Usage:
  python prusalink-direct.py status <printer_ip> <api_key>
  python prusalink-direct.py upload <printer_ip> <api_key> --file <file_path> --remote <remote_path> [--print-after]
  python prusalink-direct.py print <printer_ip> <api_key> --file <file_path>
  python prusalink-direct.py stop <printer_ip> <api_key>
  python prusalink-direct.py connect <printer_ip> <api_key>
"""

import sys
import os
import json
import argparse
import asyncio
from datetime import datetime
import traceback
import aiohttp
from aiohttp.client_exceptions import ClientError
from aiohttp import BasicAuth
import base64

# Function to print debug messages to stderr instead of stdout
def debug_print(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

async def test_connection(ip, api_key):
    """Test connection to the printer"""
    try:
        # Make sure the IP has a protocol prefix
        if not ip.startswith(('http://', 'https://')):
            ip = f'http://{ip}'
        
        # Create manual basic auth header - this matches exactly what we do in JS
        encoded_auth = base64.b64encode(f"maker:{api_key}".encode()).decode('utf-8')
        headers = {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            # Test a simple API endpoint first - version
            version_url = f"{ip}/api/version"
            debug_print(f"Testing connection to {version_url} with headers: {headers}")
            async with session.get(version_url, headers=headers) as response:
                if response.status != 200:
                    # Debug info
                    error_text = await response.text()
                    debug_print(f"Failed with status {response.status}: {error_text}")
                    
                    # Try alternative username = api_key as fallback
                    alt_encoded_auth = base64.b64encode(f"{api_key}:{api_key}".encode()).decode('utf-8')
                    alt_headers = {
                        'Authorization': f'Basic {alt_encoded_auth}',
                        'Content-Type': 'application/json'
                    }
                    
                    debug_print(f"Retrying with alternative auth: {alt_headers}")
                    async with session.get(version_url, headers=alt_headers) as alt_response:
                        if alt_response.status != 200:
                            debug_print(f"Alternative auth failed with status {alt_response.status}")
                            # Try a third option: username=api_key, password=""
                            third_encoded_auth = base64.b64encode(f"{api_key}:".encode()).decode('utf-8')
                            third_headers = {
                                'Authorization': f'Basic {third_encoded_auth}',
                                'Content-Type': 'application/json'
                            }
                            
                            debug_print(f"Trying third auth option: {third_headers}")
                            async with session.get(version_url, headers=third_headers) as third_response:
                                if third_response.status != 200:
                                    return {
                                        "success": False,
                                        "message": f"Failed to connect to printer at {ip}: HTTP {response.status}",
                                        "error": error_text,
                                        "alt_response": await alt_response.text(),
                                        "third_response": await third_response.text(),
                                        "tried_auth_methods": ["maker:api_key", "api_key:api_key", "api_key:"]
                                    }
                                else:
                                    # Third auth option worked
                                    version_data = await third_response.json()
                                    debug_print(f"Third auth option succeeded with {third_headers}")
                                    
                                    # Continue with third auth option for printer check
                                    printer_url = f"{ip}/api/printer"
                                    async with session.get(printer_url, headers=third_headers) as printer_response:
                                        is_ready = printer_response.status == 200
                                        printer_data = await printer_response.json() if is_ready else {}
                                    
                                    return {
                                        "success": True,
                                        "message": f"Successfully connected to printer at {ip} (using third auth option)",
                                        "data": {
                                            "api_info": version_data,
                                            "is_ready": is_ready,
                                            "printer": printer_data,
                                            "auth_type": "api_key:"
                                        }
                                    }
                        else:
                            # Alternative auth worked
                            version_data = await alt_response.json()
                            debug_print(f"Alternative auth succeeded with {alt_headers}")
                            
                            # Continue with alternative auth for printer check
                            printer_url = f"{ip}/api/printer"
                            async with session.get(printer_url, headers=alt_headers) as printer_response:
                                is_ready = printer_response.status == 200
                                printer_data = await printer_response.json() if is_ready else {}
                            
                            return {
                                "success": True,
                                "message": f"Successfully connected to printer at {ip} (using alternative auth)",
                                "data": {
                                    "api_info": version_data,
                                    "is_ready": is_ready,
                                    "printer": printer_data,
                                    "auth_type": "api_key:api_key"
                                }
                            }
                else:
                    # Original auth worked
                    version_data = await response.json()
                    debug_print(f"Original auth succeeded with {headers}")
                
                # Test printer readiness with original auth
                printer_url = f"{ip}/api/printer"
                async with session.get(printer_url, headers=headers) as response:
                    is_ready = response.status == 200
                    printer_data = await response.json() if is_ready else {}
            
            return {
                "success": True,
                "message": f"Successfully connected to printer at {ip}",
                "data": {
                    "api_info": version_data,
                    "is_ready": is_ready,
                    "printer": printer_data,
                    "auth_type": "maker:api_key"
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to connect to printer at {ip}",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

async def get_status(ip, api_key):
    """Get comprehensive status information from the printer"""
    try:
        # Make sure the IP has a protocol prefix
        if not ip.startswith(('http://', 'https://')):
            ip = f'http://{ip}'
        
        # Create manual basic auth header - this matches exactly what we do in JS
        encoded_auth = base64.b64encode(f"maker:{api_key}".encode()).decode('utf-8')
        headers = {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        # Try alternative auth if the first one fails
        alt_encoded_auth = base64.b64encode(f"{api_key}:{api_key}".encode()).decode('utf-8')
        alt_headers = {
            'Authorization': f'Basic {alt_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        # Third auth option: username=api_key, password=""
        third_encoded_auth = base64.b64encode(f"{api_key}:".encode()).decode('utf-8')
        third_headers = {
            'Authorization': f'Basic {third_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            # Define the API endpoints
            version_url = f"{ip}/api/version"
            printer_url = f"{ip}/api/printer"
            job_url = f"{ip}/api/job"
            temps_url = f"{ip}/api/printer/temps"
            
            # Try all three auth methods for version to determine which works
            debug_print(f"Testing connection to {version_url}")
            effective_headers = headers
            
            # First try with maker:api_key
            async with session.get(version_url, headers=headers) as response:
                if response.status != 200:
                    debug_print(f"First auth failed with {response.status}, trying alternative")
                    
                    # Try alternative auth (api_key:api_key)
                    async with session.get(version_url, headers=alt_headers) as alt_response:
                        if alt_response.status != 200:
                            debug_print(f"Second auth failed with {alt_response.status}, trying third option")
                            
                            # Try third auth option (api_key:)
                            async with session.get(version_url, headers=third_headers) as third_response:
                                if third_response.status != 200:
                                    return {
                                        "success": False,
                                        "message": f"Failed to get version info: HTTP {response.status}",
                                        "error": await response.text(),
                                        "tried_auth_methods": ["maker:api_key", "api_key:api_key", "api_key:"]
                                    }
                                else:
                                    # Use third auth for all subsequent calls
                                    effective_headers = third_headers
                                    api_info = await third_response.json()
                                    debug_print(f"Using third auth option: {third_headers}")
                        else:
                            # Use alternative auth for all subsequent calls
                            effective_headers = alt_headers
                            api_info = await alt_response.json()
                            debug_print(f"Using alternative auth: {alt_headers}")
                else:
                    # Original auth worked
                    api_info = await response.json()
                    debug_print(f"Using original auth: {headers}")
            
            # Get printer status with the effective headers
            async with session.get(printer_url, headers=effective_headers) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "message": f"Failed to get printer status: HTTP {response.status}",
                        "error": await response.text()
                    }
                printer_status = await response.json()
                printer_ready = True
            
            # Get job info
            job_info = None
            try:
                async with session.get(job_url, headers=effective_headers) as response:
                    if response.status == 200:
                        job_info = await response.json()
            except Exception as job_error:
                job_info = {"error": str(job_error)}
            
            # Get temperature data
            telemetry = {}
            try:
                async with session.get(temps_url, headers=effective_headers) as response:
                    if response.status == 200:
                        temps = await response.json()
                        telemetry = {
                            "temperature": {
                                "tool": temps.get("tool", {}).get("actual", 0),
                                "bed": temps.get("bed", {}).get("actual", 0),
                                "target_tool": temps.get("tool", {}).get("target", 0),
                                "target_bed": temps.get("bed", {}).get("target", 0)
                            }
                        }
            except Exception as temp_error:
                telemetry = {
                    "temperature": {
                        "error": str(temp_error)
                    }
                }
            
            # Format status data
            status_data = {
                "state": printer_status.get("state", {}).get("text", "unknown"),
                "print_time_elapsed": job_info.get("progress", {}).get("printTime") if job_info else 0,
                "print_time_remaining": job_info.get("progress", {}).get("printTimeLeft") if job_info else 0,
                "completion": job_info.get("progress", {}).get("completion") if job_info else 0,
                "job_name": job_info.get("file", {}).get("name", "") if job_info else ""
            }
            
            # Determine which auth method was used
            auth_type = "maker:api_key"
            if effective_headers == alt_headers:
                auth_type = "api_key:api_key"
            elif effective_headers == third_headers:
                auth_type = "api_key:"
            
            return {
                "success": True,
                "data": {
                    "printer": printer_status,
                    "telemetry": telemetry,
                    "status": status_data,
                    "raw_endpoints": {
                        "api_info": api_info,
                        "job": job_info,
                        "printer": printer_status
                    },
                    "auth_type": auth_type
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get printer status: {str(e)}",
            "error": traceback.format_exc()
        }

async def upload_file(ip, api_key, file_path, remote_path, print_after=False):
    """Upload a file to the printer and optionally start printing"""
    try:
        if not os.path.exists(file_path):
            return {
                "success": False,
                "message": f"File not found: {file_path}",
                "error": "The specified file does not exist"
            }
        
        # Make sure the IP has a protocol prefix
        if not ip.startswith(('http://', 'https://')):
            ip = f'http://{ip}'
        
        # Create manual auth headers - we'll try each method
        encoded_auth = base64.b64encode(f"maker:{api_key}".encode()).decode('utf-8')
        headers = {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        alt_encoded_auth = base64.b64encode(f"{api_key}:{api_key}".encode()).decode('utf-8')
        alt_headers = {
            'Authorization': f'Basic {alt_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        third_encoded_auth = base64.b64encode(f"{api_key}:".encode()).decode('utf-8')
        third_headers = {
            'Authorization': f'Basic {third_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            # First determine which auth method works by testing the version endpoint
            debug_print(f"Determining working auth method for {ip}")
            version_url = f"{ip}/api/version"
            
            # Try each auth method
            async with session.get(version_url, headers=headers) as response:
                if response.status == 200:
                    effective_headers = headers
                    debug_print("Using maker:api_key auth")
                else:
                    async with session.get(version_url, headers=alt_headers) as alt_response:
                        if alt_response.status == 200:
                            effective_headers = alt_headers
                            debug_print("Using api_key:api_key auth")
                        else:
                            async with session.get(version_url, headers=third_headers) as third_response:
                                if third_response.status == 200:
                                    effective_headers = third_headers
                                    debug_print("Using api_key: auth")
                                else:
                                    return {
                                        "success": False,
                                        "message": "Failed to authenticate with printer",
                                        "error": "None of the authentication methods worked",
                                        "status_codes": [response.status, alt_response.status, third_response.status]
                                    }
            
            # Convert remote path if needed
            if not remote_path:
                remote_path = os.path.basename(file_path)
            
            # Define the API endpoints
            upload_url = f"{ip}/api/files/local"
            
            # Read file data
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Create form with file data
            form = aiohttp.FormData()
            form.add_field('file', 
                          file_data,
                          filename=os.path.basename(file_path),
                          content_type='application/octet-stream')
            
            # Set path parameter
            params = {'path': remote_path}
            
            # Upload the file with effective auth headers
            debug_print(f"Uploading file to {upload_url}")
            async with session.post(upload_url, data=form, params=params, headers=effective_headers) as response:
                if response.status != 201:  # 201 Created is the success status
                    return {
                        "success": False,
                        "message": f"Failed to upload file: HTTP {response.status}",
                        "error": await response.text()
                    }
                
                upload_result = await response.json()
            
            # Start printing if requested
            if print_after:
                try:
                    # Define the API endpoint for selecting/printing file
                    select_url = f"{ip}/api/files/local/{remote_path}"
                    data = {'print': True}
                    
                    # Send the request to start printing
                    debug_print(f"Starting print of {remote_path}")
                    async with session.post(select_url, json=data, headers=effective_headers) as response:
                        if response.status != 200:
                            return {
                                "success": True,
                                "message": f"File uploaded but failed to start print: HTTP {response.status}",
                                "data": {
                                    "upload": upload_result,
                                    "print_error": await response.text()
                                }
                            }
                        
                        print_result = await response.json()
                        
                        return {
                            "success": True,
                            "message": f"File uploaded and print started: {remote_path}",
                            "data": {
                                "upload": upload_result,
                                "print": print_result
                            }
                        }
                except Exception as print_error:
                    return {
                        "success": True,
                        "message": f"File uploaded but failed to start print: {str(print_error)}",
                        "data": {
                            "upload": upload_result
                        },
                        "print_error": str(print_error)
                    }
            
            return {
                "success": True,
                "message": f"File uploaded successfully: {remote_path}",
                "data": {
                    "upload": upload_result
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to upload file: {str(e)}",
            "error": traceback.format_exc()
        }

async def start_print(ip, api_key, file_path):
    """Start printing a file that is already on the printer"""
    try:
        # Make sure the IP has a protocol prefix
        if not ip.startswith(('http://', 'https://')):
            ip = f'http://{ip}'
        
        # Create manual auth headers - we'll try each method
        encoded_auth = base64.b64encode(f"maker:{api_key}".encode()).decode('utf-8')
        headers = {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        alt_encoded_auth = base64.b64encode(f"{api_key}:{api_key}".encode()).decode('utf-8')
        alt_headers = {
            'Authorization': f'Basic {alt_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        third_encoded_auth = base64.b64encode(f"{api_key}:".encode()).decode('utf-8')
        third_headers = {
            'Authorization': f'Basic {third_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            # First determine which auth method works by testing the version endpoint
            debug_print(f"Determining working auth method for {ip}")
            version_url = f"{ip}/api/version"
            
            # Try each auth method
            async with session.get(version_url, headers=headers) as response:
                if response.status == 200:
                    effective_headers = headers
                    debug_print("Using maker:api_key auth")
                else:
                    async with session.get(version_url, headers=alt_headers) as alt_response:
                        if alt_response.status == 200:
                            effective_headers = alt_headers
                            debug_print("Using api_key:api_key auth")
                        else:
                            async with session.get(version_url, headers=third_headers) as third_response:
                                if third_response.status == 200:
                                    effective_headers = third_headers
                                    debug_print("Using api_key: auth")
                                else:
                                    return {
                                        "success": False,
                                        "message": "Failed to authenticate with printer",
                                        "error": "None of the authentication methods worked",
                                        "status_codes": [response.status, alt_response.status, third_response.status]
                                    }
            
            # Define the API endpoint for selecting/printing file
            select_url = f"{ip}/api/files/local/{file_path}"
            data = {'print': True}
            
            # Send the request to start printing
            debug_print(f"Starting print of {file_path}")
            async with session.post(select_url, json=data, headers=effective_headers) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "message": f"Failed to start print: HTTP {response.status}",
                        "error": await response.text()
                    }
                
                print_result = await response.json()
                
                return {
                    "success": True,
                    "message": f"Print started: {file_path}",
                    "data": print_result
                }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to start print: {str(e)}",
            "error": traceback.format_exc()
        }

async def stop_print(ip, api_key):
    """Stop the current print job"""
    try:
        # Make sure the IP has a protocol prefix
        if not ip.startswith(('http://', 'https://')):
            ip = f'http://{ip}'
        
        # Create manual auth headers - we'll try each method
        encoded_auth = base64.b64encode(f"maker:{api_key}".encode()).decode('utf-8')
        headers = {
            'Authorization': f'Basic {encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        alt_encoded_auth = base64.b64encode(f"{api_key}:{api_key}".encode()).decode('utf-8')
        alt_headers = {
            'Authorization': f'Basic {alt_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        third_encoded_auth = base64.b64encode(f"{api_key}:".encode()).decode('utf-8')
        third_headers = {
            'Authorization': f'Basic {third_encoded_auth}',
            'Content-Type': 'application/json'
        }
        
        async with aiohttp.ClientSession() as session:
            # First determine which auth method works by testing the version endpoint
            debug_print(f"Determining working auth method for {ip}")
            version_url = f"{ip}/api/version"
            
            # Try each auth method
            async with session.get(version_url, headers=headers) as response:
                if response.status == 200:
                    effective_headers = headers
                    debug_print("Using maker:api_key auth")
                else:
                    async with session.get(version_url, headers=alt_headers) as alt_response:
                        if alt_response.status == 200:
                            effective_headers = alt_headers
                            debug_print("Using api_key:api_key auth")
                        else:
                            async with session.get(version_url, headers=third_headers) as third_response:
                                if third_response.status == 200:
                                    effective_headers = third_headers
                                    debug_print("Using api_key: auth")
                                else:
                                    return {
                                        "success": False,
                                        "message": "Failed to authenticate with printer",
                                        "error": "None of the authentication methods worked",
                                        "status_codes": [response.status, alt_response.status, third_response.status]
                                    }
            
            # Define the API endpoint for canceling the print job
            cancel_url = f"{ip}/api/job"
            data = {'command': 'cancel'}
            
            # Send the request to cancel the print
            debug_print(f"Stopping print job")
            async with session.post(cancel_url, json=data, headers=effective_headers) as response:
                if response.status != 204:  # 204 No Content is the success status
                    return {
                        "success": False,
                        "message": f"Failed to stop print: HTTP {response.status}",
                        "error": await response.text()
                    }
                
                return {
                    "success": True,
                    "message": "Print job stopped successfully"
                }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to stop print: {str(e)}",
            "error": traceback.format_exc()
        }

async def main():
    # Setup command line argument parsing
    parser = argparse.ArgumentParser(description="PrusaLink API Client")
    parser.add_argument("command", help="Command to execute (status, upload, print, stop, connect)")
    parser.add_argument("printer_ip", help="IP address of the printer")
    parser.add_argument("api_key", help="API key for authentication")
    parser.add_argument("--file", help="Path to the file for upload or print commands")
    parser.add_argument("--remote", help="Remote path for the uploaded file")
    parser.add_argument("--print-after", action="store_true", help="Start printing after upload")
    
    try:
        args = parser.parse_args()
        result = {}
        
        if args.command == "connect":
            result = await test_connection(args.printer_ip, args.api_key)
        
        elif args.command == "status":
            result = await get_status(args.printer_ip, args.api_key)
        
        elif args.command == "upload":
            if not args.file:
                result = {
                    "success": False,
                    "message": "File path is required for upload command",
                    "error": "Missing required argument: --file"
                }
            else:
                result = await upload_file(
                    args.printer_ip, 
                    args.api_key, 
                    args.file, 
                    args.remote, 
                    args.print_after
                )
        
        elif args.command == "print":
            if not args.file:
                result = {
                    "success": False,
                    "message": "File path is required for print command",
                    "error": "Missing required argument: --file"
                }
            else:
                result = await start_print(args.printer_ip, args.api_key, args.file)
        
        elif args.command == "stop":
            result = await stop_print(args.printer_ip, args.api_key)
        
        else:
            result = {
                "success": False,
                "message": f"Unknown command: {args.command}",
                "error": "Valid commands are: status, upload, print, stop, connect"
            }
        
        # Output the result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": f"Command failed: {str(e)}",
            "error": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 