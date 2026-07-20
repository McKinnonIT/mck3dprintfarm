// Idempotent resync: registers a camera-proxy sidecar path for every printer
// that has an hlsUrl/webrtcUrl or ONVIF camera configured, reusing its
// existing cameraPathName if it has one. Runs on every app startup (see
// Dockerfile) rather than truly once, because mediamtx's dynamic paths are
// in-memory only - a camera-proxy container restart wipes them all, and
// this is what re-populates them without staff having to re-save every
// printer.
const { PrismaClient } = require('@prisma/client');
const { Cam } = require('onvif');

const prisma = new PrismaClient();
const ONVIF_TIMEOUT_MS = 8000;

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

// Connects to an ONVIF camera and fetches its RTSP stream URI (Profile S,
// first/default media profile). Mirrors src/lib/onvif-client.ts - duplicated
// here since this script runs as plain CommonJS, not through the Next.js
// module graph. Credentials are injected into the returned URI since ONVIF
// typically omits them (Tapo cameras reuse the same "camera account" for
// both ONVIF and RTSP auth).
function fetchOnvifStreamUri({ host, port, username, password }) {
  const resolvedPort = port || 2020;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out connecting to ONVIF camera at ${host}:${resolvedPort}`));
    }, ONVIF_TIMEOUT_MS);

    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    const cam = new Cam({ hostname: host, port: resolvedPort, username, password, timeout: ONVIF_TIMEOUT_MS }, (err) => {
      if (err) {
        settle(() => reject(new Error(`Failed to connect to ONVIF camera at ${host}:${resolvedPort}: ${err.message}`)));
        return;
      }
      cam.getStreamUri({ protocol: 'RTSP' }, (streamErr, stream) => {
        if (streamErr || !stream || !stream.uri) {
          settle(() =>
            reject(new Error(`Failed to get RTSP stream URI from ${host}:${resolvedPort}: ${(streamErr && streamErr.message) || 'no URI returned'}`))
          );
          return;
        }
        let uri;
        try {
          const parsed = new URL(stream.uri);
          parsed.username = encodeURIComponent(username);
          parsed.password = encodeURIComponent(password);
          uri = parsed.toString();
        } catch {
          settle(() => reject(new Error(`ONVIF camera returned an unusable stream URI: ${stream.uri}`)));
          return;
        }
        settle(() => resolve(uri));
      });
    });
  });
}

async function resolveOriginRtspUrl(printer) {
  if (printer.onvifHost) {
    return fetchOnvifStreamUri({
      host: printer.onvifHost,
      port: printer.onvifPort,
      username: printer.onvifUsername || '',
      password: printer.onvifPassword || '',
    });
  }

  const originUrl = printer.hlsUrl || printer.webrtcUrl;
  const rtspUrl = deriveOriginRtspUrl(originUrl);
  if (!rtspUrl) {
    throw new Error(`unusable camera URL "${originUrl}"`);
  }
  return rtspUrl;
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
        OR: [{ hlsUrl: { not: null } }, { webrtcUrl: { not: null } }, { onvifHost: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        hlsUrl: true,
        webrtcUrl: true,
        cameraPathName: true,
        onvifHost: true,
        onvifPort: true,
        onvifUsername: true,
        onvifPassword: true,
      },
    });

    console.log(`Found ${printers.length} printer(s) with a camera source to sync with camera-proxy.`);

    for (const printer of printers) {
      let rtspUrl;
      try {
        rtspUrl = await resolveOriginRtspUrl(printer);
      } catch (error) {
        console.error(`Skipping printer "${printer.name}" (${printer.id}): ${error.message}`);
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
