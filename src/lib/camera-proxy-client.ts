const CAMERA_PROXY_API_TIMEOUT_MS = 10_000;

function apiUrl(path: string): string {
  const baseUrl = process.env.CAMERA_PROXY_API_URL;
  if (!baseUrl) {
    throw new Error("CAMERA_PROXY_API_URL is not configured");
  }
  return `${baseUrl}${path}`;
}

/**
 * Stable, URL-safe path name for a printer's camera-proxy path. Prefixed
 * with "cameras/" to match the reverse-proxy path (e.g. Pangolin routing
 * https://host/cameras/* to this sidecar) - the prefix isn't stripped by
 * the proxy, so mediamtx sees it as part of the literal path name and a
 * registered path must include it to match.
 */
export function deriveCameraPathName(printerId: string): string {
  return `cameras/printer-${printerId}`;
}

/** Basic shape check for a staff-entered camera origin URL before it's persisted. */
export function isValidOriginUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * mediamtx serves RTSP on :8554 alongside its HLS/WebRTC ports by default,
 * same host and path - so the origin's RTSP pull source can be derived
 * from whichever http(s) URL (hlsUrl/webrtcUrl) staff entered, without
 * needing a separate field in the add/edit printer form.
 */
export function deriveOriginRtspUrl(originUrl: string): string | null {
  try {
    const parsed = new URL(originUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `rtsp://${parsed.hostname}:8554${parsed.pathname}`;
  } catch {
    return null;
  }
}

/**
 * Builds the sidecar's own local HLS playlist URL for a path, used
 * server-side by the ffmpeg snapshot grabber - never sent to the browser.
 * Same container, so only the port differs from the control API's :9997.
 * https because hlsEncryption makes the sidecar's HLS port TLS-only (see
 * docker/camera-proxy/mediamtx.yml) - ffmpeg is told to skip cert
 * verification since it's a self-signed cert (see camera-snapshot/route.ts).
 */
export function internalHlsPlaylistUrl(pathName: string): string | null {
  const apiUrl = process.env.CAMERA_PROXY_API_URL;
  if (!apiUrl) return null;
  const { hostname } = new URL(apiUrl);
  return `https://${hostname}:8888/${pathName}/index.m3u8`;
}

async function callCameraProxyApi(path: string, init: RequestInit): Promise<Response | null> {
  if (!process.env.CAMERA_PROXY_API_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAMERA_PROXY_API_TIMEOUT_MS);
  try {
    return await fetch(apiUrl(path), { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Registers (or updates) a path on the camera-proxy sidecar so it pulls the
 * given origin camera feed over RTSP and republishes it as HLS/WebRTC.
 * Logs and swallows failures rather than throwing - a sidecar hiccup
 * shouldn't block saving a printer, and no-ops quietly when
 * CAMERA_PROXY_API_URL isn't configured (e.g. local dev without the sidecar).
 */
export async function upsertCameraPath(pathName: string, originRtspUrl: string): Promise<void> {
  try {
    const res = await callCameraProxyApi(`/v3/config/paths/replace/${encodeURIComponent(pathName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: originRtspUrl, sourceOnDemand: true }),
    });
    if (res && !res.ok) {
      console.error(`camera-proxy: failed to register path "${pathName}": ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error(`camera-proxy: error registering path "${pathName}"`, error);
  }
}

/** Removes a path from the camera-proxy sidecar. Safe to call even if it never existed. */
export async function removeCameraPath(pathName: string): Promise<void> {
  try {
    const res = await callCameraProxyApi(`/v3/config/paths/delete/${encodeURIComponent(pathName)}`, {
      method: "DELETE",
    });
    if (res && !res.ok && res.status !== 404) {
      console.error(`camera-proxy: failed to remove path "${pathName}": ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error(`camera-proxy: error removing path "${pathName}"`, error);
  }
}
