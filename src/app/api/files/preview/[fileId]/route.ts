import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises"; // Use promises for async file reading

export async function GET(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const fileId = params.fileId;
    if (!fileId) {
      return new NextResponse("Missing file ID", { status: 400 });
    }

    // Fetch file record from DB
    const fileRecord = await prisma.file.findUnique({
      where: { id: fileId },
      // Only select necessary fields
      select: { name: true, path: true, type: true, uploadedBy: true } 
    });

    if (!fileRecord) {
      return new NextResponse("File not found in database", { status: 404 });
    }

    // Basic access check (ensure user requesting owns the file)
    // TODO: Implement more granular access control later (e.g., based on groups/roles)
    if (fileRecord.uploadedBy !== session.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // Construct the absolute path
    const absoluteFilePath = path.join(process.cwd(), "uploads", fileRecord.path);

    // Check if file exists on disk
    try {
      await fs.access(absoluteFilePath, fs.constants.R_OK); // Check read access
    } catch (err) {
      console.error(`File not found or inaccessible on disk: ${absoluteFilePath}`, err);
      return new NextResponse("File not found on server disk", { status: 404 });
    }

    // Read the file content
    const fileBuffer = await fs.readFile(absoluteFilePath);

    // Determine content type (use stored type, default to application/octet-stream)
    // Correct type for STL is often 'model/stl' or 'application/sla'
    const contentType = fileRecord.type === 'model/stl' || fileRecord.name.toLowerCase().endsWith('.stl') 
                        ? 'model/stl' 
                        : 'application/octet-stream';
    
    // Return the file content
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        // Suggest filename, but display inline if possible
        'Content-Disposition': `inline; filename="${fileRecord.name}"` 
      },
    });

  } catch (error) {
    console.error("[API /api/files/preview/[fileId]] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 