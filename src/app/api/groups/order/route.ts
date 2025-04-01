import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Define the request body type
type GroupOrderUpdate = {
  id: string;
  order: number;
};

// PATCH endpoint to update group orders
export async function PATCH(req: Request) {
  try {
    // Check if user is authenticated and has admin role
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can update group order.' },
        { status: 403 }
      )
    }

    // Get request body
    const updates: GroupOrderUpdate[] = await req.json()
    
    // Validate request body
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected array of {id, order} objects.' },
        { status: 400 }
      )
    }

    // Check if each item has id and order
    const isValid = updates.every(
      (item) => typeof item.id === 'string' && typeof item.order === 'number'
    )

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid request body. Each item must have id and order.' },
        { status: 400 }
      )
    }

    // Update order for each group one by one
    for (const { id, order } of updates) {
      await prisma.$executeRaw`UPDATE "Group" SET "order" = ${order} WHERE "id" = ${id}`;
    }

    // Get the groups and printers using a direct query without type issues
    const groups = await prisma.group.findMany({
      include: {
        printers: true
      }
    });
    
    // Sort manually instead of using orderBy
    groups.sort((a, b) => a.order - b.order);

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error updating group order:', error)
    return NextResponse.json(
      { error: 'Failed to update group order' },
      { status: 500 }
    )
  }
} 