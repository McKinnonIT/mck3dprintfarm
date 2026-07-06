import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOrcaBundle } from "@/lib/orca-bundle";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const formData = await request.formData();
  const bundleFile = formData.get("bundle") as File | null;
  if (!bundleFile) {
    return NextResponse.json({ error: "A .orca_printer bundle file is required." }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await bundleFile.arrayBuffer());
    parsed = parseOrcaBundle(buffer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse bundle" },
      { status: 400 }
    );
  }

  const uploadedByUserId = session.user.id;

  const machineProfiles = await Promise.all(
    parsed.machines.map((entry) =>
      prisma.machineProfile.upsert({
        where: { name: entry.name },
        update: { machineJson: entry.json, filename: entry.filename, uploadedByUserId },
        create: { name: entry.name, machineJson: entry.json, filename: entry.filename, uploadedByUserId },
      })
    )
  );

  const slicingProfiles = await Promise.all(
    parsed.processes.map((entry) =>
      prisma.slicingProfile.upsert({
        where: { name: entry.name },
        update: { processJson: entry.json, filename: entry.filename, uploadedByUserId },
        create: { name: entry.name, processJson: entry.json, filename: entry.filename, uploadedByUserId },
      })
    )
  );

  // Filaments are NOT auto-imported - bundles can carry a lot of them (the
  // Voron bundle example had 10). Return them unpersisted so the admin can
  // pick which ones matter in a follow-up modal, then confirm via
  // /api/slicer-profiles/import/filaments.
  return NextResponse.json({
    machineProfiles: machineProfiles.map((p) => p.name),
    slicingProfiles: slicingProfiles.map((p) => p.name),
    filamentCandidates: parsed.filaments,
  });
}
