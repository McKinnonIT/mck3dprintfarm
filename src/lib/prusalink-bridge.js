// A bridge module for PrusaLink API connectivity
// Now directly uses HTTP API instead of Python

/**
 * Returns an object indicating to use HTTP API directly
 */
async function getPrinterStatus(printerIp, apiKey, debug = false) {
  if (debug) {
    console.log("[prusalink-bridge] Using HTTP API directly");
  }
  
  return {
    success: false,
    message: 'Using HTTP API directly instead of PrusaLinkPy',
    useHttpFallback: true
  };
}

/**
 * For compatibility with existing code
 */
function getActiveProcessCount() {
  return 0;
}

/**
 * Uploads a file to a PrusaLink printer and optionally starts printing
 * This is now just a stub that returns an error - should be replaced with direct HTTP implementation
 */
async function uploadAndPrint(printerIp, apiKey, filePath, remoteName = '', printAfterUpload = false) {
      return Promise.reject({
        success: false,
    message: 'File upload is now implemented using direct HTTP API. This legacy bridge function is no longer supported.',
    error: 'Method not implemented'
  });
}

/**
 * Tests connection to a PrusaLink printer
 * This is now just a stub that returns an error - should be replaced with direct HTTP implementation
 */
async function testConnection(printerIp, apiKey) {
      return Promise.reject({
        success: false,
    message: 'Connection testing is now implemented using direct HTTP API. This legacy bridge function is no longer supported.',
    error: 'Method not implemented'
  });
}

/**
 * Gets detailed job status from a PrusaLink printer
 * This is now just a stub that returns an error - should be replaced with direct HTTP implementation
 */
async function getJobStatus(printerIp, apiKey) {
      return Promise.reject({
        success: false,
    message: 'Job status is now implemented using direct HTTP API. This legacy bridge function is no longer supported.',
    error: 'Method not implemented'
  });
}

module.exports = {
  uploadAndPrint,
  testConnection,
  getJobStatus,
  getPrinterStatus,
  getActiveProcessCount
}; 