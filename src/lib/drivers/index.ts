import { MoonrakerDriver } from "./moonraker";
import { PrusaLinkDriver } from "./prusalink";
import { PrinterDriver } from "./types";

export * from "./types";
export { PrusaLinkDriver, MoonrakerDriver };

interface DriverPrinter {
  type: string;
  apiUrl: string;
  apiKey?: string | null;
}

/**
 * Returns the native driver for a printer type, or throws if none exists
 * yet (Bambu Lab still goes through the legacy bambulabs-bridge.js).
 */
export function getPrinterDriver(printer: DriverPrinter): PrinterDriver {
  const type = printer.type.toLowerCase();

  if (type.includes("prusa")) {
    if (!printer.apiKey) {
      throw new Error("API key is required for PrusaLink printers");
    }
    return new PrusaLinkDriver(printer.apiUrl, printer.apiKey);
  }

  if (type === "moonraker") {
    return new MoonrakerDriver(printer.apiUrl, printer.apiKey);
  }

  throw new Error(`No native driver available for printer type "${printer.type}"`);
}
