import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.filamentProfile.findMany({
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
