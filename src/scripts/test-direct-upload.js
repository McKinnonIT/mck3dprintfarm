// Test script for direct file upload to Moonraker using HTTP
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Create a test file
const testFilePath = path.join(os.tmpdir(), 'test_direct_upload.gcode');

// Write some test GCode to the file
fs.writeFileSync(testFilePath, `; Test GCode file for direct upload
G28 ; Home all axes
G1 Z10 F3000 ; Move Z up
G1 X100 Y100 F3000 ; Move to center
M84 ; Disable steppers
`);

console.log(`Created test file at: ${testFilePath}`);

// Configuration
const printerUrl = 'http://192.168.1.212:7125'; // Make sure to include the port
const apiKey = null; // Update with your API key if required
const remoteName = 'test_direct_upload_' + Date.now() + '.gcode';

// Test upload directly using HTTP
async function testDirectUpload() {
  console.log(`Uploading file to ${printerUrl} as ${remoteName}`);
  
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: remoteName,
      contentType: 'application/octet-stream'
    });
    form.append('root', 'gcodes');
    
    // Add headers
    const headers = form.getHeaders();
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }
    
    // Upload URL
    const uploadUrl = `${printerUrl}/server/files/upload`;
    console.log(`Uploading to: ${uploadUrl}`);
    
    // Send the request
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
      headers
    });
    
    // Handle response
    const status = response.status;
    let result;
    
    try {
      result = await response.json();
    } catch (error) {
      result = await response.text();
    }
    
    console.log(`Response status: ${status}`);
    console.log('Response:', result);
    
    if (status === 200 || status === 201) {
      console.log('✅ Direct upload successful!');
    } else {
      console.log('❌ Direct upload failed');
    }
  } catch (error) {
    console.error('Error during direct upload:', error);
  }
}

// Run the test
testDirectUpload()
  .catch(console.error)
  .finally(() => {
    // Clean up the test file
    try {
      fs.unlinkSync(testFilePath);
      console.log('Cleaned up test file');
    } catch (err) {
      console.error('Error cleaning up test file:', err);
    }
  }); 