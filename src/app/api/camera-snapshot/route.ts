import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";
import { internalHlsPlaylistUrl } from "@/lib/camera-proxy-client";

const SNAPSHOT_TIMEOUT_MS = 8000;

// Grabs a single JPEG frame from a live HLS stream via a short-lived ffmpeg
// process. mediamtx has no built-in snapshot endpoint, so this is the only
// way to get a still image out of an HLS-backed camera. Always reads from
// the camera-proxy sidecar's local restream, never the origin mediamtx
// server on the camera VLAN.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const printerId = searchParams.get("printerId");

  if (!printerId) {
    return NextResponse.json({ error: "printerId is required" }, { status: 400 });
  }

  const printer = await prisma.printer.findUnique({
    where: { id: printerId },
    select: { cameraPathName: true },
  });

  if (!printer?.cameraPathName) {
    return NextResponse.json({ error: "Printer has no camera path registered" }, { status: 404 });
  }

  const playlistUrl = internalHlsPlaylistUrl(printer.cameraPathName);
  if (!playlistUrl) {
    return NextResponse.json({ error: "Camera proxy is not configured" }, { status: 503 });
  }

  try {
    const jpeg = await grabFrame(playlistUrl);
    return new NextResponse(jpeg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error(`Camera snapshot error for printer ${printerId}:`, error?.message || error);
    return NextResponse.json({ error: "Failed to grab camera snapshot" }, { status: 502 });
  }
}

function grabFrame(playlistUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-protocol_whitelist", "http,https,tcp,tls,crypto",
      // The sidecar's HLS listener uses a self-signed cert (see
      // docker/camera-proxy/generate-cert.sh) - nothing to verify it against.
      "-tls_verify", "0",
      "-i", playlistUrl,
      "-frames:v", "1",
      "-f", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ffmpeg.kill("SIGKILL");
      reject(new Error("Timed out waiting for camera frame"));
    }, SNAPSHOT_TIMEOUT_MS);

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    ffmpeg.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });

    ffmpeg.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const jpeg = Buffer.concat(chunks);
      if (code === 0 && jpeg.length > 0) {
        resolve(jpeg);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}
