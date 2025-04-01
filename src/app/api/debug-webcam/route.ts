import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const printerUrl = url.searchParams.get('printer_url');
  
  if (!printerUrl) {
    return NextResponse.json({ error: 'Missing printer_url parameter' }, { status: 400 });
  }
  
  try {
    console.log(`Fetching webcam info from: ${printerUrl}`);
    
    // Try to get webcam information from Moonraker
    const webcamResponse = await fetch(`${printerUrl}/server/database/item?namespace=webcam`, {
      cache: 'no-store'
    });
    
    if (webcamResponse.ok) {
      const webcamData = await webcamResponse.json();
      console.log(`Webcam data:`, JSON.stringify(webcamData));
      
      // Try to use webcam data
      const webcamInfo = {
        rawData: webcamData,
        hasWebcams: webcamData.result?.value?.webcams && webcamData.result.value.webcams.length > 0,
        webcamCount: webcamData.result?.value?.webcams?.length || 0,
        defaultWebcam: webcamData.result?.value?.webcams?.[0] || null,
        streamUrl: webcamData.result?.value?.webcams?.[0]?.stream_url || null,
        snapshotUrl: webcamData.result?.value?.webcams?.[0]?.snapshot_url || null,
      };
      
      // Try to directly access the webcam endpoints
      const streamCheckResult = webcamInfo.streamUrl ? 
        await checkUrl(webcamInfo.streamUrl) : 
        { status: 'not_available' };
        
      const snapshotCheckResult = webcamInfo.snapshotUrl ? 
        await checkUrl(webcamInfo.snapshotUrl) : 
        { status: 'not_available' };
      
      return NextResponse.json({
        webcamInfo,
        streamCheckResult,
        snapshotCheckResult
      });
    } else {
      return NextResponse.json({
        error: 'Failed to fetch webcam data',
        status: webcamResponse.status,
        statusText: webcamResponse.statusText
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in debug-webcam:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function checkUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store'
    });
    
    return {
      status: response.ok ? 'available' : 'error',
      statusCode: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
} 