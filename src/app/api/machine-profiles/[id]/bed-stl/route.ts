import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import fs from "fs/promises";

// Purely a visual bed representation for the Slicer page's 3D viewer - see
// the schema comment on MachineProfile.bedStlPath. Never read by the
// slicing path, so it's stored/served entirely separately from that flow.

function relativeBedStlPath(machineProfileId: string): string {
  return join("machine-profiles", machineProfileId, "bed.stl");
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const profile = await prisma.machineProfile.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Machine profile not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".stl")) {
    return NextResponse.json({ error: "Bed representation must be an .stl file" }, { status: 400 });
  }

  const relativePath = relativeBedStlPath(params.id);
  const absolutePath = join(process.cwd(), "uploads", relativePath);

  try {
    await mkdir(join(process.cwd(), "uploads", "machine-profiles", params.id), { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absolutePath, Buffer.from(bytes));
  } catch (error) {
    console.error(`Failed to save bed STL for machine profile ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to save bed STL" }, { status: 500 });
  }

  const updated = await prisma.machineProfile.update({
    where: { id: params.id },
    data: { bedStlPath: relativePath, bedStlFilename: file.name },
    select: { id: true, bedStlFilename: true },
  });

  return NextResponse.json({ id: updated.id, hasBedStl: true, bedStlFilename: updated.bedStlFilename });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const profile = await prisma.machineProfile.findUnique({
    where: { id: params.id },
    select: { bedStlPath: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Machine profile not found" }, { status: 404 });
  }

  if (profile.bedStlPath) {
    try {
      await unlink(join(process.cwd(), "uploads", profile.bedStlPath));
    } catch (error) {
      // Already gone or never made it to disk - not fatal, we're clearing the DB either way.
      console.warn(`Bed STL file missing on disk for machine profile ${params.id}:`, error);
    }
  }

  await prisma.machineProfile.update({
    where: { id: params.id },
    data: { bedStlPath: null, bedStlFilename: null },
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const profile = await prisma.machineProfile.findUnique({
    where: { id: params.id },
    select: { bedStlPath: true, bedStlFilename: true },
  });
  if (!profile?.bedStlPath) {
    return new NextResponse("No bed STL set for this machine profile", { status: 404 });
  }

  const absolutePath = join(process.cwd(), "uploads", profile.bedStlPath);
  try {
    await fs.access(absolutePath, fs.constants.R_OK);
  } catch (err) {
    console.error(`Bed STL not found on disk: ${absolutePath}`, err);
    return new NextResponse("Bed STL not found on server disk", { status: 404 });
  }

  const fileBuffer = await fs.readFile(absolutePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "model/stl",
      "Content-Length": fileBuffer.length.toString(),
      "Content-Disposition": `inline; filename="${profile.bedStlFilename}"`,
    },
  });
}
