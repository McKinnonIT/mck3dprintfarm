import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    // 1. Ensure user is logged in
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the file record including who uploaded it
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: { id: true, path: true, uploadedBy: true }, // Select necessary fields
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 3. Check authorization: Admin or Uploader
    const isAdmin = session.user.role === 'ADMIN';
    const isUploader = session.user.id === file.uploadedBy;

    if (!isAdmin && !isUploader) {
        console.log(`File delete forbidden: User ${session.user.id} (role: ${session.user.role}) tried to delete file ${file.id} uploaded by ${file.uploadedBy}`);
        return NextResponse.json({ error: "Forbidden: You do not have permission to delete this file." }, { status: 403 });
    }

    // 4. Delete the file from the filesystem (if authorized)
    try {
      console.log(`Attempting to delete file from filesystem: ${file.path}`);
      await unlink(file.path);
      console.log(`Successfully deleted file from filesystem: ${file.path}`);
    } catch (error: any) {
       // Log error but continue to DB deletion if file system delete fails (e.g., file already gone)
       if (error.code !== 'ENOENT') { // ENOENT = Error NO ENTry (file not found)
           console.error(`Failed to delete file from filesystem (Path: ${file.path}):`, error);
       } else {
           console.warn(`File not found on filesystem during delete attempt (Path: ${file.path}). Proceeding with DB deletion.`);
       }
    }

    // 5. Delete the file record from the database (if authorized)
    await prisma.file.delete({
      where: { id: params.id },
    });
    console.log(`Successfully deleted file record from DB: ${file.id}`);

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error(`DELETE /api/files/${params.id} - Failed:`, error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
} 