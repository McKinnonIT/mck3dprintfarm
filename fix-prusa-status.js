#!/usr/bin/env node
/**
 * Test script for Prusa printer status
 * Usage: node fix-prusa-status.js <printer-ip> <api-key>
 */

const prusaLinkBridge = require('./src/lib/prusalink-bridge');

async function main() {
  // Get the printer IP and API key from command line
  const [printerIp, apiKey] = process.argv.slice(2);
  
  if (!printerIp || !apiKey) {
    console.error('Usage: node fix-prusa-status.js <printer-ip> <api-key>');
    process.exit(1);
  }
  
  console.log(`Testing printer status for ${printerIp}...`);
  
  try {
    console.log('Fetching status from PrusaLinkPy bridge...');
    const status = await prusaLinkBridge.getJobStatus(printerIp, apiKey);
    console.log('Status result:', JSON.stringify(status, null, 2));
    
    // Check for critical telemetry data
    console.log('\n===== PRINTER TELEMETRY SUMMARY =====');
    
    // Check if we got basic state
    const printerState = status.data?.printer?.state?.text || 'unknown';
    console.log(`Printer state: ${printerState}`);
    
    // Check if we got temperature data
    let bedTempFound = false;
    let nozzleTempFound = false;
    
    if (status.data?.printer?.temp_bed !== undefined) {
      console.log(`✅ Bed temperature: ${status.data.printer.temp_bed}°C`);
      bedTempFound = true;
    } else if (status.data?.telemetry?.["temp-bed"] !== undefined) {
      console.log(`✅ Bed temperature (telemetry): ${status.data.telemetry["temp-bed"]}°C`);
      bedTempFound = true;
    } else if (status.data?.raw_endpoints && status.data.raw_endpoints['/api/printer']?.temperature?.bed?.actual) {
      console.log(`✅ Bed temperature (raw endpoint): ${status.data.raw_endpoints['/api/printer'].temperature.bed.actual}°C`);
      bedTempFound = true;
    } else {
      console.log('❌ No bed temperature data found');
    }
    
    if (status.data?.printer?.temp_nozzle !== undefined) {
      console.log(`✅ Nozzle temperature: ${status.data.printer.temp_nozzle}°C`);
      nozzleTempFound = true;
    } else if (status.data?.telemetry?.["temp-nozzle"] !== undefined) {
      console.log(`✅ Nozzle temperature (telemetry): ${status.data.telemetry["temp-nozzle"]}°C`);
      nozzleTempFound = true;
    } else if (status.data?.raw_endpoints && status.data.raw_endpoints['/api/printer']?.temperature?.tool0?.actual) {
      console.log(`✅ Nozzle temperature (raw endpoint): ${status.data.raw_endpoints['/api/printer'].temperature.tool0.actual}°C`);
      nozzleTempFound = true;
    } else {
      console.log('❌ No nozzle temperature data found');
    }
    
    // Check for progress data
    let progressFound = false;
    if (status.data?.status?.progress !== undefined) {
      console.log(`✅ Progress: ${(status.data.status.progress * 100).toFixed(1)}%`);
      progressFound = true;
    } else if (status.data?.raw_endpoints && status.data.raw_endpoints['/api/job']?.progress?.completion) {
      console.log(`✅ Progress (raw endpoint): ${(status.data.raw_endpoints['/api/job'].progress.completion * 100).toFixed(1)}%`);
      progressFound = true;
    } else if (status.data?.printer?.progress !== undefined) {
      console.log(`✅ Progress (printer data): ${(status.data.printer.progress * 100).toFixed(1)}%`);
      progressFound = true;
    } else {
      console.log('❌ No progress data found');
    }
    
    // Check for time data
    let timeElapsedFound = false;
    let timeRemainingFound = false;
    
    if (status.data?.status?.print_time_elapsed !== undefined) {
      console.log(`✅ Print time elapsed: ${formatTime(status.data.status.print_time_elapsed)}`);
      timeElapsedFound = true;
    } else if (status.data?.raw_endpoints && status.data.raw_endpoints['/api/job']?.progress?.printTime) {
      console.log(`✅ Print time elapsed (raw endpoint): ${formatTime(status.data.raw_endpoints['/api/job'].progress.printTime)}`);
      timeElapsedFound = true;
    } else {
      console.log('❌ No print time elapsed data found');
    }
    
    if (status.data?.status?.print_time_remaining !== undefined) {
      console.log(`✅ Print time remaining: ${formatTime(status.data.status.print_time_remaining)}`);
      timeRemainingFound = true;
    } else if (status.data?.raw_endpoints && status.data.raw_endpoints['/api/job']?.progress?.printTimeLeft) {
      console.log(`✅ Print time remaining (raw endpoint): ${formatTime(status.data.raw_endpoints['/api/job'].progress.printTimeLeft)}`);
      timeRemainingFound = true;
    } else {
      console.log('❌ No print time remaining data found');
    }
    
    console.log('\nRaw API endpoints available:');
    if (status.data?.raw_endpoints) {
      Object.keys(status.data.raw_endpoints).forEach(endpoint => {
        console.log(`- ${endpoint}`);
      });
    } else {
      console.log('No raw endpoint data available');
    }
    
    // Check how this data would be displayed on the dashboard
    console.log('\n===== DASHBOARD DISPLAY CHECK =====');
    
    // In the UI component, these would be the values displayed
    console.log(`UI would display:`);
    console.log(`Bed temperature: ${bedTempFound ? 'Value found ✅' : 'N/A ❌'}`);
    console.log(`Tool temperature: ${nozzleTempFound ? 'Value found ✅' : 'N/A ❌'}`);
    console.log(`Print time elapsed: ${timeElapsedFound ? 'Value found ✅' : 'N/A ❌'}`);
    console.log(`Print time remaining: ${timeRemainingFound ? 'Value found ✅' : 'N/A ❌'}`);
    console.log(`Progress: ${progressFound ? 'Value found ✅' : 'N/A ❌'}`);
    
    // Check and log what values would show up in the database
    console.log('\n===== DATABASE UPDATE VALUES =====');
    const mappedState = mapPrusaLinkState(printerState);
    console.log(`Operation status: ${mappedState}`);
    
    // This simulates what would be used to update the database
    const dbUpdateData = {
      operationalStatus: mappedState,
      lastSeen: new Date(),
      bedTemp: extractBedTemp(status.data),
      toolTemp: extractToolTemp(status.data),
      printTimeElapsed: extractTimeElapsed(status.data),
      printTimeRemaining: extractTimeRemaining(status.data)
    };
    
    console.log(`Database update data:`, JSON.stringify(dbUpdateData, null, 2));
    
  } catch (error) {
    console.error('Error getting printer status:', error);
  }
}

// Helper functions to extract data like the API would
function extractBedTemp(data) {
  if (data?.printer?.temp_bed !== undefined) return Number(data.printer.temp_bed);
  if (data?.telemetry?.["temp-bed"] !== undefined) return Number(data.telemetry["temp-bed"]);
  if (data?.raw_endpoints && data.raw_endpoints['/api/printer']?.temperature?.bed?.actual !== undefined)
    return Number(data.raw_endpoints['/api/printer'].temperature.bed.actual);
  return null;
}

function extractToolTemp(data) {
  if (data?.printer?.temp_nozzle !== undefined) return Number(data.printer.temp_nozzle);
  if (data?.telemetry?.["temp-nozzle"] !== undefined) return Number(data.telemetry["temp-nozzle"]);
  if (data?.raw_endpoints && data.raw_endpoints['/api/printer']?.temperature?.tool0?.actual !== undefined)
    return Number(data.raw_endpoints['/api/printer'].temperature.tool0.actual);
  return null;
}

function extractTimeElapsed(data) {
  if (data?.status?.print_time_elapsed !== undefined) return data.status.print_time_elapsed;
  if (data?.raw_endpoints && data.raw_endpoints['/api/job']?.progress?.printTime)
    return data.raw_endpoints['/api/job'].progress.printTime;
  return undefined;
}

function extractTimeRemaining(data) {
  if (data?.status?.print_time_remaining !== undefined) return data.status.print_time_remaining;
  if (data?.raw_endpoints && data.raw_endpoints['/api/job']?.progress?.printTimeLeft)
    return data.raw_endpoints['/api/job'].progress.printTimeLeft;
  return undefined;
}

function mapPrusaLinkState(state) {
  switch (state.toLowerCase()) {
    case 'printing': return 'printing';
    case 'operational': return 'idle';
    case 'paused': return 'paused';
    case 'error': return 'error';
    case 'offline': return 'offline';
    case 'cancelling': return 'idle';
    case 'busy': return 'busy';
    default: return 'idle';
  }
}

function formatTime(seconds) {
  if (!seconds) return '0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

main(); 