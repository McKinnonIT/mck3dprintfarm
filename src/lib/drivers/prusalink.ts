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
        status.progress = typeof job.progress === "number" ? job.progress / 100 : undefined;
        status.printTimeElapsed = numberOrUndefined(job.time_printing);
        status.printTimeRemaining = numberOrUndefined(job.time_remaining);
        status.fileName = job.file?.display_name ?? job.file?.name;
      }
    }

    return status;
  }

  // The legacy /api/files/local/* and /api/job write endpoints return 403 on
  // this fleet's firmware (confirmed empirically) - it only has USB storage
  // mounted, no internal "local" storage, and only accepts writes through
  // the newer /api/v1 API. Reads (/api/version, /api/printer) still work
  // fine on the legacy API, so those are left alone.
  private async tryGetJob(): Promise<any | undefined> {
    try {
      const res = await fetchWithTimeout(this.url("/api/v1/job"), { headers: this.headers }, 8000);
      if (res.status === 204) return undefined;
      return res.ok ? await res.json() : undefined;
    } catch {
      return undefined;
    }
  }

  /** Storage location name (e.g. "usb" or "local") - varies by printer, so ask rather than assume. */
  private async resolveStorage(): Promise<string> {
    const res = await fetchWithTimeout(this.url("/api/v1/storage"), { headers: this.headers }, 8000);
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink returned ${res.status} ${res.statusText} for /api/v1/storage`);
    }
    const data = await res.json();
    const list: Array<{ name: string; available?: boolean }> = data.storage_list ?? [];
    const storage = list.find((s) => s.available) ?? list[0];
    if (!storage) {
      throw new PrinterDriverError("PrusaLink reports no storage available to upload to");
    }
    return storage.name;
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    opts: { printAfterUpload?: boolean } = {}
  ): Promise<UploadResult> {
    const storage = await this.resolveStorage();
    const res = await fetchWithTimeout(
      this.url(`/api/v1/files/${storage}/${encodeURIComponent(fileName)}`),
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
    return { remotePath: `${storage}/${fileName}` };
  }

  async startPrint(fileName: string): Promise<void> {
    const storage = await this.resolveStorage();
    const res = await fetchWithTimeout(
      this.url(`/api/v1/files/${storage}/${encodeURIComponent(fileName)}`),
      { method: "POST", headers: this.headers },
      10000
    );
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink failed to start print: ${res.status} ${res.statusText}`);
    }
  }

  pausePrint(): Promise<void> {
    return this.jobAction("pause");
  }

  resumePrint(): Promise<void> {
    return this.jobAction("resume");
  }

  async stopPrint(): Promise<void> {
    const id = await this.getJobId();
    const res = await fetchWithTimeout(this.url(`/api/v1/job/${id}`), { method: "DELETE", headers: this.headers }, 10000);
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink failed to cancel job: ${res.status} ${res.statusText}`);
    }
  }

  private async getJobId(): Promise<number> {
    const job = await this.tryGetJob();
    if (!job) {
      throw new PrinterDriverError("PrusaLink has no active job");
    }
    return job.id;
  }

  private async jobAction(action: "pause" | "resume"): Promise<void> {
    const id = await this.getJobId();
    const res = await fetchWithTimeout(this.url(`/api/v1/job/${id}/${action}`), { method: "PUT", headers: this.headers }, 10000);
    if (!res.ok) {
      throw new PrinterDriverError(`PrusaLink failed to ${action} job: ${res.status} ${res.statusText}`);
    }
  }
}
