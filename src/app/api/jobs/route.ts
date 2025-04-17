import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// Try importing from the generated namespace
import { JobStatus } from '.prisma/client';
// Prisma Client includes enum types, no separate import needed for values

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { fileId, printerId } = data;

    // Basic input validation
    if (!fileId || !printerId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId and printerId" },
        { status: 400 }
      );
    }

    // TODO: Add more validation? Check if file and printer exist?

    // Create the job request record
    const newJob = await prisma.printJob.create({
      data: {
        // Fetch file name from the DB based on fileId
        // For now, let's use a placeholder or potentially fetch it
        name: `Job for file ${fileId}`, // Placeholder name
        status: "PENDING_APPROVAL", // Initial status
        fileId: fileId,
        printerId: printerId,
        submittedByUserId: session.user.id,
        // Other fields like submittedAt will default based on schema
      },
    });

    console.log(`[API /api/jobs] Job created: ${newJob.id}`);

    return NextResponse.json(newJob, { status: 201 }); // Return created job with 201 status

  } catch (error: any) {
    console.error("[API /api/jobs] Error creating job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create job request" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // e.g., 'PRINTING', 'APPROVED,QUEUED', 'PENDING_APPROVAL'
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role; // Assuming role is available in session

    // Define the query options
    let queryOptions: any = {
      skip: skip,
      take: limit,
      include: {
        file: true, // Include related file data
        printer: true, // Include related printer data
        submittedByUser: { // Include submitting user details
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
      orderBy: {
        submittedAt: 'desc', // Show newest jobs first
      },
      where: {}, // Initialize where clause
    };

    // Apply RBAC - Admins see all, others see their own
    if (userRole !== 'ADMIN') {
      queryOptions.where.submittedByUserId = userId;
    }

    // Apply Status Filter if provided
    if (statusFilter) {
      // Handle multiple statuses potentially passed comma-separated for the 'Approved' tab
      // Validate against the actual enum keys available via Prisma
      // Use the imported Enum for validation
      const statuses = statusFilter.split(',').filter(s => s in JobStatus) as JobStatus[];
      if (statuses.length > 0) {
        queryOptions.where.status = {
          in: statuses,
        };
      }
    }

    // Also fetch the total count for pagination (without skip/take)
    const totalJobs = await prisma.printJob.count({ where: queryOptions.where });

    const jobs = await prisma.printJob.findMany(queryOptions);

    // Return jobs along with pagination info
    return NextResponse.json({
      jobs,
      totalJobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
    });

  } catch (error: any) {
    console.error("[API /api/jobs] Error fetching jobs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

// TODO: Implement PATCH/DELETE handlers if needed for job management 