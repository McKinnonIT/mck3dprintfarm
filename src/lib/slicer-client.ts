export interface SliceProfileInput {
  machineJson: string;
  processJson: string;
  filamentJson: string;
}

export interface SliceRequest {
  sourceFilePath: string;
  outputRelativePath: string;
  profile: SliceProfileInput;
  /** Applied on top of the process profile for a one-off "Custom Settings" slice. */
  overrides?: Record<string, unknown>;
  /** Set when sourceFilePath is a caller-built multi-object .3mf whose per-item
   * transforms must be respected as-is (disables OrcaSlicer's own auto-arrange). */
  preArranged?: boolean;
}

export interface SliceResult {
  success: boolean;
  error?: string;
  log?: string;
}

export interface ResolveSettingsRequest {
  /** Omit when there's no specific uploaded file in context (e.g. previewing
   * a Slicing Profile edit) - the sidecar falls back to a bundled dummy model. */
  sourceFilePath?: string;
  profile: SliceProfileInput;
}

export interface ResolveSettingsResult {
  success: boolean;
  settings?: Record<string, unknown>;
  error?: string;
  log?: string;
}

const SIDECAR_TIMEOUT_MS = 5 * 60 * 1000; // slicing/settings resolution can take a while

function sidecarUrl(path: string): string {
  const baseUrl = process.env.ORCASLICER_URL;
  if (!baseUrl) {
    throw new Error("ORCASLICER_URL is not configured");
  }
  return `${baseUrl}${path}`;
}

/**
 * Calls the orcaslicer sidecar over HTTP. Both services share the same
 * uploads volume, so paths are relative to that shared root, not raw
 * file bytes - the sidecar reads/writes the file itself.
 */
export async function sliceFile(request: SliceRequest): Promise<SliceResult> {
  const res = await fetch(sidecarUrl("/slice"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceFilePath: request.sourceFilePath,
      outputRelativePath: request.outputRelativePath,
      machineJson: request.profile.machineJson,
      processJson: request.profile.processJson,
      filamentJson: request.profile.filamentJson,
      overrides: request.overrides,
      preArranged: request.preArranged,
    }),
    signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Slicer sidecar returned ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/** Returns the fully-resolved effective settings for a machine/process/filament combo. */
export async function resolveSettings(request: ResolveSettingsRequest): Promise<ResolveSettingsResult> {
  const res = await fetch(sidecarUrl("/resolve-settings"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceFilePath: request.sourceFilePath,
      machineJson: request.profile.machineJson,
      processJson: request.profile.processJson,
      filamentJson: request.profile.filamentJson,
    }),
    signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Slicer sidecar returned ${res.status} ${res.statusText}`);
  }

  return res.json();
}
