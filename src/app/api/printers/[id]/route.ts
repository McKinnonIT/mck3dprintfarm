import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    
    // If we're only updating operational status (from status check)
    if (body.operationalStatus !== undefined && !body.status) {
      const printer = await prisma.printer.update({
        where: { id: params.id },
        data: {
          operationalStatus: body.operationalStatus,
          printStartTime: body.printStartTime,
          printTimeElapsed: body.printTimeElapsed,
          printTimeRemaining: body.printTimeRemaining,
          printImageUrl: body.printImageUrl,
          webcamUrl: body.webcamUrl,
          rtspUrl: body.rtspUrl,
          lastSeen: new Date(),
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      return NextResponse.json(printer)
    }
    
    // If we're updating management status (from edit form)
    if (body.status !== undefined) {
      const printer = await prisma.printer.update({
        where: { id: params.id },
        data: {
          name: body.name,
          type: body.type,
          apiUrl: body.apiUrl,
          apiKey: body.apiKey,
          webcamUrl: body.webcamUrl,
          rtspUrl: body.rtspUrl,
          status: body.status, // This is the management status (active/disabled/maintenance)
          groupId: body.groupId,
          machineProfileId: body.machineProfileId,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      return NextResponse.json(printer)
    }

    // If we're updating both
    const printer = await prisma.printer.update({
      where: { id: params.id },
      data: {
        name: body.name,
        type: body.type,
        apiUrl: body.apiUrl,
        apiKey: body.apiKey,
        webcamUrl: body.webcamUrl,
        rtspUrl: body.rtspUrl,
        status: body.status,
        operationalStatus: body.operationalStatus,
        printStartTime: body.printStartTime,
        printTimeElapsed: body.printTimeElapsed,
        printTimeRemaining: body.printTimeRemaining,
        printImageUrl: body.printImageUrl,
        lastSeen: new Date(),
        groupId: body.groupId,
        machineProfileId: body.machineProfileId,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return NextResponse.json(printer)
  } catch (error) {
    console.error("PUT /api/printers/[id] Error:", error);
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    await prisma.printer.delete({
      where: { id: params.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/printers/[id] Error:", error);
    return NextResponse.json({ error: 'Failed to delete printer' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const printer = await prisma.printer.findUnique({
      where: { id: params.id },
    });

    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(printer);
  } catch (error: any) {
    console.error("Error fetching printer:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const data = await request.json();
    
    // Validate the data
    if (data.printTimeElapsed !== undefined && typeof data.printTimeElapsed !== 'number' && data.printTimeElapsed !== null) {
      return NextResponse.json(
        { error: `printTimeElapsed must be a number or null` },
        { status: 400 }
      );
    }
    
    if (data.printTimeRemaining !== undefined && typeof data.printTimeRemaining !== 'number' && data.printTimeRemaining !== null) {
      return NextResponse.json(
        { error: `printTimeRemaining must be a number or null` },
        { status: 400 }
      );
    }
    
    // Check if printer exists
    const printer = await prisma.printer.findUnique({
      where: { id: params.id },
    });

    if (!printer) {
      return NextResponse.json(
        { error: `Printer with id ${params.id} not found` },
        { status: 404 }
      );
    }
    
    // Update the printer
    console.log(`Manually updating printer ${printer.name} with:`, data);
    
    const updatedPrinter = await prisma.printer.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updatedPrinter);
  } catch (error: any) {
    console.error("PATCH /api/printers/[id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 