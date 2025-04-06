import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log(`PATCH /api/users/${params.id} - Session:`, session);

    if (session?.user?.role !== "ADMIN") {
      console.log(`PATCH /api/users/${params.id} - Forbidden: Role check failed. Expected 'ADMIN', got '${session?.user?.role}'`);
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }
    console.log(`PATCH /api/users/${params.id} - Admin access granted.`);

    const body = await request.json();
    const { name, email, role, password } = body;
    
    if (Object.keys(body).length === 0) {
         return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    const updateData: Prisma.UserUpdateInput = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
        if (!/\S+@\S+\.\S+/.test(email)) {
            return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
        updateData.email = email;
    }
    if (role !== undefined) {
        const validRoles = ["ADMIN", "TEACHER", "STUDENT"];
        const roleToSave = role.toUpperCase();
        if (!validRoles.includes(roleToSave)) {
            return NextResponse.json(
                { error: `Invalid role specified. Valid roles are: ${validRoles.join(', ')}` },
                { status: 400 }
            );
        }
        updateData.role = roleToSave;
    }
    if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 6) {
            return NextResponse.json({ error: "New password must be a string of at least 6 characters" }, { status: 400 });
        }
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
        console.log(`PATCH /api/users/${params.id} - Updating password hash.`);
    }

    if (Object.keys(updateData).length === 0) {
         return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    console.log(`PATCH /api/users/${params.id} - Updated user:`, updatedUser);

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(`PATCH /api/users/${params.id} - Failed to update user:`, error);
    // Handle potential Prisma unique constraint errors (e.g., duplicate email)
     // Use optional chaining for body access in error handler
     const emailFromBody = (request as any)?.body?.email; // Attempt to get email if possible
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return NextResponse.json(
            { error: `Cannot update user: The email '${emailFromBody || "provided"}' may already be in use.` },
            { status: 409 } 
          );
     }
    return NextResponse.json(
      { error: "Failed to update user", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log(`DELETE /api/users/${params.id} - Session:`, session);

    if (session?.user?.role !== "ADMIN") {
      console.log(`DELETE /api/users/${params.id} - Forbidden: Role check failed. Expected 'ADMIN', got '${session?.user?.role}'`);
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }
    console.log(`DELETE /api/users/${params.id} - Admin access granted.`);

    if (params.id === session.user.id) {
      console.log(`DELETE /api/users/${params.id} - Attempted self-deletion.`);
      return NextResponse.json(
        { error: "Cannot delete your own account." },
        { status: 400 }
      );
    }
    
    const userToDelete = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!userToDelete) {
         console.log(`DELETE /api/users/${params.id} - User not found.`);
         return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id: params.id },
    });
    console.log(`DELETE /api/users/${params.id} - User deleted successfully.`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/users/${params.id} - Failed to delete user:`, error);
    return NextResponse.json(
      { error: "Failed to delete user", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 