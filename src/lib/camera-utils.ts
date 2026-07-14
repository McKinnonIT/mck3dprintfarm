export type CameraStreamMode = "hls" | "webrtc";

export interface CameraStreamSource {
  hlsUrl?: string | null;
  webrtcUrl?: string | null;
  cameraStreamMode?: string | null;
}

/**
 * Both mediamtx's HLS and WebRTC endpoints serve a working HTML page with a
 * bundled player when hit directly in a browser, so either URL can be
 * embedded as-is in an iframe. Picks the printer's preferred mode, falling
 * back to whichever URL is actually set.
 */
export function getActiveCameraStreamUrl(source: CameraStreamSource): string | null {
  const preferWebrtc = source.cameraStreamMode === "webrtc";
  const preferred = preferWebrtc ? source.webrtcUrl : source.hlsUrl;
  const fallback = preferWebrtc ? source.hlsUrl : source.webrtcUrl;
  return preferred || fallback || null;
}
