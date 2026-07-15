import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PUBLIC_PRINTER_SELECT, toPublicPrinter } from '@/lib/public-printer-fields'

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      include: {
        printers: {
          select: PUBLIC_PRINTER_SELECT,
        },
      },
    })
    return NextResponse.json(groups.map((group) => ({ ...group, printers: group.printers.map(toPublicPrinter) })))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    
    // Create the group
    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
      },
      include: {
        printers: {
          select: PUBLIC_PRINTER_SELECT,
        },
      },
    })

    // If printerIds are provided, update the printers to belong to this group
    if (body.printerIds && body.printerIds.length > 0) {
      await prisma.printer.updateMany({
        where: {
          id: {
            in: body.printerIds,
          },
        },
        data: {
          groupId: group.id,
        },
      });

      // Fetch the updated group with the new printer assignments
      const updatedGroup = await prisma.group.findUnique({
        where: { id: group.id },
        include: {
          printers: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              operationalStatus: true,
            },
          },
        },
      });

      return NextResponse.json(updatedGroup);
    }

    return NextResponse.json({ ...group, printers: group.printers.map(toPublicPrinter) })
  } catch (error) {
    console.error("POST /api/groups Error:", error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
} 