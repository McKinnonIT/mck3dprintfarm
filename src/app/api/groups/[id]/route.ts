import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: params.id },
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
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }
    return NextResponse.json(group)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    
    // Update the group's basic information
    const group = await prisma.group.update({
      where: { id: params.id },
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

    // If printerIds are provided, update the printer assignments
    if (body.printerIds) {
      // First, remove all printers from this group
      await prisma.printer.updateMany({
        where: { groupId: params.id },
        data: { groupId: null },
      });

      // Then, assign the new printers to this group
      if (body.printerIds.length > 0) {
        await prisma.printer.updateMany({
          where: {
            id: {
              in: body.printerIds,
            },
          },
          data: {
            groupId: params.id,
          },
        });
      }

      // Fetch the updated group with the new printer assignments
      const updatedGroup = await prisma.group.findUnique({
        where: { id: params.id },
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
    console.error("PUT /api/groups/[id] Error:", error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    // First, remove all printers from the group
    await prisma.printer.updateMany({
      where: { groupId: params.id },
      data: { groupId: null },
    })
    
    // Then delete the group
    await prisma.group.delete({
      where: { id: params.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/groups/[id] Error:", error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
} 