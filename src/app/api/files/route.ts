import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    if (!userId || !userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract username from email
    const username = userEmail.split('@')[0];
    if (!username) {
       console.error(`Failed to extract username from email: ${userEmail}`);
       return NextResponse.json({ error: "Invalid user email format" }, { status: 400 });
    }
    // Basic sanitization (replace non-alphanumeric with underscore)
    const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, '_');

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const groupId = formData.get("groupId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Define user-specific upload directory relative to the mapped volume root
    const userUploadDir = join("uploads", sanitizedUsername);
    const absoluteUploadDir = join(process.cwd(), userUploadDir); 
    
    // Ensure the directory exists
    try {
        await mkdir(absoluteUploadDir, { recursive: true });
    } catch (mkdirError) {
        console.error(`Failed to create upload directory ${absoluteUploadDir}:`, mkdirError);
        return NextResponse.json({ error: "Failed to create upload directory" }, { status: 500 });
    }

    // Create a unique filename (timestamp prefix is still good practice)
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${file.name}`;
    const absoluteFilePath = join(absoluteUploadDir, uniqueFilename);
    // Store the path relative to the base uploads directory for the DB
    const relativeFilePath = join(sanitizedUsername, uniqueFilename); 

    // Save the file locally
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absoluteFilePath, buffer);

    // Check if file is an STL file
    const isStlFile = file.name.toLowerCase().endsWith('.stl');
    
    // For STL files, create a route to serve the file for preview
    let previewUrl = null;
    if (isStlFile) {
      // Create a preview URL that points to our public API endpoint
      previewUrl = `/api/files/${timestamp}-${encodeURIComponent(file.name)}/preview`;
    }

    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        path: relativeFilePath,
        size: file.size,
        type: file.type,
        previewUrl: previewUrl,
        uploadedBy: userId,
        groupId: groupId || null,
      },
      include: {
        group: true,
      },
    });

    return NextResponse.json(fileRecord);
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const files = await prisma.file.findMany({
      where: {
        uploadedBy: session.user.id,
      },
      include: {
        group: true,
        printJobs: {
          include: {
            printer: true,
          },
        },
        // Present only if this file IS a sliced output - tells the UI which
        // model file to group it under, and which printer it was sliced for.
        sliceJobsAsResult: {
          select: { sourceFileId: true, printer: { select: { id: true, name: true } } },
        },
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to fetch files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
} 