#!/usr/bin/env python3
import sys
import traceback
import socket
import json
import os

# Set timeout
socket.setdefaulttimeout(3)

try:
    # Try to import PrusaLinkPy
    import PrusaLinkPy
    
    # Print the version of PrusaLinkPy
    print("PrusaLinkPy version:", PrusaLinkPy.__version__ if hasattr(PrusaLinkPy, "__version__") else "Unknown")

    # Try with connect=True parameter
    print("Trying with connect=True parameter:")
    try:
        printer_with_connect = PrusaLinkPy.PrusaLinkPy("127.0.0.1", "test_api_key", connect=True)
        print("  Success with connect=True parameter")
    except Exception as connect_error:
        print("  Error with connect=True parameter:", str(connect_error))

    # Try with connect=False parameter
    print("Trying with connect=False parameter:")
    try:
        printer_with_connect_false = PrusaLinkPy.PrusaLinkPy("127.0.0.1", "test_api_key", connect=False)
        print("  Success with connect=False parameter")
    except Exception as connect_false_error:
        print("  Error with connect=False parameter:", str(connect_false_error))

    # Try with connect={} (object) parameter to reproduce error
    print("Trying with connect={} (object) parameter:")
    try:
        printer_with_connect_object = PrusaLinkPy.PrusaLinkPy("127.0.0.1", "test_api_key", connect={})
        print("  Success with connect={} parameter")
    except Exception as connect_object_error:
        print("  Error with connect={} parameter:", str(connect_object_error))
    
    # Try without extra parameters
    print("Trying without extra parameters:")
    printer = PrusaLinkPy.PrusaLinkPy("127.0.0.1", "test_api_key")
    print("  Success without extra parameters")
    
except Exception as e:
    # Get full traceback
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback_details = traceback.format_exception(exc_type, exc_value, exc_traceback)
    
    print("ERROR:", str(e))
    print("\n".join(traceback_details))
    sys.exit(1) 