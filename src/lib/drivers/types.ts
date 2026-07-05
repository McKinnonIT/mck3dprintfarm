export type NormalizedPrinterState =
  | "idle"
  | "printing"
  | "paused"
  | "busy"
  | "error"
  | "offline";

export interface PrinterStatus {
  state: NormalizedPrinterState;
  bedTemp?: number;
  bedTargetTemp?: number;
  toolTemp?: number;
  toolTargetTemp?: number;
  /** 0-1 */
  progress?: number;
  printTimeElapsed?: number;
  printTimeRemaining?: number;
  fileName?: string;
}

export interface UploadResult {
  remotePath: string;
}

export interface ConnectionInfo {
  message: string;
  details?: unknown;
}

export class PrinterDriverError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PrinterDriverError";
  }
}

/**
 * A vendor-specific implementation of the printer control surface every
 * caller in this app actually needs. Every method throws PrinterDriverError
 * on failure instead of returning an ad hoc {success, message} shape, so
 * callers use one error-handling convention regardless of vendor.
 */
export interface PrinterDriver {
  testConnection(): Promise<ConnectionInfo>;
  getStatus(): Promise<PrinterStatus>;
  uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    opts?: { printAfterUpload?: boolean }
  ): Promise<UploadResult>;
  startPrint(fileName: string): Promise<void>;
  pausePrint(): Promise<void>;
  resumePrint(): Promise<void>;
  stopPrint(): Promise<void>;
  /** Not every vendor exposes raw G-code injection. */
  sendGcode?(script: string): Promise<void>;
}
