import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCombined3mf } from "@/lib/build-combined-3mf";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface CombineObjectInput {
  fileId: string;
  positionX: number;
  positionZ: number;
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
}

// Builds a real .3mf File from several models placed on one plate, so the
// rest of the app (slicing, Files-page grouping, delete cascade) can treat
// a multi-object plate exactly like any other uploaded model - no
// SliceJob schema changes needed.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objects, bedWidth, bedDepth } = (await request.json()) as {
    objects?: CombineObjectInput[];
    bedWidth?: number;
    bedDepth?: number;
  };
  if (!Array.isArray(objects) || objects.length < 2) {
    return NextResponse.json({ error: "At least 2 objects are required to combine" }, { status: 400 });
  }
  if (!bedWidth || !bedDepth) {
    return NextResponse.json({ error: "bedWidth and bedDepth are required" }, { status: 400 });
  }

  const files = await prisma.file.findMany({ where: { id: { in: objects.map((o) => o.fileId) } } });
  const fileById = new Map(files.map((f) => [f.id, f]));
  for (const obj of objects) {
    if (!fileById.has(obj.fileId)) {
      return NextResponse.json({ error: `File not found: ${obj.fileId}` }, { status: 404 });
    }
  }

  const buffer = await buildCombined3mf(
    objects.map((obj) => ({
      absolutePath: join(process.cwd(), "uploads", fileById.get(obj.fileId)!.path),
      positionX: obj.positionX,
      positionZ: obj.positionZ,
      rotationXDegrees: obj.rotationXDegrees,
      rotationYDegrees: obj.rotationYDegrees,
      rotationZDegrees: obj.rotationZDegrees,
    })),
    { width: bedWidth, depth: bedDepth }
  );

  const username = userEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
  const uploadDir = join(process.cwd(), "uploads", username);
  await mkdir(uploadDir, { recursive: true });

  const combinedName = objects.map((obj) => fileById.get(obj.fileId)!.name.replace(/\.[^.]+$/, "")).join(" + ") + ".3mf";
  const uniqueFilename = `${Date.now()}-${combinedName}`;
  await writeFile(join(uploadDir, uniqueFilename), buffer);

  const fileRecord = await prisma.file.create({
    data: {
      name: combinedName,
      path: join(username, uniqueFilename),
      size: buffer.length,
      type: "model/3mf",
      uploadedBy: userId,
    },
  });

  return NextResponse.json(fileRecord);
}
