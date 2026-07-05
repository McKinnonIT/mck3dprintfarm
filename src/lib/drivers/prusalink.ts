import { fetchWithTimeout, numberOrUndefined } from "./http";
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
  operational: "idle",
  ready: "idle",
  idle: "idle",
  finished: "idle",
  paused: "paused",
  pausing: "paused",
  cancelling: "idle",
  attention: "error",
  error: "error",
  offline: "offline",
  busy: "busy",
};

function mapState(raw: string): NormalizedPrinterState {
  return STATE_MAP[raw.toLowerCase()] ?? "idle";
}

/**
 * Talks to PrusaLink's HTTP API directly (X-Api-Key header). No subprocess,
 * no Python dependency - this is the only PrusaLink integration in the app.
 */
export class PrusaLinkDriver implements PrinterDriver {
  constructor(private apiUrl: string, private apiKey: string) {}

  private get headers(): Record<string, string> {
    return { "X-Api-Key": this.apiKey, Accept: "application/json" };
  }

  private url(path: string): string {
    return `${this.apiUrl.replace(/\/$/, "")}${path}`;
  }

  async testConnection(): Promise<ConnectionInfo> {
    const res = await fetchWithTimeout(this.url("/api/version"), { headers: this.headers }, 8000);
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink returned ${res.status} ${res.statusText} for /api/version`);
    }
    return { message: "Connected to PrusaLink", details: await res.json() };
  }

  async getStatus(): Promise<PrinterStatus> {
    const res = await fetchWithTimeout(this.url("/api/printer"), { headers: this.headers }, 8000);
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink returned ${res.status} ${res.statusText} for /api/printer`);
    }
    const data = await res.json();

    // PrusaLink firmware has shipped more than one /api/printer response
    // shape over the years; read whichever fields are actually present.
    const rawState: string | undefined = data.printer?.state?.text ?? data.state?.text;
    const bedTemp = data.printer?.temp_bed ?? data.temperature?.bed?.actual ?? data.telemetry?.["temp-bed"];
    const bedTargetTemp = data.printer?.target_bed ?? data.temperature?.bed?.target;
    const toolTemp = data.printer?.temp_nozzle ?? data.temperature?.tool0?.actual ?? data.telemetry?.["temp-nozzle"];
    const toolTargetTemp = data.printer?.target_nozzle ?? data.temperature?.tool0?.target;

    const status: PrinterStatus = {
      state: rawState ? mapState(rawState) : "idle",
      bedTemp: numberOrUndefined(bedTemp),
      bedTargetTemp: numberOrUndefined(bedTargetTemp),
      toolTemp: numberOrUndefined(toolTemp),
      toolTargetTemp: numberOrUndefined(toolTargetTemp),
    };

    if (status.state === "printing" || status.state === "paused") {
      const job = await this.tryGetJob();
      if (job) {
        const completion = job.progress?.completion;
        status.progress = typeof completion === "number" ? completion / 100 : undefined;
        status.printTimeElapsed = numberOrUndefined(job.progress?.printTime);
        status.printTimeRemaining = numberOrUndefined(job.progress?.printTimeLeft);
        status.fileName = job.job?.file?.name;
      }
    }

    return status;
  }

  private async tryGetJob(): Promise<any | undefined> {
    try {
      const res = await fetchWithTimeout(this.url("/api/job"), { headers: this.headers }, 8000);
      return res.ok ? await res.json() : undefined;
    } catch {
      return undefined;
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    opts: { printAfterUpload?: boolean } = {}
  ): Promise<UploadResult> {
    const res = await fetchWithTimeout(
      this.url(`/api/files/local/${encodeURIComponent(fileName)}`),
      {
        method: "PUT",
        headers: {
          ...this.headers,
          "Content-Type": "application/octet-stream",
          "Print-After-Upload": opts.printAfterUpload ? "?1" : "?0",
          Overwrite: "?1",
        },
        body: fileBuffer,
      },
      30000
    );
    if (!res.ok && res.status !== 201) {
      const text = await res.text().catch(() => "");
      throw new PrinterDriverError(`PrusaLink upload failed: ${res.status} ${res.statusText} ${text}`);
    }
    return { remotePath: `local/${fileName}` };
  }

  async startPrint(fileName: string): Promise<void> {
    const res = await fetchWithTimeout(
      this.url(`/api/files/local/${encodeURIComponent(fileName)}`),
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ command: "select", print: true }),
      },
      10000
    );
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink failed to start print: ${res.status} ${res.statusText}`);
    }
  }

  pausePrint(): Promise<void> {
    return this.jobCommand("pause", "pause");
  }

  resumePrint(): Promise<void> {
    return this.jobCommand("pause", "resume");
  }

  stopPrint(): Promise<void> {
    return this.jobCommand("cancel");
  }

  private async jobCommand(command: string, action?: string): Promise<void> {
    const res = await fetchWithTimeout(
      this.url("/api/job"),
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(action ? { command, action } : { command }),
      },
      10000
    );
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink job command "${command}" failed: ${res.status} ${res.statusText}`);
    }
  }
}
