import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.slicingProfile.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      filename: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(profiles);
}

// Creates a new Slicing Profile by cloning an existing one's raw JSON
// (preserving its "inherits" chain) and overlaying the admin's edited
// fields on top - the same merge OrcaSlicer's CLI already accepts for
// one-off "Custom Settings" slices, just persisted as a reusable profile.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { baseSlicingProfileId, name, description, overrides } = await request.json();
  if (!baseSlicingProfileId || !name) {
    return NextResponse.json({ error: "baseSlicingProfileId and name are required" }, { status: 400 });
  }

  const baseProfile = await prisma.slicingProfile.findUnique({ where: { id: baseSlicingProfileId } });
  if (!baseProfile) {
    return NextResponse.json({ error: "Base Slicing Profile not found" }, { status: 404 });
  }

  const flatOverrides: Record<string, unknown> = {};
  if (overrides && typeof overrides === "object") {
    for (const categoryValues of Object.values(overrides as Record<string, unknown>)) {
      if (categoryValues && typeof categoryValues === "object") {
        Object.assign(flatOverrides, categoryValues);
      }
    }
  }

  const merged = { ...JSON.parse(baseProfile.processJson), ...flatOverrides, name };

  try {
    const profile = await prisma.slicingProfile.create({
      data: {
        name,
        description: description || null,
        processJson: JSON.stringify(merged),
        filename: `${name}.json`,
        uploadedByUserId: session.user.id,
      },
    });
    return NextResponse.json(profile);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: `A Slicing Profile named "${name}" already exists.` }, { status: 409 });
    }
    throw error;
  }
}
