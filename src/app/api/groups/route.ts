import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
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
    })
    return NextResponse.json(groups)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Create the group
    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
      },
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

    return NextResponse.json(group)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
} 