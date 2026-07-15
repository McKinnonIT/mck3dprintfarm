export interface CameraStreamSource {
  cameraPathName?: string | null;
}

/**
 * mediamtx serves a working HTML page with a bundled HLS player directly on
 * its HLS (:8888) endpoint, so it can be embedded as-is in an iframe. This
 * always points at the camera-proxy sidecar using the printer's
 * cameraPathName - never at the origin mediamtx server on the camera VLAN,
 * which browsers must never reach directly.
 *
 * HLS only: WebRTC's raw UDP ICE media can't be tunneled through a plain
 * HTTP reverse proxy (Pangolin in production), so it can never actually
 * work in a deployment where firewalls only allow traffic in through one.
 *
 * The sidecar shares the app's own host, so the host is read from
 * window.location rather than a NEXT_PUBLIC_* env var - those only get
 * inlined into the client bundle at `next build` time, which is before the
 * runtime docker-compose environment (where the real hostname is set)
 * even exists.
 *
 * Two deployment shapes are supported, distinguished by whether the app's
 * own URL has an explicit port:
 *
 * - No port (e.g. https://host/...): the app itself is reached through a
 *   reverse proxy (Pangolin in production), which firewalls block direct
 *   access around. The sidecar is reached the same way, proxied at
 *   /cameras/* to camera-proxy:8888 - hence cameraPathName itself being
 *   prefixed with "cameras/" (see deriveCameraPathName).
 * - Explicit port (e.g. http://host:3000, local/dev): the sidecar's HLS
 *   port is reachable directly, self-signed TLS and all (see
 *   docker/camera-proxy/generate-cert.sh) - each browser needs to accept
 *   that cert once by visiting the sidecar's URL directly first.
 */
export function getActiveCameraStreamUrl(source: CameraStreamSource): string | null {
  if (!source.cameraPathName) return null;
  if (typeof window === "undefined") return null;

  // mediamtx's bundled player page reads these from its own query string
  // (see loadAttributesFromQuery in its HTML) - no player chrome for an
  // embedded live view, just the video.
  const playerParams = "?controls=false";

  if (window.location.port === "") {
    return `${window.location.protocol}//${window.location.host}/${source.cameraPathName}/${playerParams}`;
  }

  return `https://${window.location.hostname}:8888/${source.cameraPathName}/${playerParams}`;
}
