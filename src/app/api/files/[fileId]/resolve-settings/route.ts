import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSettings } from "@/lib/slicer-client";
import { categorizeSettings } from "@/lib/slicer-setting-categories";

export async function POST(request: Request, { params }: { params: { fileId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { printerId, filamentProfileId, slicingProfileId } = await request.json();
  if (!printerId || !filamentProfileId || !slicingProfileId) {
    return NextResponse.json(
      { error: "printerId, filamentProfileId and slicingProfileId are required" },
      { status: 400 }
    );
  }

  const sourceFile = await prisma.file.findUnique({ where: { id: params.fileId } });
  if (!sourceFile) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const printer = await prisma.printer.findUnique({
    where: { id: printerId },
    include: { machineProfile: true },
  });
  if (!printer) {
    return NextResponse.json({ error: "Printer not found" }, { status: 404 });
  }
  if (!printer.machineProfile) {
    return NextResponse.json({ error: "This printer has no machine profile assigned." }, { status: 400 });
  }

  const [filamentProfile, slicingProfile] = await Promise.all([
    prisma.filamentProfile.findUnique({ where: { id: filamentProfileId } }),
    prisma.slicingProfile.findUnique({ where: { id: slicingProfileId } }),
  ]);
  if (!filamentProfile) {
    return NextResponse.json({ error: "Filament profile not found" }, { status: 404 });
  }
  if (!slicingProfile) {
    return NextResponse.json({ error: "Slicing profile not found" }, { status: 404 });
  }

  const result = await resolveSettings({
    sourceFilePath: sourceFile.path,
    profile: {
      machineJson: printer.machineProfile.machineJson,
      processJson: slicingProfile.processJson,
      filamentJson: filamentProfile.filamentJson,
    },
  });

  if (!result.success || !result.settings) {
    return NextResponse.json({ error: result.error || "Failed to resolve settings" }, { status: 500 });
  }

  return NextResponse.json({ categories: categorizeSettings(result.settings) });
}
