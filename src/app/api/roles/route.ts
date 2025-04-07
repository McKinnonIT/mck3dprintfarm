import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/roles - List all roles (Fetch extended info for Admin, basic for others)
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.role === 'ADMIN';

    try {
        const roles = await prisma.role.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                allowedPages: isAdmin, // Only select allowedPages if user is Admin
                _count: { select: { users: isAdmin } } // Only count users if user is Admin
            },
            orderBy: {
                name: 'asc',
            },
        });

        // Format roles, parsing allowedPages if present
        const formattedRoles = roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            // Parse allowedPages if it was selected (i.e., if admin)
            allowedPages: isAdmin ? JSON.parse(role.allowedPages || '[]') : undefined,
            // Include userCount if it was selected (i.e., if admin)
            userCount: isAdmin ? role._count?.users : undefined
        }));

        return NextResponse.json(formattedRoles);
    } catch (error) {
        console.error('Failed to fetch roles:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

// POST /api/roles - Create a new role (Admin only)
export async function POST(request: Request) {
  try {
    // --- Authentication and Authorization ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    // --- Input Validation ---
    const body = await request.json();
    const { name, description, allowedPages = [] } = body; // Default to empty array

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Role name is required.' }, { status: 400 });
    }
    // Ensure allowedPages is an array
    if (!Array.isArray(allowedPages)) {
       return NextResponse.json({ error: 'allowedPages must be an array.' }, { status: 400 });
    }
    
    // --- Database Operation ---
    const allowedPagesString = JSON.stringify(allowedPages);

    const newRole = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description || null,
        allowedPages: allowedPagesString, // Store as string
      },
       select: { // Select fields needed for response
           id: true, 
           name: true, 
           description: true, 
           allowedPages: true
       }
    });

    // --- Response ---
    // Parse the stored JSON string back into an array for the response
    const responseRole = {
      ...newRole,
      allowedPages: JSON.parse(newRole.allowedPages || '[]'),
      userCount: 0 // New role has no users initially
    };
    return NextResponse.json(responseRole, { status: 201 }); // 201 Created

  } catch (error: any) {
    // Handle potential unique constraint violation for role name
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return NextResponse.json({ error: 'A role with this name already exists.' }, { status: 409 }); // 409 Conflict
    }
    console.error('Failed to create role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
} 