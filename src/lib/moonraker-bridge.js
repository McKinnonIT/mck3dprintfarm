const fs = require('fs');
// Use cross-fetch which works in both Node.js and browser environments
const fetch = require('cross-fetch');
const FormData = require('form-data');
const path = require('path');

/**
 * Uploads a file to a Moonraker printer and optionally starts printing
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @param {string} filePath - Path to the file to upload
 * @param {string} remoteName - Name to use for the file on the printer
 * @param {boolean} printAfterUpload - Whether to start printing after upload
 * @returns {Promise<object>} - Result of the operation
 */
async function uploadAndPrint(printerUrl, apiKey, filePath, remoteName = '', printAfterUpload = false) {
  try {
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    console.log(`[DEBUG] Moonraker uploading file to ${printerUrl}`);
    console.log(`[DEBUG] File: ${filePath}`);
    console.log(`[DEBUG] Remote name: ${remoteName}`);
    console.log(`[DEBUG] Print after upload: ${printAfterUpload}`);
    
    // If no remote name is provided, use the original filename
    if (!remoteName) {
      remoteName = path.basename(filePath);
    }
    
    // Check if the file is a .gcode file (Moonraker only supports .gcode)
    if (remoteName.toLowerCase().endsWith('.bgcode')) {
      console.error('[DEBUG] Moonraker only supports .gcode files, not .bgcode');
      return {
        success: false,
        message: 'Moonraker printers only support .gcode files, not .bgcode files'
      };
    }
    
    // Read file
    let fileData;
    try {
      fileData = fs.readFileSync(filePath);
      console.log(`[DEBUG] Read file ${filePath}, size: ${fileData.length} bytes`);
    } catch (readError) {
      console.error('[DEBUG] Error reading file:', readError);
      return {
        success: false,
        message: readError instanceof Error ? readError.message : String(readError)
      };
    }
    
    // Create headers with authentication if provided
    const headers = {};
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileData, {
      filename: remoteName,
      contentType: 'application/octet-stream'
    });
    
    // Try upload endpoints
    const uploadEndpoints = [
      '/server/files/upload',
      '/api/files/local'
    ];
    
    let uploadSuccess = false;
    let uploadResult = null;
    let uploadError = null;
    
    for (const endpoint of uploadEndpoints) {
      try {
        console.log(`[DEBUG] Trying to upload to ${printerUrl}${endpoint}`);
        
        // Get form headers and merge with auth headers
        const formHeaders = formData.getHeaders();
        const uploadHeaders = {
          ...formHeaders,
          ...headers
        };
        
        console.log(`[DEBUG] Upload headers: ${JSON.stringify(uploadHeaders)}`);
        
        const response = await fetch(`${printerUrl}${endpoint}`, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData
        });
        
        console.log(`[DEBUG] Upload response status: ${response.status}`);
        
        const responseText = await response.text();
        console.log(`[DEBUG] Upload response: ${responseText}`);
        
        if (response.ok) {
          // Parse response if it's JSON
          let responseData = {};
          try {
            if (responseText && responseText.trim()) {
              responseData = JSON.parse(responseText);
            }
          } catch (parseError) {
            console.log(`[DEBUG] Response parse error: ${parseError.message}`);
          }
          
          uploadSuccess = true;
          uploadResult = {
            success: true,
            message: 'File uploaded successfully',
            data: {
              path: remoteName,
              ...responseData
            }
          };
          break;
        } else {
          uploadError = `Upload failed with status ${response.status}: ${responseText}`;
        }
      } catch (error) {
        console.error(`[DEBUG] Error uploading to ${endpoint}:`, error);
        uploadError = error.message || String(error);
      }
    }
    
    if (!uploadSuccess) {
      return {
        success: false,
        message: uploadError || 'Failed to upload file to Moonraker'
      };
    }
    
    // Start printing if requested
    if (printAfterUpload) {
      try {
        console.log(`[DEBUG] Starting print for file: ${remoteName}`);
        
        // Try different print endpoints
        const printEndpoints = [
          { url: '/printer/print/start', method: 'POST', body: { filename: remoteName } },
          { url: '/api/files/local/' + remoteName, method: 'POST', body: { command: 'select' } },
          { url: '/api/files/local/' + remoteName, method: 'POST', body: { command: 'print' } }
        ];
        
        let printSuccess = false;
        let printError = null;
        
        for (const endpoint of printEndpoints) {
          try {
            console.log(`[DEBUG] Trying to start print with ${endpoint.url}`);
            
            const response = await fetch(`${printerUrl}${endpoint.url}`, {
              method: endpoint.method,
              headers: {
                'Content-Type': 'application/json',
                ...headers
              },
              body: JSON.stringify(endpoint.body)
            });
            
            console.log(`[DEBUG] Print start response status: ${response.status}`);
            
            const responseText = await response.text();
            console.log(`[DEBUG] Print start response: ${responseText}`);
            
            if (response.ok) {
              printSuccess = true;
              break;
            } else {
              printError = `Print start failed with status ${response.status}: ${responseText}`;
            }
          } catch (error) {
            console.error(`[DEBUG] Error starting print with ${endpoint.url}:`, error);
            printError = error.message || String(error);
          }
        }
        
        if (!printSuccess) {
          return {
            success: false,
            message: printError || 'Failed to start print'
          };
        }
        
        return {
          success: true,
          message: 'File uploaded and print started successfully',
          data: uploadResult.data
        };
      } catch (error) {
        console.error('[DEBUG] Error starting print:', error);
        return {
          success: false,
          message: `File uploaded but failed to start print: ${error.message}`
        };
      }
    }
    
    return uploadResult;
  } catch (error) {
    console.error('[DEBUG] Error in uploadAndPrint:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tests connection to a Moonraker printer
 * @param {string} printerUrl - URL of the Moonraker instance
 * @param {string} apiKey - API key for Moonraker (if required)
 * @returns {Promise<object>} - Result of the test
 */
async function testConnection(printerUrl, apiKey) {
  try {
    // Normalize the printer URL
    printerUrl = printerUrl.trim();
    if (printerUrl.endsWith('/')) {
      printerUrl = printerUrl.slice(0, -1);
    }
    
    console.log(`[DEBUG] Testing connection to Moonraker at ${printerUrl}`);
    
    // Create headers with authentication if provided
    const headers = {};
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }
    
    // Try different endpoints to check connection
    const endpoints = [
      '/printer/info',
      '/server/info',
      '/api/server/info'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[DEBUG] Trying endpoint: ${endpoint}`);
        
        const response = await fetch(`${printerUrl}${endpoint}`, {
          method: 'GET',
          headers
        });
        
        console.log(`[DEBUG] Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            message: 'Successfully connected to Moonraker',
            data
          };
        }
      } catch (error) {
        console.error(`[DEBUG] Error testing endpoint ${endpoint}:`, error);
      }
    }
    
    return {
      success: false,
      message: 'Failed to connect to Moonraker'
    };
  } catch (error) {
    console.error('[DEBUG] Error in testConnection:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

module.exports = {
  uploadAndPrint,
  testConnection
}; 