import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name cannot be blank" }, { status: 400 });
  }

  try {
    const profile = await prisma.slicingProfile.update({
      where: { id: params.id },
      data: { name: name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json(profile);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: `A slicing profile named "${name}" already exists.` }, { status: 409 });
    }
    console.error("PATCH /api/slicing-profiles/[id] Error:", error);
    return NextResponse.json({ error: "Failed to rename slicing profile" }, { status: 500 });
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

  const inUseCount = await prisma.sliceJob.count({ where: { slicingProfileId: params.id } });
  if (inUseCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: used by ${inUseCount} slice job(s).` },
      { status: 409 }
    );
  }

  await prisma.slicingProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
