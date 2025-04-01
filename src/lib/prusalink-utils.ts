import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  status: string;
  operationalStatus: string;
};

/**
 * Creates authentication headers for PrusaLink API
 */
export function createPrusaLinkHeaders(printer: Printer): Record<string, string> {
  if (!printer.apiKey) {
    console.log("[PrusaLink] No API key provided");
    return {};
  }
  
  console.log("[PrusaLink] Creating headers with 'maker' username");
  
  // PrusaLink uses Basic Auth with username "maker" and password as the API key
  const encodedAuth = Buffer.from(`maker:${printer.apiKey}`).toString('base64');
  return {
    'Authorization': `Basic ${encodedAuth}`
  };
}

/**
 * Uploads a file to a PrusaLink printer
 */
export async function uploadToPrusaLink(
  printer: Printer, 
  filePath: string, 
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Read file data
    let fileData;
    try {
      fileData = fs.readFileSync(filePath);
      console.log(`[PrusaLink] Read file ${filePath} (${fileData.length} bytes)`);
    } catch (error) {
      console.error('[PrusaLink] Error reading file:', error);
      return {
        success: false,
        message: `Failed to read file: ${error.message}`
      };
    }
    
    // Get authentication headers
    const authHeaders = createPrusaLinkHeaders(printer);
    console.log("[PrusaLink] Auth headers:", JSON.stringify(authHeaders));
    
    // Method 1: Try direct upload first (most reliable for auth)
    try {
      const encodedFileName = encodeURIComponent(fileName);
      const directUrl = `${printer.apiUrl}/api/files/local?filename=${encodedFileName}`;
      
      const directHeaders = {
        ...authHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileData.length.toString()
      };
      
      console.log(`[PrusaLink] Trying direct upload to: ${directUrl}`);
      
      const directResponse = await fetch(directUrl, {
        method: 'POST', 
        headers: directHeaders,
        body: fileData
      });
      
      console.log(`[PrusaLink] Direct upload status: ${directResponse.status}`);
      
      const directText = await directResponse.text();
      console.log(`[PrusaLink] Direct upload response: ${directText}`);
      
      if (directResponse.ok) {
        let data = {};
        try {
          if (directText && directText.trim()) {
            data = JSON.parse(directText);
          }
        } catch (error) {
          console.log(`[PrusaLink] JSON parse error: ${error.message}`);
        }
        
        return {
          success: true,
          message: 'File uploaded successfully using direct method',
          data: {
            path: `local/${fileName}`,
            ...data
          }
        };
      }
      
      // If authentication failed, don't try other methods
      if (directResponse.status === 401) {
        throw new Error(`Authentication failed: ${directResponse.status} ${directText}`);
      }
      
      // If not auth error, continue to try FormData method
    } catch (error) {
      console.log(`[PrusaLink] Direct upload error: ${error.message}`);
      
      // Don't continue if it's an auth error
      if (error.message.includes('Authentication failed')) {
        throw error;
      }
    }
    
    // Method 2: Try FormData upload
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', fileData, {
        filename: fileName,
        contentType: 'application/octet-stream'
      });
      
      // Get FormData headers
      const formHeaders = formData.getHeaders();
      
      // Combine headers, making sure auth comes last to override
      const uploadHeaders = {
        ...formHeaders,
        ...authHeaders
      };
      
      console.log(`[PrusaLink] FormData upload headers: ${JSON.stringify(uploadHeaders)}`);
      
      const uploadUrl = `${printer.apiUrl}/api/files/local`;
      
      console.log(`[PrusaLink] Trying FormData upload to: ${uploadUrl}`);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });
      
      console.log(`[PrusaLink] FormData upload status: ${response.status}`);
      
      const responseText = await response.text();
      console.log(`[PrusaLink] FormData upload response: ${responseText}`);
      
      if (response.ok) {
        let data = {};
        try {
          if (responseText && responseText.trim()) {
            data = JSON.parse(responseText);
          }
        } catch (error) {
          console.log(`[PrusaLink] JSON parse error: ${error.message}`);
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
      
      throw new Error(`Upload failed: ${response.status} ${responseText}`);
    } catch (error) {
      console.log(`[PrusaLink] FormData upload error: ${error.message}`);
      throw error;
    }
  } catch (error) {
    console.error('[PrusaLink] Upload error:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Starts a print job on a PrusaLink printer
 */
export async function printWithPrusaLink(
  printer: Printer, 
  uploadResponse: any,
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Safety checks
    if (!uploadResponse) {
      return {
        success: false,
        message: 'Invalid upload response'
      };
    }
    
    // Get authentication headers
    const authHeaders = createPrusaLinkHeaders(printer);
    
    // Prepare content headers
    const headers = {
      ...authHeaders,
      'Content-Type': 'application/json'
    };
    
    // Determine file path
    let printPath = '';
    
    // Extract path from upload response
    if (uploadResponse.data?.files?.local?.path) {
      printPath = uploadResponse.data.files.local.path;
    } else if (uploadResponse.data?.path) {
      printPath = uploadResponse.data.path;
    } else if (uploadResponse.path) {
      printPath = uploadResponse.path;
    } else {
      // Default to standard location
      printPath = `local/${fileName}`;
    }
    
    console.log(`[PrusaLink] Using print path: ${printPath}`);
    
    // Method 1: Try the OctoPrint-compatible select endpoint
    try {
      const selectUrl = `${printer.apiUrl}/api/files/${printPath}/select`;
      
      console.log(`[PrusaLink] Starting print via select endpoint: ${selectUrl}`);
      
      const selectResponse = await fetch(selectUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ print: true })
      });
      
      console.log(`[PrusaLink] Select endpoint status: ${selectResponse.status}`);
      
      const selectText = await selectResponse.text();
      console.log(`[PrusaLink] Select endpoint response: ${selectText}`);
      
      if (selectResponse.ok) {
        let data = {};
        try {
          if (selectText && selectText.trim()) {
            data = JSON.parse(selectText);
          }
        } catch (error) {
          console.log(`[PrusaLink] JSON parse error: ${error.message}`);
        }
        
        return {
          success: true,
          message: 'Print job started successfully',
          data
        };
      }
      
      // Try alternative method if select failed with 404 or 410
      if (selectResponse.status === 404 || selectResponse.status === 410) {
        // Method 2: Try the direct print endpoint
        const encodedFileName = encodeURIComponent(fileName);
        const printUrl = `${printer.apiUrl}/api/files/local/${encodedFileName}/print`;
        
        console.log(`[PrusaLink] Trying direct print endpoint: ${printUrl}`);
        
        const printResponse = await fetch(printUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({})
        });
        
        console.log(`[PrusaLink] Direct print status: ${printResponse.status}`);
        
        const printText = await printResponse.text();
        console.log(`[PrusaLink] Direct print response: ${printText}`);
        
        if (printResponse.ok) {
          let data = {};
          try {
            if (printText && printText.trim()) {
              data = JSON.parse(printText);
            }
          } catch (error) {
            console.log(`[PrusaLink] JSON parse error: ${error.message}`);
          }
          
          return {
            success: true,
            message: 'Print job started successfully with direct endpoint',
            data
          };
        }
        
        throw new Error(`All print methods failed. Last status: ${printResponse.status}`);
      }
      
      throw new Error(`Print failed: ${selectResponse.status} ${selectText}`);
    } catch (error) {
      console.log(`[PrusaLink] Print error: ${error.message}`);
      throw error;
    }
  } catch (error) {
    console.error('[PrusaLink] Print error:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Tests connection to a PrusaLink printer
 */
export async function testPrusaLink(
  printer: Printer
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Get authentication headers
    const headers = createPrusaLinkHeaders(printer);
    
    // Try multiple endpoints to see what works
    const endpoints = [
      { url: `${printer.apiUrl}/api/version`, name: 'Version' },
      { url: `${printer.apiUrl}/api/printer`, name: 'Printer Status' },
      { url: `${printer.apiUrl}/api/files`, name: 'Files' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[PrusaLink] Testing endpoint: ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers
        });
        
        console.log(`[PrusaLink] ${endpoint.name} status: ${response.status}`);
        
        if (response.ok) {
          const text = await response.text();
          let data;
          
          try {
            data = JSON.parse(text);
            console.log(`[PrusaLink] ${endpoint.name} data:`, data);
          } catch (error) {
            console.log(`[PrusaLink] ${endpoint.name} not JSON:`, text);
            data = { text };
          }
          
          results.push({
            endpoint: endpoint.name,
            status: response.status,
            working: true,
            data
          });
        } else {
          results.push({
            endpoint: endpoint.name,
            status: response.status,
            working: false
          });
        }
      } catch (error) {
        console.log(`[PrusaLink] ${endpoint.name} error:`, error.message);
        results.push({
          endpoint: endpoint.name,
          working: false,
          error: error.message
        });
      }
    }
    
    const workingEndpoints = results.filter(r => r.working);
    
    if (workingEndpoints.length > 0) {
      return {
        success: true,
        message: `Connected to PrusaLink (${workingEndpoints.length}/${endpoints.length} endpoints working)`,
        data: { results }
      };
    }
    
    return {
      success: false,
      message: 'No PrusaLink endpoints responded successfully',
      data: { results }
    };
  } catch (error) {
    console.error('[PrusaLink] Connection test error:', error);
    return {
      success: false,
      message: error.message
    };
  }
} 