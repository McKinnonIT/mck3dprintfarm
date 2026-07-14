import { NextResponse } from "next/server";
import { spawn } from "child_process";

const SNAPSHOT_TIMEOUT_MS = 8000;

// Grabs a single JPEG frame from a live HLS stream via a short-lived ffmpeg
// process. mediamtx has no built-in snapshot endpoint, so this is the only
// way to get a still image out of an HLS-backed camera.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hlsUrl = searchParams.get("url");

  if (!hlsUrl) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  if (!hlsUrl.startsWith("http://") && !hlsUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Only http(s) URLs are supported" }, { status: 400 });
  }

  const playlistUrl = `${hlsUrl.replace(/\/+$/, "")}/index.m3u8`;

  try {
    const jpeg = await grabFrame(playlistUrl);
    return new NextResponse(jpeg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error(`Camera snapshot error for ${playlistUrl}:`, error?.message || error);
    return NextResponse.json({ error: "Failed to grab camera snapshot" }, { status: 502 });
  }
}

function grabFrame(playlistUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-protocol_whitelist", "http,https,tcp,tls,crypto",
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
