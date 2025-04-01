import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const groupId = formData.get("groupId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Create a unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${file.name}`;
    const filePath = join(process.cwd(), "uploads", uniqueFilename);

    // Save the file locally
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

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
        path: filePath,
        size: file.size,
        type: file.type,
        previewUrl: previewUrl,
        uploadedBy: session.user.id,
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