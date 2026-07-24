import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// Re-add auth imports for POST/PUT
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isValidOriginUrl } from '@/lib/camera-proxy-client'
import { syncCameraProxyPath } from '@/lib/camera-path-sync'
// Remove unused auth imports if session check is removed
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'

function validateCameraUrls(body: { webcamUrl?: string; hlsUrl?: string; webrtcUrl?: string }): string | null {
  for (const field of ['webcamUrl', 'hlsUrl', 'webrtcUrl'] as const) {
    const value = body[field]
    if (value && !isValidOriginUrl(value)) {
      return `${field} must be a valid http(s) URL`
    }
  }
  return null
}

function validateOnvifFields(body: { onvifHost?: string; onvifPort?: number }): string | null {
  if (body.onvifHost !== undefined && body.onvifHost !== null && !body.onvifHost.trim()) {
    return 'onvifHost cannot be blank'
  }
  if (body.onvifPort !== undefined && body.onvifPort !== null) {
    if (!Number.isInteger(body.onvifPort) || body.onvifPort < 1 || body.onvifPort > 65535) {
      return 'onvifPort must be an integer between 1 and 65535'
    }
  }
  return null
}

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

    const validationError = validateCameraUrls(body) || validateOnvifFields(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const printer = await prisma.printer.create({
      data: {
        name: body.name,
        type: body.type,
        apiUrl: body.apiUrl,
        apiKey: body.apiKey,
        serialNumber: body.serialNumber,
        webcamUrl: body.webcamUrl,
        hlsUrl: body.hlsUrl,
        webrtcUrl: body.webrtcUrl,
        cameraStreamMode: body.cameraStreamMode,
        onvifHost: body.onvifHost,
        onvifPort: body.onvifPort,
        onvifUsername: body.onvifUsername,
        onvifPassword: body.onvifPassword,
        status: body.status || "active",
        operationalStatus: body.operationalStatus || "idle",
        groupId: body.groupId,
        filamentMaterial: body.filamentMaterial,
        filamentColor: body.filamentColor,
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
    await syncCameraProxyPath(printer)
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

    const validationError = validateCameraUrls(body) || validateOnvifFields(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
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
        hlsUrl: body.hlsUrl,
        webrtcUrl: body.webrtcUrl,
        cameraStreamMode: body.cameraStreamMode,
        onvifHost: body.onvifHost,
        onvifPort: body.onvifPort,
        onvifUsername: body.onvifUsername,
        onvifPassword: body.onvifPassword,
        status: body.status,
        operationalStatus: body.operationalStatus,
        printStartTime: body.printStartTime,
        printTimeElapsed: body.printTimeElapsed,
        printTimeRemaining: body.printTimeRemaining,
        printImageUrl: body.printImageUrl,
        filamentMaterial: body.filamentMaterial,
        filamentColor: body.filamentColor,
      },
    })
    await syncCameraProxyPath(printer)
    return NextResponse.json(printer)
  } catch (error) {
     console.error("PUT /api/printers Error:", error);
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 })
  }
} 