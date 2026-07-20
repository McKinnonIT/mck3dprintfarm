import { prisma } from "@/lib/prisma";
import {
  deriveCameraPathName,
  deriveOriginRtspUrl,
  removeCameraPath,
  upsertCameraPath,
} from "@/lib/camera-proxy-client";
import { fetchOnvifStreamUri } from "@/lib/onvif-client";

interface PrinterCameraFields {
  id: string;
  hlsUrl: string | null;
  webrtcUrl: string | null;
  cameraPathName: string | null;
  onvifHost: string | null;
  onvifPort: number | null;
  onvifUsername: string | null;
  onvifPassword: string | null;
}

/**
 * Resolves the origin RTSP URL to pull a printer's camera from - either an
 * ONVIF camera (queried live via GetStreamUri) or an existing mediamtx
 * bridge (guessed from hlsUrl/webrtcUrl). ONVIF takes precedence if both
 * happen to be set. Returns null (after logging) if the printer has no
 * camera source configured, or the configured one is unusable right now -
 * callers should treat that as "leave things as they are", not fatal.
 */
async function resolveOriginRtspUrl(printer: PrinterCameraFields): Promise<string | null> {
  if (printer.onvifHost) {
    try {
      const { uri } = await fetchOnvifStreamUri({
        host: printer.onvifHost,
        port: printer.onvifPort,
        username: printer.onvifUsername || "",
        password: printer.onvifPassword || "",
      });
      return uri;
    } catch (error) {
      console.error(`camera-proxy: printer ${printer.id} ONVIF camera unreachable:`, error);
      return null;
    }
  }

  const originUrl = printer.hlsUrl || printer.webrtcUrl;
  if (!originUrl) return null;

  const rtspUrl = deriveOriginRtspUrl(originUrl);
  if (!rtspUrl) {
    console.error(`camera-proxy: printer ${printer.id} has an unusable camera URL "${originUrl}"`);
  }
  return rtspUrl;
}

/**
 * Keeps the camera-proxy sidecar in sync with a printer's camera fields.
 * Call after any create/update that touches hlsUrl/webrtcUrl/onvif*.
 * Assigns a cameraPathName the first time a camera source is set, and
 * tears the sidecar path down again once the source is cleared entirely.
 */
export async function syncCameraProxyPath(printer: PrinterCameraFields): Promise<void> {
  const hasCameraSource = !!(printer.onvifHost || printer.hlsUrl || printer.webrtcUrl);

  if (!hasCameraSource) {
    if (printer.cameraPathName) {
      await removeCameraPath(printer.cameraPathName);
      await prisma.printer.update({
        where: { id: printer.id },
        data: { cameraPathName: null },
      });
    }
    return;
  }

  const rtspUrl = await resolveOriginRtspUrl(printer);
  if (!rtspUrl) return;

  // Always recompute rather than reusing a stored name - deriveCameraPathName
  // is a pure function of printer.id, so this is cheap and self-heals any
  // printer still holding an older naming scheme's path name.
  const pathName = deriveCameraPathName(printer.id);
  await upsertCameraPath(pathName, rtspUrl);
  if (pathName !== printer.cameraPathName) {
    await prisma.printer.update({
      where: { id: printer.id },
      data: { cameraPathName: pathName },
    });
  }
}
