import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function unlinkIfExists(relativePath: string) {
  try {
    await unlink(join(process.cwd(), "uploads", relativePath));
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error(`Failed to delete file from filesystem (Path: ${relativePath}):`, error);
    }
  }
}

// Deletes a file and everything that only exists because of it: PrintJob
// history referencing it (fileId has no cascading delete at the DB level)
// and, if it's a model, every sliced output derived from it (SliceJob rows
// require their sourceFileId to exist, so those must go first too).
async function deleteFileCascade(fileId: string) {
  const childSliceJobs = await prisma.sliceJob.findMany({
    where: { sourceFileId: fileId },
    select: { resultFileId: true },
  });
  for (const job of childSliceJobs) {
    if (job.resultFileId) {
      await deleteFileCascade(job.resultFileId);
    }
  }
  await prisma.sliceJob.deleteMany({ where: { sourceFileId: fileId } });
  await prisma.printJob.deleteMany({ where: { fileId } });

  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { path: true } });
  if (file?.path) {
    await unlinkIfExists(file.path);
  }
  await prisma.file.delete({ where: { id: fileId } });
}

export async function DELETE(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    // 1. Ensure user is logged in
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the file record including who uploaded it
    const file = await prisma.file.findUnique({
      where: { id: params.fileId },
      select: { id: true, path: true, uploadedBy: true }, // Select necessary fields
    });

    if (!file) {
      return NextResponse.json({ error: "File not found in database" }, { status: 404 });
    }

    // 3. Check authorization: Admin or Uploader
    const isAdmin = session.user.role === 'ADMIN';
    const isUploader = session.user.id === file.uploadedBy;

    if (!isAdmin && !isUploader) {
        console.log(`File delete forbidden: User ${session.user.id} (role: ${session.user.role}) tried to delete file ${file.id} uploaded by ${file.uploadedBy}`);
        return NextResponse.json({ error: "Forbidden: You do not have permission to delete this file." }, { status: 403 });
    }

    // 4. Delete the file (and its sliced children / print history) from disk and DB
    await deleteFileCascade(file.id);
    console.log(`Successfully deleted file record from DB: ${file.id}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(`DELETE /api/files/${params.fileId} - Failed:`, error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}