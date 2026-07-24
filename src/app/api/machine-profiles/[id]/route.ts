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
      bedStlFilename: true,
      allowedSlicingProfiles: { select: { id: true, name: true } },
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Machine profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

// Renames the machine and/or sets its full allow-list of Slicing Profiles
// (empty = allow the whole shared library - see the schema comment on
// allowedSlicingProfiles). Either field may be sent on its own.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { name, allowedSlicingProfileIds } = await request.json();
  if (name === undefined && allowedSlicingProfileIds === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (allowedSlicingProfileIds !== undefined && !Array.isArray(allowedSlicingProfileIds)) {
    return NextResponse.json({ error: "allowedSlicingProfileIds must be an array" }, { status: 400 });
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "name cannot be blank" }, { status: 400 });
  }

  try {
    const profile = await prisma.machineProfile.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(allowedSlicingProfileIds !== undefined
          ? { allowedSlicingProfiles: { set: allowedSlicingProfileIds.map((id: string) => ({ id })) } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        allowedSlicingProfiles: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(profile);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: `A machine profile named "${name}" already exists.` }, { status: 409 });
    }
    console.error("PATCH /api/machine-profiles/[id] Error:", error);
    return NextResponse.json({ error: "Failed to update machine profile" }, { status: 500 });
  }
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
