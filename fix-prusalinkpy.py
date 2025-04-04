#!/usr/bin/env python3
"""
This script fixes issues with the PrusaLinkPy library's handling of the connect parameter.

The issue: PrusaLinkPy treats the 'connect' parameter as a timeout value but fails to validate
its type, causing errors when non-numeric values (especially objects from JavaScript/TypeScript)
are passed.

Usage:
1. Run this script before importing PrusaLinkPy:
   ```
   import fix_prusalinkpy
   fix_prusalinkpy.apply()
   import PrusaLinkPy
   ```

2. Or copy the fix_prusalinkpy function directly into your code:
   ```
   def fix_prusalinkpy():
       # (copy function content from below)
       pass
   
   fix_prusalinkpy()
   import PrusaLinkPy
   ```

Example:
   ```
   import fix_prusalinkpy
   fix_prusalinkpy.apply()
   
   import PrusaLinkPy
   
   # This will now work correctly
   printer = PrusaLinkPy.PrusaLinkPy("127.0.0.1", "api_key", connect={})
   ```
"""

import sys
import logging
import importlib.util
import os
import traceback

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('fix_prusalinkpy')

def find_prusalinkpy_path():
    """Attempts to locate the installation path of PrusaLinkPy."""
    try:
        spec = importlib.util.find_spec('PrusaLinkPy')
        if spec is None:
            logger.warning("PrusaLinkPy module not found. Install with: pip install prusaLinkPy")
            return None
        
        module_path = spec.origin
        logger.info(f"Found PrusaLinkPy at: {module_path}")
        return os.path.dirname(module_path)
    except Exception as e:
        logger.error(f"Error finding PrusaLinkPy path: {e}")
        return None

def original_to_patched_init(original_init):
    """Create a patched version of the __init__ method that validates the connect parameter."""
    def patched_init(self, ip, api_key, **kwargs):
        # Extract connect parameter if present
        connect = kwargs.pop('connect', None)
        
        # Log the parameter value
        logger.debug(f"connect parameter: {connect!r} (type: {type(connect).__name__})")
        
        # If connect is a dictionary, object, or anything other than a number, bool, or None, 
        # replace it with None
        if not isinstance(connect, (bool, int, float, type(None))):
            logger.warning(f"Invalid connect parameter type: {type(connect).__name__}. Setting to None.")
            connect = None
        
        # Only pass connect parameter if it's a valid type
        if connect is not None:
            kwargs['connect'] = connect
            
        # Call the original init with sanitized parameters
        return original_init(self, ip, api_key, **kwargs)
    
    return patched_init

def patch_prusalinkpy_class():
    """Patch the PrusaLinkPy class's __init__ method."""
    try:
        import PrusaLinkPy
        
        # Store the original __init__ method
        original_init = PrusaLinkPy.PrusaLinkPy.__init__
        
        # Replace with our patched version
        PrusaLinkPy.PrusaLinkPy.__init__ = original_to_patched_init(original_init)
        
        logger.info("Successfully patched PrusaLinkPy.__init__ to handle invalid connect parameters")
        return True
    except ImportError:
        logger.error("PrusaLinkPy not installed. Install with: pip install prusaLinkPy")
        return False
    except Exception as e:
        logger.error(f"Failed to patch PrusaLinkPy: {e}")
        traceback.print_exc()
        return False

def apply():
    """Apply the monkey patch to PrusaLinkPy."""
    return patch_prusalinkpy_class()

# When run as script
if __name__ == "__main__":
    if apply():
        print("✅ PrusaLinkPy successfully patched!")
        print("You can now import PrusaLinkPy in your script.")
        sys.exit(0)
    else:
        print("❌ Failed to patch PrusaLinkPy.")
        print("Check the error messages above.")
        sys.exit(1) 