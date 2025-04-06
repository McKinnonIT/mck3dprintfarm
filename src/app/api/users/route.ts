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
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    console.log("Fetched users:", users.length);

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users - Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log("PATCH /api/users - Session:", session);

    if (session?.user?.role !== "ADMIN") {
      console.log(`PATCH /api/users - Forbidden: Role check failed. Expected 'ADMIN', got '${session?.user?.role}'`);
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    console.log("PATCH /api/users - Admin access granted.");
    const body = await request.json();
    const { id, role } = body;

    if (!id || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["admin", "teacher", "student", "ADMIN", "TEACHER", "STUDENT"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }
    
    const roleToSave = role.toUpperCase();

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: roleToSave },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    console.log("Updated user role:", {id: updatedUser.id, role: updatedUser.role});

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PATCH /api/users - Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log("POST /api/users - Session:", session);

    // --- Authorization Check ---
    if (session?.user?.role !== "ADMIN") {
      console.log(`POST /api/users - Forbidden: Role check failed. Expected 'ADMIN', got '${session?.user?.role}'`);
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }
    console.log("POST /api/users - Admin access granted.");

    // --- Input Parsing and Validation ---
    const body = await request.json();
    const { email, name, role, password } = body;

    if (!email || !role || !password) {
      return NextResponse.json(
        { error: "Missing required fields (email, role, password)" },
        { status: 400 }
      );
    }

    // Basic email format check (optional but recommended)
    if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["ADMIN", "TEACHER", "STUDENT"];
    const roleToSave = role.toUpperCase(); // Standardize to uppercase
    if (!validRoles.includes(roleToSave)) {
      return NextResponse.json(
        { error: `Invalid role specified. Valid roles are: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Check password length (optional)
    if (password.length < 6) { // Example minimum length
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    // --- Check for Existing User ---
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: `User with email ${email} already exists.` },
        { status: 409 } // 409 Conflict
      );
    }

    // --- Hash Password ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // --- Create User ---
    const newUser = await prisma.user.create({
      data: {
        email: email,
        name: name || null, // Allow optional name
        password: hashedPassword,
        role: roleToSave,
      },
      select: { // Select fields to return (exclude password)
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    console.log("POST /api/users - Created new user:", newUser);

    return NextResponse.json(newUser, { status: 201 }); // 201 Created

  } catch (error) {
    console.error("POST /api/users - Failed to create user:", error);
    // Handle potential Prisma unique constraint errors more gracefully
    // Use optional chaining for body access in error handler
    const emailFromBody = (error as any)?.meta?.target?.includes('email') ? (request as any)?.body?.email : 'the provided email';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         return NextResponse.json(
           { error: `User with email ${emailFromBody} already exists.` },
           { status: 409 } 
         );
    }
    return NextResponse.json(
      { error: "Failed to create user", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 