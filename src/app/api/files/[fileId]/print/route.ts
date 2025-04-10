// DEPRECATED ROUTE - Use POST /api/print-jobs instead

import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: { fileId: string } }) {
    console.warn(`[DEPRECATED] POST /api/files/${params.fileId}/print called. This route is deprecated. Use POST /api/print-jobs.`);
    return NextResponse.json(
        { error: "This API endpoint (/api/files/[fileId]/print) is deprecated. Please use POST /api/print-jobs." }, 
        { status: 410 } // 410 Gone
    );
} 
