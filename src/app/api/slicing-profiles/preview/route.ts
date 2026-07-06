import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSettings } from "@/lib/slicer-client";
import { categorizeSettings } from "@/lib/slicer-setting-categories";

// Resolves the effective settings for a base Slicing Profile + machine +
// filament combo with no uploaded file in context - used by the "Create
// Slicing Profile" modal to seed real starting values before editing.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { baseSlicingProfileId, machineProfileId, filamentProfileId } = await request.json();
  if (!baseSlicingProfileId || !machineProfileId || !filamentProfileId) {
    return NextResponse.json(
      { error: "baseSlicingProfileId, machineProfileId and filamentProfileId are required" },
      { status: 400 }
    );
  }

  const [baseProfile, machineProfile, filamentProfile] = await Promise.all([
    prisma.slicingProfile.findUnique({ where: { id: baseSlicingProfileId } }),
    prisma.machineProfile.findUnique({ where: { id: machineProfileId } }),
    prisma.filamentProfile.findUnique({ where: { id: filamentProfileId } }),
  ]);
  if (!baseProfile) {
    return NextResponse.json({ error: "Base Slicing Profile not found" }, { status: 404 });
  }
  if (!machineProfile) {
    return NextResponse.json({ error: "Machine profile not found" }, { status: 404 });
  }
  if (!filamentProfile) {
    return NextResponse.json({ error: "Filament profile not found" }, { status: 404 });
  }

  const result = await resolveSettings({
    profile: {
      machineJson: machineProfile.machineJson,
      processJson: baseProfile.processJson,
      filamentJson: filamentProfile.filamentJson,
    },
  });

  if (!result.success || !result.settings) {
    return NextResponse.json({ error: result.error || "Failed to resolve settings" }, { status: 500 });
  }

  return NextResponse.json({ categories: categorizeSettings(result.settings) });
}
