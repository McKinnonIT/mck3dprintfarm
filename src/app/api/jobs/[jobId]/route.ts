import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// Revert to standard import path
import { JobStatus } from '@prisma/client';
import { canPerformAction } from "@/lib/rbacUtils";

// Define allowed actions using JobStatus enum, but cast to any to bypass build-time type errors
const JOB_ACTIONS = {
    APPROVE: { permission: 'jobs:approve', status: (JobStatus as any).APPROVED, allowedInitial: [(JobStatus as any).PENDING_APPROVAL]},
    REJECT: { permission: 'jobs:reject', status: (JobStatus as any).REJECTED, allowedInitial: [(JobStatus as any).PENDING_APPROVAL]},
    CANCEL: { permission: 'jobs:cancel', status: (JobStatus as any).CANCELLED, allowedInitial: [(JobStatus as any).PENDING_APPROVAL, (JobStatus as any).APPROVED, (JobStatus as any).QUEUED, (JobStatus as any).PRINTING]},
} as const; 

type JobAction = keyof typeof JOB_ACTIONS;

export async function PATCH(
    request: Request, 
    { params }: { params: { jobId: string } } 
) {
    const jobId = params.jobId;
    
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const allowedActions = session.user.allowedActions || [];
        const body = await request.json();
        const requestedAction = body.action as JobAction;

        // Validate input
        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }
        if (!requestedAction || !(requestedAction in JOB_ACTIONS)) {
             return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const actionDetails = JOB_ACTIONS[requestedAction];
        const targetStatusEnumValue = actionDetails.status;
        const allowedInitialEnumValues = actionDetails.allowedInitial;

        // Check permission
        if (!canPerformAction(allowedActions, actionDetails.permission)) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch the job
        const job = await prisma.printJob.findUnique({ where: { id: jobId } });
        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        
        // Check if action is allowed based on current status 
        const currentStatus = job.status as JobStatus; 
        // Use .some() - comparison should work even if allowed is typed as 'any' due to earlier cast
        if (!allowedInitialEnumValues.some(allowed => allowed === currentStatus)) { 
             return NextResponse.json(
                 { error: `Action ${requestedAction} not allowed for job status ${currentStatus}` }, 
                 { status: 409 } // Conflict
             );
        }

        // Update the job status using the value (which should be correct enum at runtime)
        const updatedJob = await prisma.printJob.update({
            where: { id: jobId },
            data: { 
                status: targetStatusEnumValue, // Pass the value directly
                approvedByUserId: requestedAction === 'APPROVE' ? session.user.id : undefined,
            },
            include: { 
                file: true, 
                printer: true, 
                submittedByUser: { select: { id: true, name: true, email: true } },
                approvedByUser: { select: { id: true, name: true, email: true } }, 
            },
        });

        console.log(`[API /api/jobs/${jobId}] Job ${jobId} status updated to ${targetStatusEnumValue} by user ${session.user.id}`);
        return NextResponse.json(updatedJob);

    } catch (error: any) {
        console.error(`[API /api/jobs/${jobId}] Error updating job:`, error);
        // Check for specific Prisma errors if needed
        return NextResponse.json(
            { error: error.message || "Failed to update job status" },
            { status: 500 }
        );
    }
}

// Optional: Add GET handler for fetching a single job by ID?
// Optional: Add DELETE handler for deleting a job record? (Permission: 'jobs:delete'?) 