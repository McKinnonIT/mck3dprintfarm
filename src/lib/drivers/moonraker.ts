import { fetchWithTimeout } from "./http";
import {
  ConnectionInfo,
  NormalizedPrinterState,
  PrinterDriver,
  PrinterDriverError,
  PrinterStatus,
  UploadResult,
} from "./types";

const STATE_MAP: Record<string, NormalizedPrinterState> = {
  printing: "printing",
  paused: "paused",
  pausing: "paused",
  complete: "idle",
  standby: "idle",
  ready: "idle",
  cancelled: "idle",
  error: "error",
};

function mapState(raw: string): NormalizedPrinterState {
  return STATE_MAP[raw.toLowerCase()] ?? "idle";
}

/**
 * Talks to Moonraker's REST API directly. No subprocess, no Python
 * dependency - this is the only Moonraker integration in the app.
 */
export class MoonrakerDriver implements PrinterDriver {
  constructor(private apiUrl: string, private apiKey?: string | null) {}

  private get headers(): Record<string, string> {
    return this.apiKey
      ? { "X-Api-Key": this.apiKey, Accept: "application/json" }
      : { Accept: "application/json" };
  }

  private url(path: string): string {
    return `${this.apiUrl.replace(/\/$/, "")}${path}`;
  }

  async testConnection(): Promise<ConnectionInfo> {
    const res = await fetchWithTimeout(this.url("/printer/info"), { headers: this.headers }, 8000);
    if (!res.ok) {
      throw new PrinterDriverError(`Moonraker returned ${res.status} ${res.statusText} for /printer/info`);
    }
    const data = await res.json();
    return { message: "Connected to Moonraker", details: data.result };
  }

  async getStatus(): Promise<PrinterStatus> {
    const query = "print_stats&extruder&heater_bed&display_status";
    const res = await fetchWithTimeout(
      this.url(`/printer/objects/query?${query}`),
      { headers: this.headers },
      8000
    );
    if (!res.ok) {
      throw new PrinterDriverError(
        `Moonraker returned ${res.status} ${res.statusText} for /printer/objects/query`
      );
    }
    const data = await res.json();
    const objects = data.result?.status ?? {};
    const printStats = objects.print_stats ?? {};
    const displayStatus = objects.display_status ?? {};

    const progress: number | undefined =
      typeof displayStatus.progress === "number" ? displayStatus.progress : undefined;
    const elapsed: number | undefined =
      typeof printStats.print_duration === "number" ? printStats.print_duration : undefined;
    const remaining =
      progress !== undefined && progress > 0 && elapsed !== undefined
        ? elapsed / progress - elapsed
        : undefined;

    return {
      state: mapState(printStats.state ?? "standby"),
      bedTemp: objects.heater_bed?.temperature,
      bedTargetTemp: objects.heater_bed?.target,
      toolTemp: objects.extruder?.temperature,
      toolTargetTemp: objects.extruder?.target,
      progress,
      printTimeElapsed: elapsed,
      printTimeRemaining: remaining,
      fileName: printStats.filename || undefined,
    };
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    opts: { printAfterUpload?: boolean } = {}
  ): Promise<UploadResult> {
    const form = new FormData();
    form.append("root", "gcodes");
    form.append("file", new Blob([fileBuffer]), fileName);
    if (opts.printAfterUpload) {
      form.append("print", "true");
    }

    const res = await fetchWithTimeout(
      this.url("/server/files/upload"),
      { method: "POST", headers: this.apiKey ? { "X-Api-Key": this.apiKey } : undefined, body: form },
      30000
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PrinterDriverError(`Moonraker upload failed: ${res.status} ${res.statusText} ${text}`);
    }
    return { remotePath: `gcodes/${fileName}` };
  }

  async startPrint(fileName: string): Promise<void> {
    const res = await fetchWithTimeout(
      this.url("/printer/print/start"),
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fileName }),
      },
      10000
    );
    if (!res.ok) {
      throw new PrinterDriverError(`Moonraker failed to start print: ${res.status} ${res.statusText}`);
    }
  }

  pausePrint(): Promise<void> {
    return this.post("/printer/print/pause");
  }

  resumePrint(): Promise<void> {
    return this.post("/printer/print/resume");
  }

  stopPrint(): Promise<void> {
    return this.post("/printer/print/cancel");
  }

  sendGcode(script: string): Promise<void> {
    return this.post(`/printer/gcode/script?script=${encodeURIComponent(script)}`);
  }

  private async post(path: string): Promise<void> {
    const res = await fetchWithTimeout(this.url(path), { method: "POST", headers: this.headers }, 10000);
    if (!res.ok) {
      throw new PrinterDriverError(`Moonraker request to ${path} failed: ${res.status} ${res.statusText}`);
    }
  }
}
