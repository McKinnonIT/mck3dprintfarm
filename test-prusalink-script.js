/**
 * Test script for the PrusaLink direct Python implementation
 * Usage: node test-prusalink-script.js <command> <printer-ip> <api-key> [args...]
 */

const prusaLink = require('./src/lib/prusalink-pure');

async function main() {
  // Get command line arguments
  const [,, command, printerIp, apiKey, ...args] = process.argv;
  
  if (!command || !printerIp || !apiKey) {
    console.error('Usage: node test-prusalink-script.js <command> <printer-ip> <api-key> [args...]');
    console.error('Commands: status, upload, print, stop, connect');
    process.exit(1);
  }
  
  try {
    let result;
    
    // Process the command
    switch (command) {
      case 'status':
        result = await prusaLink.getJobStatus(printerIp, apiKey);
        break;
        
      case 'upload':
        if (args.length < 1) {
          console.error('Error: File path is required for upload command');
          process.exit(1);
        }
        const filePath = args[0];
        const remoteName = args[1] || '';
        const printAfterUpload = args[2] === 'true';
        result = await prusaLink.uploadAndPrint(printerIp, apiKey, filePath, remoteName, printAfterUpload);
        break;
        
      case 'print':
        if (args.length < 1) {
          console.error('Error: File name is required for print command');
          process.exit(1);
        }
        const fileName = args[0];
        result = await prusaLink.startPrint(printerIp, apiKey, fileName);
        break;
        
      case 'stop':
        result = await prusaLink.stopPrintJob(printerIp, apiKey);
        break;
        
      case 'connect':
        result = await prusaLink.testConnection(printerIp, apiKey);
        break;
        
      default:
        console.error(`Error: Unknown command: ${command}`);
        process.exit(1);
    }
    
    // Display the result
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 