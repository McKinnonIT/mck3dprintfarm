import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { prisma } from '@/lib/prisma';

/**
 * Docker Path API
 * This endpoint returns the path to a file as it would be mounted in the Docker container
 * Used for Kiri:Moto CLI mode to directly load files
 */
export async function GET(request: NextRequest) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    
    if (!fileId) {
      return new NextResponse(JSON.stringify({ 
        error: 'Missing file ID parameter'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Get file info from database
    const fileInfo = await prisma.file.findUnique({
      where: { id: fileId }
    });
    
    if (!fileInfo) {
      return new NextResponse(JSON.stringify({ 
        error: 'File not found' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Get just the filename without the absolute path
    // Our database stores the absolute path, but Docker mounts just the uploads directory
    const filePath = fileInfo.path;
    const uploadsDirName = 'uploads';
    
    // Find the uploads directory in the path and get everything after it
    const uploadsIndex = filePath.indexOf(uploadsDirName);
    let relativeFilePath;
    
    if (uploadsIndex !== -1) {
      // Get the part after "uploads/"
      relativeFilePath = filePath.substring(uploadsIndex + uploadsDirName.length);
      // Ensure it starts with a slash
      relativeFilePath = relativeFilePath.startsWith('/') ? relativeFilePath : '/' + relativeFilePath;
    } else {
      // If we can't find the uploads directory, just use the filename
      relativeFilePath = '/' + path.basename(filePath);
    }
    
    // Get just the filename
    const fileName = path.basename(filePath);
    
    // IMPORTANT: Based on docker-compose.yml, the uploads directory is mounted at /app/uploads
    // Create multiple path options to try
    const dockerPath = `/app/uploads${relativeFilePath}`;
    const alternativePath1 = `/uploads${relativeFilePath}`;
    const alternativePath2 = relativeFilePath;
    const alternativePath3 = `/app/uploads/${fileName}`;
    
    // Check if the file exists in the expected location
    const absoluteLocalPath = path.join(process.cwd(), 'uploads', relativeFilePath.startsWith('/') ? relativeFilePath.substring(1) : relativeFilePath);
    const fileExists = require('fs').existsSync(absoluteLocalPath);
    
    // Log for debugging
    console.log(`Docker path for file ${fileInfo.name}: ${dockerPath}`);
    console.log(`Original path: ${filePath}`);
    console.log(`Local absolute path: ${absoluteLocalPath}`);
    console.log(`File exists locally: ${fileExists}`);
    
    return new NextResponse(JSON.stringify({
      fileName: fileInfo.name,
      originalPath: filePath,
      dockerPath: dockerPath,
      alternativePaths: [alternativePath1, alternativePath2, alternativePath3],
      localPath: absoluteLocalPath,
      fileExists: fileExists,
      fileId: fileId,
      relativeFilePath: relativeFilePath
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error getting Docker path:', error);
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