import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface FilamentCandidate {
  name: string;
  filename: string;
  json: string;
}

// Persists the admin-selected subset of filament profiles a bundle import
// found (see /api/slicer-profiles/import) - split into its own step so
// bundles with many filaments don't all get imported unconditionally.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { filaments } = await request.json();
  if (!Array.isArray(filaments) || filaments.length === 0) {
    return NextResponse.json({ error: "filaments must be a non-empty array" }, { status: 400 });
  }

  const uploadedByUserId = session.user.id;
  const filamentProfiles = await Promise.all(
    (filaments as FilamentCandidate[]).map((entry) =>
      prisma.filamentProfile.upsert({
        where: { name: entry.name },
        update: { filamentJson: entry.json, filename: entry.filename, uploadedByUserId },
        create: { name: entry.name, filamentJson: entry.json, filename: entry.filename, uploadedByUserId },
      })
    )
  );

  return NextResponse.json({ filamentProfiles: filamentProfiles.map((p) => p.name) });
}
