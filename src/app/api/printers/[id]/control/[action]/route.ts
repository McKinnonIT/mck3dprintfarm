import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pausePrusaLinkPrint, cancelPrusaLinkPrint, resumePrusaLinkPrint } from '@/lib/prusalink';
// Import necessary printer control helper functions (to be created/implemented)
// import { pauseMoonraker, cancelMoonraker } from '@/lib/moonraker'; 
// import { pauseBambuLab, cancelBambuLab } from '@/lib/bambulab';

// Helper function to get Job ID specifically for PrusaLink within this route
// This prevents needing to modify the shared prusalink.ts helpers further
async function getJobIdFromPrusa(apiUrl: string, apiKey: string): Promise<string | null> {
  const url = `${apiUrl}/api/v1/job`;
  const headers = { 'X-Api-Key': apiKey };
  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) return null;
    const data = await response.json();
    // Adjust if the actual structure is different, e.g., data.id directly?
    // Need confirmation of the actual /api/v1/job response structure.
    // Assuming data.id or data.job.id based on common patterns. Let's try data.job.id first.
    return data?.job?.id ?? data?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; action: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const printerId = params.id;
  const action = params.action.toLowerCase(); // 'pause', 'resume', or 'cancel'

  if (!printerId || (action !== 'pause' && action !== 'resume' && action !== 'cancel')) {
    return NextResponse.json({ message: 'Invalid printer ID or action' }, { status: 400 });
  }

  try {
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return NextResponse.json({ message: 'Printer not found' }, { status: 404 });
    }

    // --- Get Job ID for PrusaLink --- 
    let jobId: string | null = null;
    if (printer.type === 'prusalink') {
      if (!printer.apiUrl || !printer.apiKey) {
        return NextResponse.json({ message: 'PrusaLink printer API URL or Key is missing' }, { status: 500 });
      }
      jobId = await getJobIdFromPrusa(printer.apiUrl, printer.apiKey);
      if (!jobId && (action === 'pause' || action === 'resume' || action === 'cancel')) {
          // If an action requires a job ID and we couldn't get one, it implies no active job
          console.warn(`PrusaLink Action '${action}' blocked: No active job ID found for printer ${printerId}.`);
          return NextResponse.json({ message: `Cannot perform action '${action}'. No active print job found.` }, { status: 409 }); // 409 Conflict - state prevents action
      }
    }
    // --- End Get Job ID ---

    // --- Check Printer State Before Sending Command ---
    const currentState = printer.operationalStatus?.toLowerCase();
    let allowed = false;
    let stateErrorMessage = `Cannot perform action '${action}'. Printer state is '${currentState || 'unknown'}'.`;

    switch (action) {
      case 'pause':
        allowed = currentState === 'printing';
        if (!allowed) stateErrorMessage = `Cannot pause. Printer is not currently printing (state: ${currentState || 'unknown'}).`;
        break;
      case 'resume':
        allowed = currentState === 'paused';
        if (!allowed) stateErrorMessage = `Cannot resume. Printer is not currently paused (state: ${currentState || 'unknown'}).`;
        break;
      case 'cancel':
        allowed = currentState === 'printing' || currentState === 'paused';
        if (!allowed) stateErrorMessage = `Cannot cancel. Printer is not printing or paused (state: ${currentState || 'unknown'}).`;
        break;
      default: // Should not happen due to earlier check, but good practice
        allowed = false;
        stateErrorMessage = `Action '${action}' is not supported.`; 
        break;
    }

    if (!allowed) {
      console.warn(`Action '${action}' blocked for printer ${printerId} due to invalid state: ${currentState}`);
      // Use 409 Conflict as the state prevents the action
      return NextResponse.json({ message: stateErrorMessage }, { status: 409 }); 
    }
    // --- End State Check ---

    let success = false;
    let message = `Action '${action}' initiated for ${printer.name}.`;

    // --- Call Printer-Specific Functions ---
    switch (printer.type) {
      case 'moonraker':
        if (action === 'pause') {
          // success = await pauseMoonraker(printer);
          console.log(`Placeholder: Pausing Moonraker printer ${printer.id}`);
          success = true; // Placeholder
        } else if (action === 'resume') {
          // success = await resumeMoonraker(printer);
          console.log(`Placeholder: Resuming Moonraker print ${printer.id}`);
          success = true; // Placeholder
        } else if (action === 'cancel') {
          // success = await cancelMoonraker(printer);
          console.log(`Placeholder: Cancelling Moonraker print ${printer.id}`);
          success = true; // Placeholder
        }
        break;
      case 'prusalink':
         if (action === 'pause') {
          success = await pausePrusaLinkPrint(printer, jobId!);
          if (!success) message = `Failed to pause PrusaLink printer ${printer.name}. Check printer status or logs.`;
        } else if (action === 'resume') {
          success = await resumePrusaLinkPrint(printer, jobId!);
          if (!success) message = `Failed to resume PrusaLink print ${printer.name}. Check printer status or logs.`;
        } else if (action === 'cancel') {
          success = await cancelPrusaLinkPrint(printer, jobId!);
          if (!success) message = `Failed to cancel PrusaLink print ${printer.name}. Check printer status or logs.`;
        }
        break;
      case 'bambulab':
        if (action === 'pause') {
          // success = await pauseBambuLab(printer);
          console.log(`Placeholder: Pausing Bambu Lab printer ${printer.id}`);
          success = true; // Placeholder
        } else if (action === 'resume') {
          // success = await resumeBambuLab(printer);
          console.log(`Placeholder: Resuming Bambu Lab print ${printer.id}`);
          success = true; // Placeholder
        } else if (action === 'cancel') {
          // success = await cancelBambuLab(printer);
           console.log(`Placeholder: Cancelling Bambu Lab print ${printer.id}`);
          success = true; // Placeholder
        }
        break;
      default:
        return NextResponse.json({ message: `Unsupported printer type: ${printer.type}` }, { status: 400 });
    }
    // --- End Printer-Specific Functions ---

    if (success) {
      // Optionally: Could trigger a status update fetch here or rely on frontend polling
      return NextResponse.json({ message });
    } else {
      // If the specific functions returned false or threw an error handled within them
      return NextResponse.json({ message: `Failed to perform action '${action}' on ${printer.name}` }, { status: 500 });
    }

  } catch (error) {
    console.error(`Error performing action ${action} on printer ${printerId}:`, error);
    return NextResponse.json({ message: `Failed to perform action '${action}': ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 