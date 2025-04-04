/**
 * Simple PrusaLink bridge that uses a dedicated Python script
 * This avoids any issues with complex bridging logic or handling connect parameters
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get the absolute path to the Python script
const PYTHON_SCRIPT_PATH = path.join(__dirname, 'prusalink-direct.py');

// Make the Python script executable if it isn't already
try {
  fs.chmodSync(PYTHON_SCRIPT_PATH, '755');
} catch (err) {
  console.error(`Warning: Could not make Python script executable: ${err.message}`);
}

/**
 * Find a working Python executable
 * @returns {Promise<string>} Path to the Python executable
 */
async function findPythonExecutable() {
  // Try different Python executable names
  const pythonExecutables = ['python3', 'python', 'py'];
  
  for (const executable of pythonExecutables) {
    try {
      const { stdout } = require('child_process').execSync(`${executable} --version`, { encoding: 'utf8' });
      if (stdout.includes('Python 3')) {
        return executable;
      }
    } catch (err) {
      // Try next executable
    }
  }
  
  // No Python found
  throw new Error('Python 3 is not installed or not found in PATH. Please install Python 3.');
}

/**
 * Calls the Python script with the given arguments
 * @param {string[]} args - Arguments to pass to the Python script
 * @returns {Promise<object>} Result of the Python script
 */
async function callPythonScript(args) {
  // Find Python executable
  const pythonExecutable = await findPythonExecutable();
  
  return new Promise((resolve, reject) => {
    // Launch the Python script
    const pythonProcess = spawn(pythonExecutable, [PYTHON_SCRIPT_PATH, ...args]);
    
    let output = '';
    let errorOutput = '';
    
    // Set a long timeout for the process (10 minutes)
    const timeoutDuration = 10 * 60 * 1000; // 10 minutes
    const timeoutId = setTimeout(() => {
      console.error(`Python process timed out after ${timeoutDuration/1000} seconds`);
      pythonProcess.kill();
      reject({
        success: false,
        message: `Process timed out after ${timeoutDuration/1000} seconds`
      });
    }, timeoutDuration);
    
    // Collect output
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect error output
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Log the output for debugging
      console.log(`[PrusaLink Python] ${data.toString().trim()}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          console.error(`Failed to parse Python output: ${error.message}`);
          console.error(`Raw output: ${output}`);
          console.error(`Error output: ${errorOutput}`);
          
          reject({
            success: false,
            message: 'Failed to parse Python output',
            error: error.message,
            output: output,
            stderr: errorOutput
          });
        }
      } else {
        try {
          // Try to parse error output as JSON
          const errorResult = JSON.parse(output);
          reject(errorResult);
        } catch (error) {
          // If we can't parse as JSON, use the raw output
          reject({
            success: false,
            message: 'Python script failed',
            error: errorOutput || output || `Process exited with code ${code}`,
            code
          });
        }
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      reject({
        success: false,
        message: `Failed to start Python process: ${error.message}`,
        error: error.message
      });
    });
  });
}

/**
 * Gets the status of a PrusaLink printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key for the printer
 * @returns {Promise<object>} Printer status
 */
async function getJobStatus(printerIp, apiKey) {
  console.log(`Getting status for printer at ${printerIp}`);
  return callPythonScript(['status', printerIp, apiKey]);
}

/**
 * Uploads a file to a PrusaLink printer and optionally starts printing
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key for the printer
 * @param {string} filePath - Path to the file to upload
 * @param {string} remoteName - Name to give the file on the printer
 * @param {boolean} printAfterUpload - Whether to start printing after upload
 * @returns {Promise<object>} Upload result
 */
async function uploadAndPrint(printerIp, apiKey, filePath, remoteName = '', printAfterUpload = false) {
  console.log(`Uploading file ${filePath} to printer at ${printerIp}`);
  if (!remoteName) {
    remoteName = path.basename(filePath);
  }
  return callPythonScript(['upload', printerIp, apiKey, filePath, remoteName, printAfterUpload.toString()]);
}

/**
 * Starts printing a file that's already on the printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key for the printer
 * @param {string} fileName - Name of the file to print
 * @returns {Promise<object>} Print result
 */
async function startPrint(printerIp, apiKey, fileName) {
  console.log(`Starting print of ${fileName} on printer at ${printerIp}`);
  return callPythonScript(['print', printerIp, apiKey, fileName]);
}

/**
 * Stops the current print job
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key for the printer
 * @returns {Promise<object>} Stop result
 */
async function stopPrintJob(printerIp, apiKey) {
  console.log(`Stopping print job on printer at ${printerIp}`);
  return callPythonScript(['stop', printerIp, apiKey]);
}

/**
 * Tests connection to a PrusaLink printer
 * @param {string} printerIp - IP address of the printer
 * @param {string} apiKey - API key for the printer
 * @returns {Promise<object>} Connection test result
 */
async function testConnection(printerIp, apiKey) {
  console.log(`Testing connection to printer at ${printerIp}`);
  return callPythonScript(['connect', printerIp, apiKey]);
}

module.exports = {
  getJobStatus,
  uploadAndPrint,
  startPrint,
  stopPrintJob,
  testConnection
}; 