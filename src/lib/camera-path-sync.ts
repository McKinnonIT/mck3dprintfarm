import { prisma } from "@/lib/prisma";
import {
  deriveCameraPathName,
  deriveOriginRtspUrl,
  removeCameraPath,
  upsertCameraPath,
} from "@/lib/camera-proxy-client";

interface PrinterCameraFields {
  id: string;
  hlsUrl: string | null;
  webrtcUrl: string | null;
  cameraPathName: string | null;
}

/**
 * Keeps the camera-proxy sidecar in sync with a printer's camera fields.
 * Call after any create/update that touches hlsUrl/webrtcUrl. Assigns a
 * cameraPathName the first time a camera URL is set, and tears the
 * sidecar path down again once both URLs are cleared.
 */
export async function syncCameraProxyPath(printer: PrinterCameraFields): Promise<void> {
  const originUrl = printer.hlsUrl || printer.webrtcUrl;

  if (!originUrl) {
    if (printer.cameraPathName) {
      await removeCameraPath(printer.cameraPathName);
      await prisma.printer.update({
        where: { id: printer.id },
        data: { cameraPathName: null },
      });
    }
    return;
  }

  const rtspUrl = deriveOriginRtspUrl(originUrl);
  if (!rtspUrl) {
    console.error(`camera-proxy: printer ${printer.id} has an unusable camera URL "${originUrl}"`);
    return;
  }

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
