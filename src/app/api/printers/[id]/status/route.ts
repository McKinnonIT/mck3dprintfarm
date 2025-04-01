import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json();
    
    const printer = await prisma.printer.update({
      where: {
        id: params.id,
      },
      data: {
        status,
        lastSeen: new Date(),
      },
    });

    return NextResponse.json(printer);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update printer status" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const printer = await prisma.printer.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!printer) {
      return NextResponse.json(
        { error: "Printer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(printer);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch printer status" },
      { status: 500 }
    );
  }
} 