import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrinterDriver } from "@/lib/drivers";
import { PUBLIC_PRINTER_SELECT, toPublicPrinter } from "@/lib/public-printer-fields";

// Keep track of offline printers with a backoff mechanism so a dead printer
// doesn't eat a connection slot on every poll.
const offlinePrinters = new Map<string, { until: Date }>();
const OFFLINE_BACKOFF_TIME_MS = 30 * 1000; // 30 seconds

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    const resolve = this.waiting.shift();
    if (resolve) {
      resolve();
    } else {
      this.permits++;
    }
  }
}

const CONNECTION_SEMAPHORE = new Semaphore(5);
const DB_SEMAPHORE = new Semaphore(3);

function hasNativeDriver(type: string): boolean {
  return type.toLowerCase() === "moonraker" || type.toLowerCase().includes("prusa");
}

async function pollPrinter(printer: any, now: Date) {
  if (!hasNativeDriver(printer.type)) {
    // Bambu Lab and any other type without a native driver yet: leave status
    // untouched rather than guessing.
    return { id: printer.id, updateData: { lastSeen: now } };
  }

  const backoff = offlinePrinters.get(printer.id);
  if (backoff && backoff.until > now) {
    return { id: printer.id, updateData: { operationalStatus: "offline", lastSeen: now } };
  }

  await CONNECTION_SEMAPHORE.acquire();
  try {
    const driver = getPrinterDriver(printer);
    const status = await driver.getStatus();
    offlinePrinters.delete(printer.id);

    const updateData: Record<string, unknown> = {
      operationalStatus: status.state,
      lastSeen: now,
    };
    if (status.bedTemp !== undefined) updateData.bedTemp = status.bedTemp;
    if (status.toolTemp !== undefined) updateData.toolTemp = status.toolTemp;
    if (status.printTimeElapsed !== undefined) updateData.printTimeElapsed = status.printTimeElapsed;
    if (status.printTimeRemaining !== undefined) updateData.printTimeRemaining = status.printTimeRemaining;
    if (status.fileName !== undefined) updateData.currentJobFilename = status.fileName;
    if (status.state === "printing" && status.printTimeElapsed !== undefined) {
      updateData.printStartTime = new Date(now.getTime() - status.printTimeElapsed * 1000);
    }

    return { id: printer.id, updateData };
  } catch (error) {
    console.error(`Cannot connect to ${printer.type} printer ${printer.name}:`, error);
    offlinePrinters.set(printer.id, { until: new Date(now.getTime() + OFFLINE_BACKOFF_TIME_MS) });
    return {
      id: printer.id,
      updateData: { operationalStatus: "offline", lastSeen: now, bedTemp: null, toolTemp: null },
    };
  } finally {
    CONNECTION_SEMAPHORE.release();
  }
}

export async function GET() {
  try {
    const printers = await prisma.printer.findMany();
    const now = new Date();

    const updates = await Promise.all(
      printers.map((printer) =>
        pollPrinter(printer, now).catch((error) => {
          console.error(`Failed to poll printer ${printer.name}:`, error);
          return { id: printer.id, updateData: { operationalStatus: "offline", lastSeen: now } };
        })
      )
    );

    await Promise.all(
      updates.map(async (update) => {
        await DB_SEMAPHORE.acquire();
        try {
          await prisma.printer.update({ where: { id: update.id }, data: update.updateData });
        } catch (dbError) {
          console.error(`Database update error for printer ${update.id}:`, dbError);
        } finally {
          DB_SEMAPHORE.release();
        }
      })
    );

    const updatedPrinters = await prisma.printer.findMany({ select: PUBLIC_PRINTER_SELECT });
    return NextResponse.json(updatedPrinters.map(toPublicPrinter));
  } catch (error) {
    console.error("Failed to update printer statuses:", error);
    return NextResponse.json({ error: "Failed to update printer statuses" }, { status: 500 });
  }
}
