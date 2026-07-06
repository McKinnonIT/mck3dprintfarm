import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const inUseCount = await prisma.sliceJob.count({ where: { filamentProfileId: params.id } });
  if (inUseCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: used by ${inUseCount} slice job(s).` },
      { status: 409 }
    );
  }

  await prisma.filamentProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
