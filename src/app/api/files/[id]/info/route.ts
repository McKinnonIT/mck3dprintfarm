import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Log the request
    console.log(`File Info Request: ${request.url}, ID: ${params.id}`);
    
    // Decode the ID
    const fileId = decodeURIComponent(params.id);
    
    // Look up the file
    const file = await prisma.file.findUnique({
      where: { id: fileId }
    });
    
    if (!file) {
      return new NextResponse(JSON.stringify({ 
        error: 'File not found',
        id: fileId
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Return the file info
    return new NextResponse(JSON.stringify({
      id: file.id,
      name: file.name,
      path: file.path,
      size: file.size,
      type: file.type,
      uploadedAt: file.uploadedAt,
      updatedAt: file.updatedAt
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error retrieving file info:', error);
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