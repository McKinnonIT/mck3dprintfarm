import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isValidOriginUrl, removeCameraPath } from '@/lib/camera-proxy-client'
import { syncCameraProxyPath } from '@/lib/camera-path-sync'

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

    const validationError = validateCameraUrls(body) || validateOnvifFields(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

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
          hlsUrl: body.hlsUrl,
          webrtcUrl: body.webrtcUrl,
          cameraStreamMode: body.cameraStreamMode,
          onvifHost: body.onvifHost,
          onvifPort: body.onvifPort,
          onvifUsername: body.onvifUsername,
          onvifPassword: body.onvifPassword,
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
      await syncCameraProxyPath(printer)
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
          hlsUrl: body.hlsUrl,
          webrtcUrl: body.webrtcUrl,
          cameraStreamMode: body.cameraStreamMode,
          onvifHost: body.onvifHost,
          onvifPort: body.onvifPort,
          onvifUsername: body.onvifUsername,
          onvifPassword: body.onvifPassword,
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
      await syncCameraProxyPath(printer)
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
    await syncCameraProxyPath(printer)
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

    const deleted = await prisma.printer.delete({
      where: { id: params.id },
    })
    if (deleted.cameraPathName) {
      await removeCameraPath(deleted.cameraPathName)
    }
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

    const validationError = validateCameraUrls(data) || validateOnvifFields(data)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

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

    if ('hlsUrl' in data || 'webrtcUrl' in data || 'cameraPathName' in data || 'onvifHost' in data) {
      await syncCameraProxyPath(updatedPrinter)
    }

    return NextResponse.json(updatedPrinter);
  } catch (error: any) {
    console.error("PATCH /api/printers/[id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 