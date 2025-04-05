import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
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
    return NextResponse.json({ error: 'Failed to create printer' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
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
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 })
  }
} 