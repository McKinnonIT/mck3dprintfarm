import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeBuildVolume } from "@/lib/machine-build-volume";

// Creation happens via /api/slicer-profiles/import (bundle upload), not
// here - any authenticated user can list (needed for the printer
// assignment dropdown), profile content is never returned - machineJson is
// only fetched here to derive buildVolume, and stripped before responding.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.machineProfile.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      filename: true,
      createdAt: true,
      machineJson: true,
      _count: { select: { printers: true } },
      // Empty list = unrestricted; used by the Files-page Slice panel to
      // filter its Slicing Profile dropdown per selected printer.
      allowedSlicingProfiles: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const response = profiles.map(({ machineJson, ...rest }) => ({
    ...rest,
    buildVolume: computeBuildVolume(machineJson),
  }));

  return NextResponse.json(response);
}
