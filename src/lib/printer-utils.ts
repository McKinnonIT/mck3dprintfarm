import fetch from 'node-fetch';

type Printer = {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  serialNumber?: string;
  status: string;
  operationalStatus: string;
};

/**
 * Creates authentication headers for printer API requests.
 *
 * PrusaLink and Moonraker have their own native drivers (src/lib/drivers)
 * and no longer go through this generic path - this is only reached for
 * printer types without a dedicated driver yet (e.g. Bambu Lab's HTTP
 * fallback, or a future vendor).
 */
export function createPrinterAuthHeaders(printer: Printer): Record<string, string> {
  if (!printer.apiKey) {
    return {};
  }
  return {
    'X-Api-Key': printer.apiKey
  };
}

/**
 * Uploads a file to a printer that has no dedicated driver.
 */
export async function uploadFileToPrinter(
  printer: Printer,
  filePath: string,
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return {
    success: false,
    message: `Upload not implemented for printer type: ${printer.type}`
  };
}

/**
 * Starts printing a file that has been uploaded to a printer with no
 * dedicated driver.
 */
export async function startPrintJob(
  printer: Printer,
  uploadResponse: any,
  fileName: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return {
    success: false,
    message: `Print not implemented for printer type: ${printer.type}`
  };
}

/**
 * Tests connectivity to a printer with no dedicated driver, via a generic
 * GET /api/version.
 */
export async function testPrinterConnection(
  printer: Printer
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const headers = createPrinterAuthHeaders(printer);
    const apiUrl = `${printer.apiUrl}/api/version`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to connect to printer: ${response.status} ${errorText}`);
    }

    let data;
    try {
      const text = await response.text();
      data = text && text.trim() ? JSON.parse(text) : {};
    } catch (error) {
      data = { status: 'connected' };
    }

    return {
      success: true,
      message: 'Successfully connected to printer',
      data
    };
  } catch (error) {
    console.error('Error connecting to printer:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}