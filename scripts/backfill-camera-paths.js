// Idempotent resync: registers a camera-proxy sidecar path for every printer
// that has an hlsUrl/webrtcUrl, reusing its existing cameraPathName if it
// has one. Runs on every app startup (see Dockerfile) rather than truly
// once, because mediamtx's dynamic paths are in-memory only - a
// camera-proxy container restart wipes them all, and this is what
// re-populates them without staff having to re-save every printer.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Prefixed with "cameras/" to match the reverse-proxy path (e.g. Pangolin
// routing https://host/cameras/* to this sidecar) - the prefix isn't
// stripped by the proxy, so a registered path must include it to match.
function deriveCameraPathName(printerId) {
  return `cameras/printer-${printerId}`;
}

// mediamtx serves RTSP on :8554 alongside its HLS/WebRTC ports by default,
// same host and path - so the origin's RTSP pull source can be derived from
// whichever http(s) URL (hlsUrl/webrtcUrl) staff entered.
function deriveOriginRtspUrl(originUrl) {
  try {
    const parsed = new URL(originUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `rtsp://${parsed.hostname}:8554${parsed.pathname}`;
  } catch {
    return null;
  }
}

async function upsertCameraPath(pathName, originRtspUrl) {
  const baseUrl = process.env.CAMERA_PROXY_API_URL;
  if (!baseUrl) {
    console.log('CAMERA_PROXY_API_URL not set, skipping camera-proxy backfill.');
    return false;
  }
  try {
    const res = await fetch(`${baseUrl}/v3/config/paths/replace/${encodeURIComponent(pathName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: originRtspUrl, sourceOnDemand: true }),
    });
    if (!res.ok) {
      console.error(`Failed to register path "${pathName}": ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error registering path "${pathName}":`, error);
    return false;
  }
}

async function backfillCameraPaths() {
  try {
    const printers = await prisma.printer.findMany({
      where: {
        OR: [{ hlsUrl: { not: null } }, { webrtcUrl: { not: null } }],
      },
      select: { id: true, name: true, hlsUrl: true, webrtcUrl: true, cameraPathName: true },
    });

    console.log(`Found ${printers.length} printer(s) with a camera URL to sync with camera-proxy.`);

    for (const printer of printers) {
      const originUrl = printer.hlsUrl || printer.webrtcUrl;
      const rtspUrl = deriveOriginRtspUrl(originUrl);
      if (!rtspUrl) {
        console.error(`Skipping printer "${printer.name}" (${printer.id}): unusable camera URL "${originUrl}"`);
        continue;
      }

      // Always recompute rather than reusing a stored name - it's a pure
      // function of printer.id, so this self-heals any printer still
      // holding an older naming scheme's path name.
      const pathName = deriveCameraPathName(printer.id);
      const ok = await upsertCameraPath(pathName, rtspUrl);
      if (ok) {
        if (pathName !== printer.cameraPathName) {
          await prisma.printer.update({ where: { id: printer.id }, data: { cameraPathName: pathName } });
        }
        console.log(`Registered camera-proxy path "${pathName}" for printer "${printer.name}".`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

backfillCameraPaths()
  .then(() => {
    console.log('Camera path backfill complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Camera path backfill failed:', error);
    process.exit(1);
  });
