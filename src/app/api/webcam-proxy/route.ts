import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const isSnapshot = searchParams.get("snapshot") === "true";
  
  if (!url) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }
  
  try {
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    console.log(`Proxying webcam request to: ${url}`);
    
    // Add specific headers for different webcam types
    const headers: HeadersInit = {
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Stream requests need different handling than snapshots
    const fetchOptions: RequestInit = {
      signal: controller.signal,
      cache: "no-store",
      headers
    };
    
    const response = await fetch(url, fetchOptions);
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Error fetching webcam: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch webcam: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Detect content type based on URL and response headers
    let contentType = response.headers.get("content-type");
    
    // Default content type based on URL patterns if no content-type header
    if (!contentType) {
      if (isSnapshot || url.includes("snapshot") || url.includes("screenshot")) {
        contentType = "image/jpeg";
      } else if (url.includes("stream") || url.includes("mjpg") || url.includes("mjpeg")) {
        contentType = "multipart/x-mixed-replace";
      } else {
        contentType = "application/octet-stream";
      }
    }
    
    console.log(`Content type for ${url}: ${contentType}`);
    
    // Common response headers
    const responseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };
    
    // For multipart streams (MJPEG), we need to use the stream directly
    if (contentType.includes("multipart") || 
        (!isSnapshot && (url.includes("stream") || url.includes("mjpg") || url.includes("mjpeg")))) {
      console.log(`Detected multipart stream for ${url}, using streaming response`);
      
      // Set response as streaming multipart content
      if (!contentType.includes("multipart")) {
        responseHeaders["Content-Type"] = "multipart/x-mixed-replace";
      }
      
      // For MJPEG streams, pipe directly
      return new NextResponse(response.body, {
        headers: {
          ...responseHeaders,
          "Connection": "keep-alive"
        }
      });
    }
    
    // For images and other content types, use arrayBuffer
    console.log(`Returning regular content for ${url} with type ${contentType}`);
    const data = await response.arrayBuffer();
    
    // Return the proxied response
    return new NextResponse(data, {
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error(`Webcam proxy error:`, error);
    
    // More descriptive error message
    const errorMessage = error.message || "Unknown error";
    const errorStack = error.stack || "";
    
    return NextResponse.json(
      { 
        error: `Failed to proxy webcam: ${errorMessage}`,
        details: errorStack,
        url: url
      },
      { status: 500 }
    );
  }
} 