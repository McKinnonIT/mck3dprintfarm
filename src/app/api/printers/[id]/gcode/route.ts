import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Import the GCode sending utilities
const { sendGCode } = require('@/lib/moonraker-send-gcode');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get printer information
    const printerId = params.id;
    const printer = await prisma.printer.findUnique({
      where: { id: printerId }
    });
    
    if (!printer) {
      return NextResponse.json(
        { success: false, message: 'Printer not found' },
        { status: 404 }
      );
    }
    
    // Get the GCode command from the request body
    const body = await request.json();
    const { command } = body;
    
    if (!command) {
      return NextResponse.json(
        { success: false, message: 'GCode command is required' },
        { status: 400 }
      );
    }
    
    // Handle different printer types
    if (printer.type.toLowerCase() === 'moonraker') {
      // Send the GCode command to the Moonraker printer
      try {
        console.log(`[API] Sending GCode '${command}' to Moonraker printer at ${printer.apiUrl}`);
        
        const result = await sendGCode(
          printer.apiUrl,
          printer.apiKey,
          command
        );
        
        if (!result.success) {
          console.error(`[API] Error sending GCode: ${result.message}`);
          return NextResponse.json(
            { success: false, message: result.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'GCode command sent successfully',
          data: result.data
        });
      } catch (error) {
        console.error('[API] Error sending GCode:', error);
        return NextResponse.json(
          { 
            success: false, 
            message: error instanceof Error ? error.message : 'Unknown error sending GCode'
          },
          { status: 500 }
        );
      }
    } else {
      // For now, only Moonraker printers are supported
      return NextResponse.json(
        { success: false, message: `GCode sending not implemented for printer type: ${printer.type}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Error in GCode endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error in GCode endpoint'
      },
      { status: 500 }
    );
  }
} 