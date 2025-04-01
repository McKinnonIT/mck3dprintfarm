import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: params.id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Delete the file from the filesystem
    try {
      await unlink(file.path);
    } catch (error) {
      console.error("Failed to delete file from filesystem:", error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete the file record from the database
    await prisma.file.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
} 