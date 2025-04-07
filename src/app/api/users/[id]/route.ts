import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

// GET /api/users/[id] - Fetch a single user (Admin Only)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Flatten role info
    const formattedUser = {
        ...user,
        roleId: user.role?.id,
        roleName: user.role?.name ?? 'N/A',
    };

    return NextResponse.json(formattedUser);

  } catch (error) {
    console.error(`GET /api/users/${params.id} - Failed:`, error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PATCH /api/users/[id] - Update a user (Admin Only)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, roleId, password, isEnabled } = body;
    const userId = params.id;

    // --- Data to Update ---
    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (email) {
      if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      dataToUpdate.email = email;
    }
    if (name !== undefined) { // Allow setting name to null or empty string
      dataToUpdate.name = name;
    }
    if (roleId) {
      // Validate Role ID
      const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
      if (!roleExists) {
        return NextResponse.json({ error: `Role with ID ${roleId} not found.` }, { status: 400 });
      }
      dataToUpdate.role = { connect: { id: roleId } }; // Connect via relation
    }
    if (password) {
       if (password.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
       }
       const salt = await bcrypt.genSalt(10);
       dataToUpdate.password = await bcrypt.hash(password, salt);
    }
    if (isEnabled !== undefined && typeof isEnabled === 'boolean') {
        dataToUpdate.isEnabled = isEnabled;
    }

    if (Object.keys(dataToUpdate).length === 0) {
         return NextResponse.json({ error: "No update data provided." }, { status: 400 });
    }

    // --- Update User ---
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    
    // Flatten role info for response
     const formattedUser = {
        ...updatedUser,
        roleId: updatedUser.role?.id,
        roleName: updatedUser.role?.name ?? 'N/A',
    };

    console.log(`PATCH /api/users/${userId} - Updated user:`, { id: formattedUser.id, email: formattedUser.email, roleId: formattedUser.roleId, isEnabled: formattedUser.isEnabled });
    return NextResponse.json(formattedUser);

  } catch (error: any) {
     // Check for unique constraint violation (e.g., email)
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         // Safely check if the target includes 'email'
         const target = error.meta?.target as string[] | undefined;
         if (target && target.includes('email')) {
             return NextResponse.json({ error: `User with this email already exists.` }, { status: 409 });
         } else {
             // Handle other unique constraint errors if necessary
             return NextResponse.json({ error: `Unique constraint violation: ${target?.join(', ')}` }, { status: 409 });
         }
     }
     // Check for record not found on update
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
         return NextResponse.json({ error: "User not found." }, { status: 404 });
     }
    console.error(`PATCH /api/users/${params.id} - Failed:`, error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete a user (Admin Only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const userId = params.id;

    // Optional: Prevent deleting the default admin user?
    // const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    // const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
    // if (userToDelete?.email === adminEmail) {
    //    return NextResponse.json({ error: "Cannot delete the default admin user." }, { status: 400 });
    // }

    // Optional: Prevent self-deletion?
    // if (session.user.id === userId) {
    //    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
    // }

    await prisma.user.delete({
      where: { id: userId },
    });

    console.log(`DELETE /api/users/${userId} - Deleted user.`);
    return NextResponse.json({ success: true, message: "User deleted successfully." });

  } catch (error: any) {
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
         return NextResponse.json({ error: "User not found." }, { status: 404 });
     }
    console.error(`DELETE /api/users/${params.id} - Failed:`, error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
} 