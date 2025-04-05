#!/usr/bin/env node
/**
 * Test script for the PrusaLink direct Python integration
 * 
 * Usage: node test-prusalink-script.js <command> <printer-ip> <api-key> [args...]
 * 
 * Commands:
 *   status - Get printer status
 *   connect - Test connection
 *   upload <file-path> <remote-path> [--print] - Upload a file
 *   print <remote-path> - Start printing a file
 *   stop - Stop current print
 */

const prusaLinkBridge = require('./src/lib/prusalink-pure');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const printerIp = args[1];
  const apiKey = args[2];
  
  if (!command || !printerIp || !apiKey) {
    console.error('Usage: node test-prusalink-script.js <command> <printer-ip> <api-key> [args...]');
    process.exit(1);
  }
  
  try {
    let result;
    
    if (command === 'status') {
      console.log(`Getting status for ${printerIp}...`);
      result = await prusaLinkBridge.getJobStatus(printerIp, apiKey);
    } 
    else if (command === 'connect') {
      console.log(`Testing connection to ${printerIp}...`);
      result = await prusaLinkBridge.testConnection(printerIp, apiKey);
    }
    else if (command === 'upload') {
      const filePath = args[3];
      const remotePath = args[4];
      const printAfter = args.includes('--print');
      
      if (!filePath || !remotePath) {
        console.error('Usage: node test-prusalink-script.js upload <printer-ip> <api-key> <file-path> <remote-path> [--print]');
        process.exit(1);
      }
      
      console.log(`Uploading ${filePath} to ${printerIp} at ${remotePath}...`);
      result = await prusaLinkBridge.uploadFileToPrinter(printerIp, apiKey, filePath, remotePath, printAfter);
    }
    else if (command === 'print') {
      const remotePath = args[3];
      
      if (!remotePath) {
        console.error('Usage: node test-prusalink-script.js print <printer-ip> <api-key> <remote-path>');
        process.exit(1);
      }
      
      console.log(`Starting print of ${remotePath} on ${printerIp}...`);
      result = await prusaLinkBridge.startPrintJob(printerIp, apiKey, remotePath);
    }
    else if (command === 'stop') {
      console.log(`Stopping print on ${printerIp}...`);
      result = await prusaLinkBridge.stopPrintJob(printerIp, apiKey);
    }
    else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
    
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 