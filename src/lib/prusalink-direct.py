#!/usr/bin/env python3
"""
PrusaLink API wrapper using PrusaLinkPy library
This script provides direct access to PrusaLinkPy with proper error handling and timeouts
"""

import sys
import json
import traceback
import os
import time
import socket
from urllib3.util import Timeout

# Set longer socket timeouts for the entire process
socket.setdefaulttimeout(300)  # 5 minute timeout

# Command line arguments should be:
# 1. Command (status, upload, print, etc.)
# 2. IP address
# 3. API key
# 4. Additional parameters as needed

def main():
    """Main entry point for the PrusaLink API wrapper"""
    if len(sys.argv) < 4:
        print(json.dumps({
            "success": False,
            "message": "Not enough arguments. Usage: prusalink-direct.py <command> <ip> <api_key> [args...]"
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    ip_address = sys.argv[2]
    api_key = sys.argv[3]
    
    try:
        # Import PrusaLinkPy once to make sure it's available
        import PrusaLinkPy
        
        # Process the command
        if command == "status":
            result = get_status(ip_address, api_key)
        elif command == "upload":
            if len(sys.argv) < 5:
                print(json.dumps({
                    "success": False,
                    "message": "File path is required for upload command"
                }))
                sys.exit(1)
            file_path = sys.argv[4]
            remote_name = sys.argv[5] if len(sys.argv) > 5 else os.path.basename(file_path)
            print_after_upload = sys.argv[6].lower() == "true" if len(sys.argv) > 6 else False
            result = upload_file(ip_address, api_key, file_path, remote_name, print_after_upload)
        elif command == "print":
            if len(sys.argv) < 5:
                print(json.dumps({
                    "success": False,
                    "message": "File name is required for print command"
                }))
                sys.exit(1)
            file_name = sys.argv[4]
            result = start_print(ip_address, api_key, file_name)
        elif command == "stop":
            result = stop_print(ip_address, api_key)
        elif command == "connect":
            result = test_connection(ip_address, api_key)
        else:
            result = {
                "success": False,
                "message": f"Unknown command: {command}"
            }
        
        # Return the result as JSON
        print(json.dumps(result))
        
    except ImportError:
        print(json.dumps({
            "success": False,
            "message": "PrusaLinkPy not installed. Install with: pip install prusaLinkPy"
        }))
        sys.exit(1)
    except Exception as e:
        # Get full traceback for debugging
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
        
        print(json.dumps({
            "success": False,
            "message": str(e),
            "error": str(e),
            "traceback": "\n".join(traceback_details)
        }))
        sys.exit(1)

def get_status(ip_address, api_key):
    """Get the status of a PrusaLink printer"""
    import PrusaLinkPy
    
    # Create printer instance (no connect parameter)
    printer = PrusaLinkPy.PrusaLinkPy(ip_address, api_key)
    
    # Get version info to check connection
    version = printer.get_version()
    if version.status_code != 200:
        return {
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}"
        }
    
    # Get printer information
    printer_info = printer.get_printer()
    printer_data = printer_info.json() if printer_info.status_code == 200 else None
    
    # Get job information
    job_info = printer.get_job()
    job_data = job_info.json() if job_info.status_code == 200 else None
    
    # Return combined data
    return {
        "success": True,
        "data": {
            "version": version.json(),
            "printer": printer_data,
            "job": job_data,
            "connected": True
        }
    }

def upload_file(ip_address, api_key, file_path, remote_name, print_after_upload):
    """Upload a file to a PrusaLink printer and optionally start printing"""
    import PrusaLinkPy
    
    # Verify file exists
    if not os.path.exists(file_path):
        return {
            "success": False,
            "message": f"File not found: {file_path}"
        }
    
    # Get file size for logging
    file_size = os.path.getsize(file_path)
    print(f"Uploading file: {file_path} ({file_size / 1024 / 1024:.2f} MB)", file=sys.stderr)
    
    # Create printer instance
    printer = PrusaLinkPy.PrusaLinkPy(ip_address, api_key)
    
    # Check connection first
    version = printer.get_version()
    if version.status_code != 200:
        return {
            "success": False,
            "message": f"Failed to connect to printer: {version.status_code}"
        }
    
    # Check if file exists
    exists = printer.exists_gcode(remote_name)
    if exists:
        # Delete existing file
        print(f"Deleting existing file: {remote_name}", file=sys.stderr)
        delete_result = printer.delete(remote_name)
        if delete_result.status_code >= 400:
            print(f"Warning: Failed to delete existing file: {delete_result.status_code}", file=sys.stderr)
    
    # Upload the file
    print(f"Starting file upload...", file=sys.stderr)
    start_time = time.time()
    upload_result = printer.put_gcode(file_path, remote_name, print_after_upload)
    upload_time = time.time() - start_time
    print(f"Upload completed in {upload_time:.2f} seconds", file=sys.stderr)
    
    if upload_result.status_code >= 400:
        error_text = "Unknown error"
        try:
            error_text = upload_result.text
        except:
            pass
        
        return {
            "success": False,
            "message": f"Upload failed with status code: {upload_result.status_code}",
            "error": error_text
        }
    
    # Return success
    return {
        "success": True,
        "message": f"File uploaded successfully" + (" and print started" if print_after_upload else ""),
        "data": {
            "filename": remote_name,
            "upload_time": upload_time,
            "print_started": print_after_upload
        }
    }

def start_print(ip_address, api_key, file_name):
    """Start printing a file that's already on the printer"""
    import PrusaLinkPy
    
    # Create printer instance
    printer = PrusaLinkPy.PrusaLinkPy(ip_address, api_key)
    
    # Select file to print
    print_result = printer.select_file(file_name)
    
    if print_result.status_code >= 300:
        return {
            "success": False,
            "message": f"Failed to start print: {print_result.status_code}"
        }
    
    # Return success
    return {
        "success": True,
        "message": "Print started successfully",
        "data": {
            "filename": file_name
        }
    }

def stop_print(ip_address, api_key):
    """Stop the current print job"""
    import PrusaLinkPy
    
    # Create printer instance
    printer = PrusaLinkPy.PrusaLinkPy(ip_address, api_key)
    
    # Get job status to ensure it's printing
    job_info = printer.get_job()
    
    if job_info.status_code != 200:
        return {
            "success": False,
            "message": f"Failed to get job status: {job_info.status_code}"
        }
    
    job_data = job_info.json()
    if 'state' in job_data and job_data['state'] == 'Printing':
        # Cancel the print job
        cancel_result = printer.cancel()
        
        if cancel_result.status_code >= 300:
            return {
                "success": False,
                "message": f"Failed to cancel print job: {cancel_result.status_code}"
            }
        
        return {
            "success": True,
            "message": "Print job canceled successfully"
        }
    else:
        return {
            "success": False,
            "message": "No active print job to cancel"
        }

def test_connection(ip_address, api_key):
    """Test connection to a PrusaLink printer"""
    import PrusaLinkPy
    
    # Create printer instance
    printer = PrusaLinkPy.PrusaLinkPy(ip_address, api_key)
    
    # Get version info
    version = printer.get_version()
    
    # Get printer info if connected
    printer_info = None
    if version.status_code == 200:
        printer_info = printer.get_printer()
    
    # Return result
    return {
        "success": version.status_code == 200,
        "message": "Connection successful" if version.status_code == 200 else f"Failed to connect: {version.status_code}",
        "data": {
            "version": version.json() if version.status_code == 200 else None,
            "printer": printer_info.json() if printer_info and printer_info.status_code == 200 else None
        }
    }

if __name__ == "__main__":
    main() 