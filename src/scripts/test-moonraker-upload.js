// Test script for Moonraker file upload
const { uploadAndPrint } = require('../lib/moonraker-bridge-py');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a test file
const testFilePath = path.join(os.tmpdir(), 'test_upload.gcode');

// Write some test GCode to the file
fs.writeFileSync(testFilePath, `; Test GCode file
G28 ; Home all axes
G1 Z10 F3000 ; Move Z up
G1 X100 Y100 F3000 ; Move to center
M84 ; Disable steppers
`);

console.log(`Created test file at: ${testFilePath}`);

// Configuration
const printerUrl = 'http://192.168.1.212'; // Update with your printer URL
const apiKey = null; // Update with your API key if required
const remoteName = 'test_upload_' + Date.now() + '.gcode';

// Test upload only
async function testUpload() {
  console.log(`Uploading file to ${printerUrl} as ${remoteName}`);
  
  try {
    const result = await uploadAndPrint(
      printerUrl,
      apiKey,
      testFilePath,
      remoteName,
      false // Don't print, just upload
    );
    
    console.log('Upload result:', result);
    
    if (result.success) {
      console.log('✅ Upload successful!');
    } else {
      console.log('❌ Upload failed:', result.message);
    }
  } catch (error) {
    console.error('Error during upload:', error);
  }
}

// Run the test
testUpload()
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