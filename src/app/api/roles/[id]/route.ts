import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/roles/[id] - Get a specific role (Admin only, for editing)
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const role = await prisma.role.findUnique({
            where: { id: params.id },
            select: { 
                id: true, 
                name: true, 
                description: true, 
                allowedPages: true, // Include allowedPages
                allowedActions: true, // Include allowedActions
                _count: { select: { users: true } } // Include user count
            }
        });

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }
        // Parse allowedPages for the response
        return NextResponse.json({ 
            ...role, 
            allowedPages: JSON.parse(role.allowedPages || '[]'),
            allowedActions: JSON.parse(role.allowedActions || '[]'), // Parse allowedActions
            userCount: role._count.users
        });
    } catch (error) {
        console.error(`Failed to fetch role ${params.id}:`, error);
        return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }
}

// PATCH /api/roles/[id] - Update a specific role (Admin only)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, allowedPages, allowedActions } = body;

    const dataToUpdate: { name?: string; description?: string | null; allowedPages?: string; allowedActions?: string } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Role name cannot be empty' }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
    }

    if (description !== undefined) {
      dataToUpdate.description = description || null;
    }

    // Handle allowedPages update
    if (allowedPages !== undefined) {
        if (!Array.isArray(allowedPages)) {
           return NextResponse.json({ error: 'allowedPages must be an array.' }, { status: 400 });
        }
        dataToUpdate.allowedPages = JSON.stringify(allowedPages);
    }

    // Handle allowedActions update
    if (allowedActions !== undefined) {
        if (!Array.isArray(allowedActions)) {
            return NextResponse.json({ error: 'allowedActions must be an array.' }, { status: 400 });
        }
        dataToUpdate.allowedActions = JSON.stringify(allowedActions);
    }

    const updatedRole = await prisma.role.update({
      where: { id: params.id },
      data: dataToUpdate,
      select: { id: true, name: true, description: true, allowedPages: true, allowedActions: true } // Select needed fields
    });

    // Parse allowedPages and allowedActions for the response
    return NextResponse.json({ 
        ...updatedRole, 
        allowedPages: JSON.parse(updatedRole.allowedPages || '[]'),
        allowedActions: JSON.parse(updatedRole.allowedActions || '[]') 
    });

  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return NextResponse.json({ error: 'A role with this name already exists.' }, { status: 409 });
    }
    if (error.code === 'P2025') { // Record to update not found
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    console.error(`Failed to update role ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// DELETE /api/roles/[id] - Delete a specific role (Admin only)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Prevent deletion of the default ADMIN role (assuming its name is 'ADMIN')
    const role = await prisma.role.findUnique({ where: { id: params.id }, select: { name: true } });
    if (role?.name === 'ADMIN') {
        return NextResponse.json({ error: 'Cannot delete the default ADMIN role.' }, { status: 400 });
    }

    // Check if any users are assigned to this role
    const usersCount = await prisma.user.count({ where: { roleId: params.id } });
    if (usersCount > 0) {
      return NextResponse.json({ error: `Cannot delete role as it is assigned to ${usersCount} user(s). Reassign users first.` }, { status: 400 });
    }

    await prisma.role.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Role deleted successfully' }, { status: 200 });

  } catch (error: any) {
    if (error.code === 'P2025') { // Record to delete not found
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    console.error(`Failed to delete role ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
} 