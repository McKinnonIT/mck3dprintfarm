import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Log all requests to this endpoint
    console.log(`GCODE API Request: ${request.url}`);
    console.log(`GCODE API Params: ${JSON.stringify(params)}`);

    // Validate session (optional for viewing)
    const session = await getServerSession(authOptions);
    console.log('Session for GCODE API request:', session ? 'authenticated' : 'unauthenticated');
    
    // We'll continue even without a session, just log it
    // This makes the API more compatible with iframe viewers

    // Decode the filename (it comes URL-encoded)
    const fileId = decodeURIComponent(params.id);

    console.log(`Looking up GCODE file with ID: ${fileId}`);

    // First try finding by ID
    let file = await prisma.file.findUnique({
      where: { id: fileId }
    });

    // If not found by ID, try finding by name
    if (!file) {
      console.log(`File not found by ID, trying by name: ${fileId}`);
      file = await prisma.file.findFirst({
        where: { name: fileId }
      });
    }

    if (!file) {
      console.error(`File with ID/name ${fileId} not found`);
      return new NextResponse(JSON.stringify({ 
        message: 'File not found',
        requestedId: fileId,
        url: request.url
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`Found file: ${file.name}, path: ${file.path}`);

    // Construct path to the file
    const filePath = path.join(process.cwd(), 'uploads', file.path);
    console.log(`Absolute file path: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Physical file not found at path: ${filePath}`);
      return new NextResponse(JSON.stringify({ 
        message: 'File not found on server',
        filePath: file.path,
        requestedId: fileId
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get file stats for size information
    const stats = fs.statSync(filePath);
    console.log(`File size: ${stats.size} bytes`);

    // Read the file
    const fileData = fs.readFileSync(filePath);

    // Basic validation to ensure it looks like a GCODE or BGCODE file
    const fileContent = fileData.toString('utf-8').substring(0, 1000);
    const isGcodeContent = fileContent.includes('G0') || 
                         fileContent.includes('G1') || 
                         fileContent.includes('M104') || 
                         fileContent.includes('M109') ||
                         fileContent.includes(';Generated with');
    
    const fileName = file.name.toLowerCase();
    const hasValidExtension = fileName.endsWith('.gcode') || fileName.endsWith('.bgcode');
    
    if (!isGcodeContent && !hasValidExtension) {
      console.warn(`File ${file.name} does not appear to be a valid GCODE or BGCODE file`);
    }

    // Set appropriate CORS headers to allow external viewers to access the file
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Content-Disposition', `inline; filename="${file.name}"`);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Length', stats.size.toString());
    
    // Log that we're sending the file
    console.log(`Sending GCODE file: ${file.name}, size: ${fileData.length} bytes`);
    
    // For larger files, return a readable stream instead of loading the whole file
    if (stats.size > 1024 * 1024 * 10) { // Over 10MB
      console.log('Using stream for large file');
      const stream = fs.createReadStream(filePath);
      return new NextResponse(stream as unknown as ReadableStream, { 
        status: 200,
        headers
      });
    }
    
    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error serving GCODE file:', error);
    return new NextResponse(JSON.stringify({ message: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
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