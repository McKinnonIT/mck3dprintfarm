/**
 * Fields safe to return from endpoints the public dashboard can reach
 * without authentication. Deliberately excludes apiKey and serialNumber -
 * everything else here is just display/status data.
 *
 * webcamUrl/hlsUrl/webrtcUrl are NOT included: they're internal addresses
 * on the printer/camera VLAN. cameraPathName is an opaque routable name on
 * the camera-proxy sidecar (see src/lib/camera-utils.ts), so the browser
 * gets a working live-view URL without ever learning the origin address.
 * webcamUrl is still fetched here (see toPublicPrinter below) purely to
 * derive a boolean - /api/webcam-proxy resolves the real URL server-side.
 */
export const PUBLIC_PRINTER_SELECT = {
  id: true,
  name: true,
  type: true,
  status: true,
  operationalStatus: true,
  lastSeen: true,
  webcamUrl: true,
  cameraPathName: true,
  cameraStreamMode: true,
  printImageUrl: true,
  printJobName: true,
  currentJobFilename: true,
  bedTemp: true,
  toolTemp: true,
  printStartTime: true,
  printTimeElapsed: true,
  printTimeRemaining: true,
  groupId: true,
  machineProfileId: true,
} as const;

type SelectedPrinter = { webcamUrl: string | null };

/**
 * Strips the raw webcamUrl from a PUBLIC_PRINTER_SELECT result before it's
 * sent to an unauthenticated client, replacing it with a boolean - callers
 * only need to know a webcam exists, not where it lives.
 */
export function toPublicPrinter<T extends SelectedPrinter>(
  printer: T
): Omit<T, "webcamUrl"> & { hasWebcam: boolean } {
  const { webcamUrl, ...rest } = printer;
  return { ...rest, hasWebcam: !!webcamUrl };
}
