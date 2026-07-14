/**
 * mediamtx re-serves each RTSP source as an HLS page on a fixed offset port
 * (default 8888), same host and path as the RTSP source. Hitting that HLS
 * URL directly in a browser returns mediamtx's own HTML page with a bundled
 * player, so no client-side video library is needed.
 */
export function getMediamtxHlsPageUrl(
  rtspUrl: string | null | undefined,
  hlsPort = 8888
): string | null {
  if (!rtspUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(rtspUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "rtsp:") return null;

  return `http://${parsed.hostname}:${hlsPort}${parsed.pathname}/`;
}
