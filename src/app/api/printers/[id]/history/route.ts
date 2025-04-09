import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Placeholder type for history entries - adjust as needed based on actual API responses
type JobHistoryEntry = {
  timestamp: number | string;
  filename: string;
  duration?: number;
  status: 'completed' | 'failed' | 'cancelled' | 'unknown';
  // Add other relevant fields like filament used, etc.
};

// Placeholder functions for fetching history (to be implemented in respective helper files)
async function getMoonrakerHistory(printer): Promise<JobHistoryEntry[]> {
  console.log(`Placeholder: Fetching history for Moonraker ${printer.id}`);
  // const response = await fetch(`${printer.apiUrl}/server/history/list`); 
  // ... parse response ...
  return [{ timestamp: Date.now(), filename: 'moonraker_test.gcode', status: 'completed' }]; // Placeholder data
}

async function getPrusaLinkHistory(printer): Promise<JobHistoryEntry[]> {
  console.log(`Placeholder: Fetching history for PrusaLink ${printer.id}`);
  // PrusaLink might only show the *last* job via /api/job or /api/print
  // const jobResponse = await fetch(`${printer.apiUrl}/api/job`, { headers: { 'X-Api-Key': printer.apiKey }});
  // ... parse response ...
  return [{ timestamp: Date.now(), filename: 'prusalink_test.gcode', status: 'completed' }]; // Placeholder data
}

async function getBambuLabHistory(printer): Promise<JobHistoryEntry[]> {
  console.log(`Placeholder: Fetching history for BambuLab ${printer.id}`);
  // BambuLab might require cloud API or MQTT interactions
  return [{ timestamp: Date.now(), filename: 'bambulab_test.gcode', status: 'completed' }]; // Placeholder data
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const printerId = params.id;
  if (!printerId) {
    return NextResponse.json({ message: 'Printer ID is required' }, { status: 400 });
  }

  try {
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return NextResponse.json({ message: 'Printer not found' }, { status: 404 });
    }

    let history: JobHistoryEntry[] = [];

    switch (printer.type) {
      case 'moonraker':
        history = await getMoonrakerHistory(printer);
        break;
      case 'prusalink':
        history = await getPrusaLinkHistory(printer);
        break;
      case 'bambulab':
        history = await getBambuLabHistory(printer);
        break;
      default:
        return NextResponse.json({ message: `History not supported for printer type: ${printer.type}` }, { status: 400 });
    }

    return NextResponse.json(history);

  } catch (error) {
    console.error(`Error fetching history for printer ${printerId}:`, error);
    return NextResponse.json({ message: `Failed to fetch history: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 