import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sliceFile } from "@/lib/slicer-client";
import { stat } from "fs/promises";
import { join, dirname, extname, basename } from "path";

// The Slice panel edits "Custom Settings" grouped by display category
// (Quality/Strength/Supports/Other), but the underlying OrcaSlicer process
// JSON is flat - flatten before merging into the sidecar's overrides.
function flattenOverrides(overrides: unknown): Record<string, unknown> | undefined {
  if (!overrides || typeof overrides !== "object") return undefined;
  const flat: Record<string, unknown> = {};
  for (const categoryValues of Object.values(overrides as Record<string, unknown>)) {
    if (categoryValues && typeof categoryValues === "object") {
      Object.assign(flat, categoryValues);
    }
  }
  return flat;
}

export async function POST(request: Request, { params }: { params: { fileId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { printerId, filamentProfileId, slicingProfileId, overrides: rawOverrides, preArranged } = await request.json();
  const overrides = flattenOverrides(rawOverrides);
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

  const sliceJob = await prisma.sliceJob.create({
    data: {
      sourceFileId: sourceFile.id,
      printerId: printer.id,
      machineProfileId: printer.machineProfile.id,
      filamentProfileId: filamentProfile.id,
      slicingProfileId: slicingProfile.id,
      customOverridesJson: overrides ? JSON.stringify(overrides) : null,
      submittedByUserId: session.user.id,
      status: "SLICING",
      startedAt: new Date(),
    },
  });

  const outputName = `${basename(sourceFile.name, extname(sourceFile.name))}.gcode`;
  const outputRelativePath = join(dirname(sourceFile.path), `sliced-${Date.now()}-${outputName}`);

  try {
    const result = await sliceFile({
      sourceFilePath: sourceFile.path,
      outputRelativePath,
      profile: {
        machineJson: printer.machineProfile.machineJson,
        processJson: slicingProfile.processJson,
        filamentJson: filamentProfile.filamentJson,
      },
      overrides,
      preArranged: preArranged === true,
    });

    if (!result.success) {
      const failedJob = await prisma.sliceJob.update({
        where: { id: sliceJob.id },
        data: { status: "FAILED", errorMessage: result.error || "Slicing failed", completedAt: new Date() },
      });
      return NextResponse.json({ error: result.error || "Slicing failed", job: failedJob }, { status: 500 });
    }

    const absoluteOutputPath = join(process.cwd(), "uploads", outputRelativePath);
    const stats = await stat(absoluteOutputPath);

    const resultFile = await prisma.file.create({
      data: {
        name: outputName,
        path: outputRelativePath,
        size: stats.size,
        type: "text/x-gcode",
        uploadedBy: session.user.id,
        groupId: sourceFile.groupId,
      },
    });

    const completedJob = await prisma.sliceJob.update({
      where: { id: sliceJob.id },
      data: { status: "COMPLETED", resultFileId: resultFile.id, completedAt: new Date() },
      include: { resultFile: true },
    });

    return NextResponse.json(completedJob);
  } catch (error) {
    const failedJob = await prisma.sliceJob.update({
      where: { id: sliceJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", job: failedJob },
      { status: 500 }
    );
  }
}
