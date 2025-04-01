import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

/**
 * STL Proxy API
 * This API endpoint fetches an STL file from our system and returns it,
 * allowing external viewers to access files that might require authentication.
 * It adds the necessary CORS headers to make the file accessible from Kiri:Moto.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the URL or fileId from the query parameters
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const fileId = searchParams.get('id');
    
    // If we have a fileId, try to get the file directly from our system
    if (fileId) {
      console.log(`STL Proxy: Fetching file with ID: ${fileId}`);
      
      // Get file info from database
      const fileInfo = await prisma.file.findUnique({
        where: { id: fileId }
      });
      
      if (!fileInfo) {
        return new NextResponse(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Content-Disposition'
          },
        });
      }
      
      // Read the file from disk
      const filePath = fileInfo.path;
      const fileBuffer = await readFile(filePath);
      
      // Set CORS headers to allow access from Kiri:Moto
      const headers = new Headers();
      
      // Set content type - use model/stl consistently
      headers.set('Content-Type', 'model/stl');
      headers.set('Content-Disposition', `inline; filename="${fileInfo.name}"`);
      
      // Set comprehensive CORS headers
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Accept, Content-Disposition');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition');
      
      // Caching headers
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      
      // Add extra debug headers
      headers.set('X-STL-Proxy', 'true');
      headers.set('X-STL-Source', 'disk');
      headers.set('X-STL-Filename', fileInfo.name);
      headers.set('X-STL-Size', fileBuffer.length.toString());
      headers.set('X-STL-Content-Type', 'model/stl');
      
      console.log(`STL Proxy: Successfully served file from disk, size: ${fileBuffer.length} bytes, filename: ${fileInfo.name}`);
      
      // Return the STL file with proper headers
      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });
    }
    
    if (!url) {
      return new NextResponse(JSON.stringify({ error: 'No URL or file ID provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Content-Disposition'
        },
      });
    }
    
    console.log(`STL Proxy: Fetching file from: ${url}`);
    
    // Fetch the STL file
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/octet-stream, model/stl, */*',
      },
    });
    
    if (!response.ok) {
      return new NextResponse(JSON.stringify({ 
        error: `Failed to fetch STL: ${response.status} ${response.statusText}` 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Content-Disposition'
        },
      });
    }
    
    // Get the file content as ArrayBuffer
    const data = await response.arrayBuffer();
    
    // Set CORS headers to allow access from Kiri:Moto
    const headers = new Headers();
    headers.set('Content-Type', 'model/stl');  // Use model/stl consistently
    headers.set('Content-Disposition', 'inline; filename="model.stl"');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Content-Disposition, Range');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Length', data.byteLength.toString());
    
    // Add extra debug headers
    headers.set('X-STL-Proxy', 'true');
    headers.set('X-STL-Source', 'url');
    headers.set('X-STL-Size', data.byteLength.toString());
    headers.set('X-STL-Content-Type', 'model/stl');
    
    console.log(`STL Proxy: Successfully proxied file, size: ${data.byteLength} bytes, url: ${url}`);
    
    // Return the STL file with proper headers
    return new NextResponse(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('STL Proxy error:', error);
    console.error('Request URL:', request.url);
    console.error('User agent:', request.headers.get('user-agent'));
    console.error('Origin:', request.headers.get('origin'));
    console.error('Referrer:', request.headers.get('referer'));
    
    return new NextResponse(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Content-Disposition'
      },
    });
  }
}

/**
 * Handle OPTIONS requests with proper CORS headers
 */
export async function OPTIONS(request: NextRequest) {
  // Set headers to allow cross-origin requests
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Accept, Content-Disposition');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition');
  
  // Return a simple response with CORS headers
  return new NextResponse(null, {
    status: 204, // No content
    headers
  });
} 