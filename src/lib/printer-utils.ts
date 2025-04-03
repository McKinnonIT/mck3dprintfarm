import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  serialNumber?: string;
  status: string;
  operationalStatus: string;
};

/**
 * Creates authentication headers for printer API requests
 */
export function createPrinterAuthHeaders(printer: Printer): Record<string, string> {
  // Check if there's an API key
  if (!printer.apiKey) {
    return {};
  }
  
  // For PrusaLink, special handling of auth headers
  if (printer.type.toLowerCase().includes('prusa')) {
    console.log(`[DEBUG] Creating auth headers for PrusaLink printer using hardcoded username "maker" with API key as password`);
    
    // PrusaLink uses Basic Auth with username "maker" and password as the API key
    const encodedAuth = Buffer.from(`maker:${printer.apiKey}`).toString('base64');
    return {
      'Authorization': `Basic ${encodedAuth}`
    };
  }
  
  // For Moonraker, use X-Api-Key header
  if (printer.type.toLowerCase() === 'moonraker') {
    return {
      'X-Api-Key': printer.apiKey
    };
  }
  
  // For other printer types, just use X-Api-Key header
  return {
    'X-Api-Key': printer.apiKey
  };
}

/**
 * Uploads a file to a printer
 */
export async function uploadFileToPrinter(
  printer: Printer, 
  filePath: string, 
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Read file
    let fileData;
    try {
      fileData = fs.readFileSync(filePath);
      console.log(`[DEBUG] Read file ${filePath}, size: ${fileData.length} bytes`);
    } catch (readError) {
      console.error('Error reading file:', readError);
      return {
        success: false,
        message: readError instanceof Error ? readError.message : String(readError)
      };
    }
    
    // Create headers with authentication
    const authHeaders = createPrinterAuthHeaders(printer);
    console.log("[DEBUG] Authentication headers:", JSON.stringify(authHeaders));
    
    // For PrusaLink printers
    if (printer.type.toLowerCase().includes('prusa')) {
      // Try direct upload first - avoids FormData header issues
      try {
        console.log("[PrusaLink] Trying direct upload approach first");
        
        const encodedFileName = encodeURIComponent(fileName);
        const directUrl = `${printer.apiUrl}/api/files/local?filename=${encodedFileName}`;
        
        const directHeaders = {
          ...authHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileData.length.toString()
        };
        
        console.log(`[PrusaLink] Direct upload to: ${directUrl}`);
        console.log("[PrusaLink] Direct upload headers:", JSON.stringify(directHeaders));
        
        const directResponse = await fetch(directUrl, {
          method: 'POST',
          headers: directHeaders,
          body: fileData
        });
        
        console.log(`[DEBUG] Direct upload status: ${directResponse.status}`);
        
        let directText = '';
        try {
          directText = await directResponse.text();
          console.log(`[DEBUG] Direct upload response: ${directText}`);
        } catch (error) {
          console.log(`[DEBUG] Could not read direct response: ${error.message}`);
        }
        
        if (directResponse.ok) {
          let directData = {};
          try {
            if (directText && directText.trim()) {
              directData = JSON.parse(directText);
            }
          } catch (error) {
            console.log(`[DEBUG] Direct response parse error: ${error.message}`);
          }
          
          return {
            success: true,
            message: 'File uploaded successfully using direct method',
            data: {
              path: `local/${fileName}`,
              ...directData
            }
          };
        }
        
        if (directResponse.status === 401) {
          // If auth failed, don't try other methods
          throw new Error(`Authentication failed: ${directResponse.status} ${directText}`);
        }
        
        console.log(`[PrusaLink] Direct upload failed: ${directResponse.status}`);
        // Fall through to try FormData approach
      } catch (directError) {
        console.log(`[PrusaLink] Direct upload error: ${directError.message}`);
        if (directError.message.includes('Authentication failed')) {
          throw directError; // Don't try other methods if auth failed
        }
      }
      
      // Main approach: Create form data with correct structure for PrusaLink
      try {
        // Create form data with correct structure for PrusaLink
        const formData = new FormData();
        
        // Add file to FormData
        formData.append('file', fileData, {
          filename: fileName,
          contentType: 'application/octet-stream'
        });
        
        const uploadUrl = `${printer.apiUrl}/api/files/local`;
        
        console.log(`[PrusaLink] Trying FormData upload to: ${uploadUrl}`);
        
        // IMPORTANT: Get the formData headers and combine with our auth headers
        const formHeaders = formData.getHeaders();
        console.log("[DEBUG] FormData headers:", JSON.stringify(formHeaders));
        
        // Make sure the auth headers override anything from FormData
        const uploadHeaders = {
          ...formHeaders,
          ...authHeaders  // Auth headers come AFTER formHeaders to override
        };
        
        console.log("[DEBUG] Final upload headers with auth:", JSON.stringify(uploadHeaders));
        
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData
        });
        
        console.log(`[DEBUG] FormData upload response status: ${response.status}`);
        
        let responseText = '';
        try {
          responseText = await response.text();
          console.log(`[DEBUG] FormData upload response body: ${responseText}`);
        } catch (error) {
          console.log(`[DEBUG] Could not read response text: ${error.message}`);
        }
        
        if (response.ok) {
          let data = {};
          try {
            if (responseText && responseText.trim()) {
              data = JSON.parse(responseText);
            }
          } catch (error) {
            console.log(`[DEBUG] Response parse error: ${error.message}`);
          }
          
          return {
            success: true,
            message: 'File uploaded successfully using FormData',
            data: {
              path: `local/${fileName}`,
              ...data
            }
          };
        }
        
        throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
      } catch (error) {
        console.log(`[PrusaLink] FormData upload error: ${error.message}`);
        throw error;
      }
    } else if (printer.type.toLowerCase() === 'moonraker') {
      // For Moonraker printers, use moonraker-bridge-py.js
      const moonrakerBridge = require('./moonraker-bridge-py');
      try {
        console.log(`[Moonraker] Uploading file to Moonraker at ${printer.apiUrl}`);
        const result = await moonrakerBridge.uploadAndPrint(
          printer.apiUrl,
          printer.apiKey,
          filePath,
          fileName,
          false // Don't start print yet, we'll handle that separately if requested
        );
        
        console.log(`[Moonraker] Upload result:`, result);
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to upload file to Moonraker');
        }
        
        return result;
      } catch (error) {
        console.error('[Moonraker] Upload error:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      // For other printer types
      return {
        success: false,
        message: `Upload not implemented for printer type: ${printer.type}`
      }
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Starts printing a file that has been uploaded to a printer
 */
export async function startPrintJob(
  printer: Printer, 
  uploadResponse: any,
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Detailed logging of uploadResponse to catch any structural issues
    console.log('[DEBUG] startPrintJob received uploadResponse:', 
      typeof uploadResponse === 'object' ? JSON.stringify(uploadResponse, null, 2) : typeof uploadResponse);
    
    // Add safety checks for uploadResponse structure
    if (!uploadResponse) {
      return {
        success: false,
        message: 'Invalid upload response: response is null or undefined'
      };
    }
    
    if (typeof uploadResponse !== 'object') {
      return {
        success: false,
        message: `Invalid upload response: expected object, got ${typeof uploadResponse}`
      };
    }
    
    // PrusaLink-specific printing
    if (printer.type.toLowerCase().includes('prusa')) {
      console.log('[DEBUG] Starting print job for PrusaLink printer');
      
      // Create authentication headers
      const authHeaders = createPrinterAuthHeaders(printer);
      
      // Extract the file path from upload response
      const filePath = uploadResponse.data?.path;
      if (!filePath) {
        return {
          success: false,
          message: 'Invalid upload response: missing file path'
        };
      }
      
      console.log(`[DEBUG] Starting print for file: ${filePath}`);
      
      // Send request to start printing the file
      const response = await fetch(`${printer.apiUrl}/api/files/local/${filePath.replace('local/', '')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          command: 'select',
          print: true
        })
      });
      
      console.log(`[DEBUG] Print start response status: ${response.status}`);
      
      let responseText = '';
      try {
        responseText = await response.text();
        console.log(`[DEBUG] Print start response body: ${responseText}`);
      } catch (error) {
        console.log(`[DEBUG] Could not read response text: ${error.message}`);
      }
      
      if (response.ok) {
        return {
          success: true,
          message: 'Print job started successfully',
          data: responseText ? JSON.parse(responseText) : {}
        };
      }
      
      return {
        success: false,
        message: `Failed to start print job: ${response.status} ${responseText}`
      };
    } else if (printer.type.toLowerCase() === 'moonraker') {
      // For Moonraker printers
      console.log('[DEBUG] Starting print job for Moonraker printer');
      
      // Get path from the upload response
      const filePath = uploadResponse.data?.path;
      if (!filePath) {
        return {
          success: false,
          message: 'Invalid upload response: missing file path'
        };
      }
      
      console.log(`[DEBUG] File path from upload response: ${filePath}`);
      
      // Use moonraker-bridge-py to print the file
      const moonrakerBridge = require('./moonraker-bridge-py');
      
      // We'll do a new upload and print request since that's the most reliable way
      try {
        console.log(`[Moonraker] Starting print for file: ${fileName}`);
        const result = await moonrakerBridge.uploadAndPrint(
          printer.apiUrl,
          printer.apiKey,
          uploadResponse.data._localFilePath || fileName, // Use local path if available
          filePath,
          true // Start printing
        );
        
        console.log(`[Moonraker] Print start result:`, result);
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to start print job');
        }
        
        return {
          success: true,
          message: 'Print job started successfully',
          data: result.data
        };
      } catch (error) {
        console.error('[Moonraker] Print start error:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      return {
        success: false,
        message: `Print not implemented for printer type: ${printer.type}`
      };
    }
  } catch (error) {
    console.error('Error starting print job:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tests connectivity to a generic printer API (non-PrusaLink)
 */
export async function testPrinterConnection(
  printer: Printer
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    if (printer.type.toLowerCase().includes('prusa')) {
      // For PrusaLink printers, use the prusalink-utils.ts functions instead
      return {
        success: false,
        message: 'Use PrusaLink-specific test function for PrusaLink printers'
      };
    }
    
    // For non-PrusaLink printers
    // Create headers
    const headers = createPrinterAuthHeaders(printer);
    
    // Generic printer test endpoint
    const apiUrl = `${printer.apiUrl}/api/version`;
    
    console.log(`[Generic Printer] Testing connection to: ${apiUrl}`);
    
    // Send request
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to connect to printer: ${response.status} ${errorText}`);
    }
    
    let data;
    try {
      const text = await response.text();
      data = text && text.trim() ? JSON.parse(text) : {};
    } catch (error) {
      console.log(`[Generic Printer] Response not JSON: ${error.message}`);
      data = { status: 'connected' };
    }
    
    return {
      success: true,
      message: 'Successfully connected to printer',
      data
    };
  } catch (error) {
    console.error('Error connecting to printer:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}