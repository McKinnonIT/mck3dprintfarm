import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Log the request
    console.log(`File Proxy Request: ${request.url}`);
    
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const fileName = searchParams.get('name');
    
    if (!filePath) {
      return new NextResponse(JSON.stringify({ 
        error: 'Missing file path parameter'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Validate the filePath to prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      return new NextResponse(JSON.stringify({ 
        error: 'Invalid file path'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Construct the absolute path
    const absolutePath = path.join(process.cwd(), 'uploads', normalizedPath);
    console.log(`Serving file from: ${absolutePath}`);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return new NextResponse(JSON.stringify({ 
        error: 'File not found',
        path: absolutePath
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Get file stats
    const stats = fs.statSync(absolutePath);
    
    // Set up response headers with CORS
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Content-Length', stats.size.toString());
    
    // Set appropriate content type based on file extension
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext === '.gcode') {
      headers.set('Content-Type', 'text/plain; charset=utf-8');
    } else if (ext === '.stl') {
      headers.set('Content-Type', 'application/vnd.ms-pki.stl');
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }
    
    // Set the content disposition with the original filename if provided
    if (fileName) {
      headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${path.basename(absolutePath)}"`);
    }
    
    // For large files, stream them
    if (stats.size > 5 * 1024 * 1024) { // Over 5MB
      console.log(`Streaming large file (${stats.size} bytes)`);
      const stream = fs.createReadStream(absolutePath);
      return new NextResponse(stream as unknown as ReadableStream, { 
        status: 200,
        headers
      });
    }
    
    // For smaller files, read them in memory
    const fileData = fs.readFileSync(absolutePath);
    return new NextResponse(fileData, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 