import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log("GET /api/users - Session:", session);

    const sessionRole = session?.user?.role;
    const expectedRole = "ADMIN";
    console.log(`GET /api/users - Comparing sessionRole ('${sessionRole}', type: ${typeof sessionRole}) with expectedRole ('${expectedRole}', type: ${typeof expectedRole})`);
    
    if (sessionRole !== expectedRole) {
      console.log(`GET /api/users - Forbidden: Role check FAILED.`);
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    } else {
       console.log(`GET /api/users - Role check PASSED.`);
    }

    console.log("GET /api/users - Admin access granted.");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    console.log("Fetched users:", users.length);

    const formattedUsers = users.map(user => ({
      ...user,
      roleId: user.role?.id,
      roleName: user.role?.name ?? 'N/A',
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("GET /api/users - Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user (Admin only)
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { email, name, password, roleId } = body;

        if (!email || !password || !roleId) {
            return NextResponse.json({ error: 'Email, password, and role ID are required' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                roleId,
                // isEnabled defaults to true in the schema
            },
            select: {
                id: true,
                email: true,
                name: true,
                roleId: true,
                createdAt: true,
                updatedAt: true,
                isEnabled: true, // Select isEnabled
                role: { select: { name: true } } // Select role name
            }
        });

        // Format response to match expected User interface (including isEnabled)
        const responseUser = {
            ...newUser,
            roleName: newUser.role?.name ?? 'Unknown' // Provide fallback
        };

        return NextResponse.json(responseUser, { status: 201 });
    } catch (error: any) {
        console.error("Create User Error:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed (e.g., bad roleId)
             return NextResponse.json({ error: 'Invalid Role ID provided' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
} 