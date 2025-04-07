import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// Re-add auth imports for POST/PUT
import { getServerSession } from 'next-auth' 
import { authOptions } from '@/lib/auth'
// Remove unused auth imports if session check is removed
// import { getServerSession } from 'next-auth' 
// import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    // Remove session check
    // const session = await getServerSession(authOptions)
    // 
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    const printers = await prisma.printer.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })
    
    return NextResponse.json(printers)
  } catch (error) {
    console.error('Error fetching printers:', error)
    return NextResponse.json({ error: 'Failed to fetch printers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Add session AND role check
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') { // Check for ADMIN role
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    
    const printer = await prisma.printer.create({
      data: {
        name: body.name,
        type: body.type,
        apiUrl: body.apiUrl,
        apiKey: body.apiKey,
        serialNumber: body.serialNumber,
        webcamUrl: body.webcamUrl,
        status: body.status || "active",
        operationalStatus: body.operationalStatus || "idle",
        groupId: body.groupId,
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
    console.error("POST /api/printers Error:", error);
    return NextResponse.json({ error: 'Failed to create printer' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // Add session AND role check
    const session = await getServerSession(authOptions)
     if (session?.user?.role !== 'ADMIN') { // Check for ADMIN role
       return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    // This PUT seems intended for bulk updates? Usually PUT is on /api/printers/[id]
    // Assuming it should require admin regardless.
    // If it's meant for something else, the logic might need adjustment.
    // For now, just adding the admin check.
    
    // Example: Assuming it updates based on ID in body (adjust if needed)
    if (!body.id) {
        return NextResponse.json({ error: 'Printer ID required for update.' }, { status: 400 });
    }
    
    const printer = await prisma.printer.update({
      where: { id: body.id },
      data: {
        name: body.name,
        type: body.type,
        apiUrl: body.apiUrl,
        apiKey: body.apiKey,
        serialNumber: body.serialNumber,
        webcamUrl: body.webcamUrl,
        status: body.status,
        operationalStatus: body.operationalStatus,
        printStartTime: body.printStartTime,
        printTimeElapsed: body.printTimeElapsed,
        printTimeRemaining: body.printTimeRemaining,
        printImageUrl: body.printImageUrl,
      },
    })
    return NextResponse.json(printer)
  } catch (error) {
     console.error("PUT /api/printers Error:", error);
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 })
  }
} 