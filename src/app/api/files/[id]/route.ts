import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";
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

    if (!file || !file.path) {
      if (!file) {
        return NextResponse.json({ error: "File not found in database" }, { status: 404 });
      }
      console.error(`File record ${file.id} is missing the path. Cannot delete from filesystem.`);
      await prisma.file.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true, message: "File record deleted, but file path was missing." });
    }

    // 3. Check authorization: Admin or Uploader
    const isAdmin = session.user.role === 'ADMIN';
    const isUploader = session.user.id === file.uploadedBy;

    if (!isAdmin && !isUploader) {
        console.log(`File delete forbidden: User ${session.user.id} (role: ${session.user.role}) tried to delete file ${file.id} uploaded by ${file.uploadedBy}`);
        return NextResponse.json({ error: "Forbidden: You do not have permission to delete this file." }, { status: 403 });
    }

    // Construct the absolute path
    const absoluteFilePath = join(process.cwd(), "uploads", file.path);

    // 4. Delete the file from the filesystem (if authorized)
    try {
      console.log(`Attempting to delete file from filesystem: ${absoluteFilePath}`);
      await unlink(absoluteFilePath);
      console.log(`Successfully deleted file from filesystem: ${absoluteFilePath}`);
    } catch (error: any) {
       // Log error but continue to DB deletion if file system delete fails (e.g., file already gone)
       if (error.code !== 'ENOENT') { // ENOENT = Error NO ENTry (file not found)
           console.error(`Failed to delete file from filesystem (Path: ${absoluteFilePath}):`, error);
       } else {
           console.warn(`File not found on filesystem during delete attempt (Path: ${absoluteFilePath}). Proceeding with DB deletion.`);
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