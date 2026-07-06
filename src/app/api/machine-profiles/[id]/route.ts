import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.machineProfile.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      description: true,
      filename: true,
      createdAt: true,
      allowedSlicingProfiles: { select: { id: true, name: true } },
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Machine profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

// Sets this machine's full allow-list of Slicing Profiles (empty = allow
// the whole shared library - see the schema comment on allowedSlicingProfiles).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { allowedSlicingProfileIds } = await request.json();
  if (!Array.isArray(allowedSlicingProfileIds)) {
    return NextResponse.json({ error: "allowedSlicingProfileIds must be an array" }, { status: 400 });
  }

  const profile = await prisma.machineProfile.update({
    where: { id: params.id },
    data: {
      allowedSlicingProfiles: {
        set: allowedSlicingProfileIds.map((id: string) => ({ id })),
      },
    },
    select: {
      id: true,
      name: true,
      allowedSlicingProfiles: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(profile);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const inUseCount = await prisma.printer.count({ where: { machineProfileId: params.id } });
  if (inUseCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: assigned to ${inUseCount} printer(s).` },
      { status: 409 }
    );
  }

  await prisma.machineProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
