// Test script for moonraker-api
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create temporary file
const tempDir = os.tmpdir();
const scriptPath = path.join(tempDir, `test_moonraker_api_${Date.now()}.py`);

console.log('Creating test script at:', scriptPath);

// Write test script
const pythonScript = `
#!/usr/bin/env python3
import sys
import json

print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"System paths:")
for p in sys.path:
    print(f"  - {p}")

try:
    import moonraker_api
    print(f"\\nSUCCESS: Found moonraker_api package")
    
    # Get version without directly accessing __version__
    try:
        print(f"Version: {getattr(moonraker_api, '__version__', 'Unknown')}")
    except Exception:
        print("Could not determine version")
    
    # Check the location
    try:
        print(f"Location: {moonraker_api.__file__}")
    except Exception:
        print("Could not determine location")
    
    # Try to import some classes
    from moonraker_api import MoonrakerClient, MoonrakerListener
    print(f"Successfully imported MoonrakerClient and MoonrakerListener")
    
    # Test creating a client with minimal configuration
    try:
        listener = MoonrakerListener()
        client = MoonrakerClient(host="127.0.0.1:7125", listener=listener)
        print("Successfully created MoonrakerClient instance")
    except Exception as e:
        print(f"Error creating client: {str(e)}")
    
    sys.exit(0)
except ImportError as e:
    print(f"\\nERROR: {str(e)}")
    print("Failed to import moonraker_api")
    
    # Try pip list to see installed packages
    import subprocess
    try:
        print("\\nInstalled packages:")
        result = subprocess.run([sys.executable, '-m', 'pip', 'list'], 
                               stdout=subprocess.PIPE, 
                               stderr=subprocess.PIPE,
                               text=True)
        print(result.stdout)
    except Exception as e:
        print(f"Error running pip list: {str(e)}")
    
    sys.exit(1)
except Exception as e:
    print(f"\\nUNEXPECTED ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(2)
`;

fs.writeFileSync(scriptPath, pythonScript);

// Function to try a Python executable
async function tryPython(pythonCmd) {
  return new Promise((resolve) => {
    console.log(`\nTrying with ${pythonCmd}...`);
    
    const process = spawn(pythonCmd, [scriptPath]);
    
    process.stdout.on('data', (data) => {
      console.log(`[${pythonCmd}] ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      console.error(`[${pythonCmd} ERROR] ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
      console.log(`\n${pythonCmd} process exited with code ${code}`);
      
      if (code === 0) {
        console.log(`SUCCESS: ${pythonCmd} can import moonraker_api`);
        resolve(true);
      } else {
        console.log(`FAIL: ${pythonCmd} cannot import moonraker_api`);
        resolve(false);
      }
    });
  });
}

// Try different Python executables
async function main() {
  console.log('Testing different Python executables...');
  
  const pythonCommands = ['python3', 'python', 'py'];
  let success = false;
  
  for (const cmd of pythonCommands) {
    if (await tryPython(cmd)) {
      success = true;
      console.log(`\n✅ ${cmd} is suitable for use with moonraker-api`);
      break;
    }
  }
  
  if (!success) {
    console.log('\n❌ None of the tested Python executables can import moonraker-api');
    console.log('Please install moonraker-api with: pip install moonraker-api');
  }
  
  // Clean up
  try {
    fs.unlinkSync(scriptPath);
    console.log('\nCleaned up temporary file');
  } catch (error) {
    console.error('Error deleting temporary file:', error);
  }
}

// Run the test
main().catch(error => {
  console.error('Error running test:', error);
}); 