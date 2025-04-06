import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spawn } from "child_process";
import { Readable } from "stream";

export const dynamic = 'force-dynamic'; // Ensure this route is not statically optimized

// Function to convert a Node.js Readable stream to a Web ReadableStream
function nodeReadableToWebReadableStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(request: NextRequest) {
  console.log("GET /api/debug/logs - Request received");

  // --- Authorization Check ---
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    console.log(`GET /api/debug/logs - Unauthorized: Role check failed.`);
    return new NextResponse("Forbidden. Admin access required.", { status: 403 });
  }
  console.log(`GET /api/debug/logs - Admin access granted for user: ${session?.user?.email}`);

  // --- Spawn Docker Logs Process ---
  // IMPORTANT: Assumes docker client is available IN the container 
  // and the container can reach the host docker socket or daemon.
  // This might require specific docker-in-docker setup or mounting the docker socket.
  // Adjust container name as needed.
  const containerName = "docker-tests-mck3dprintfarm-1"; 
  let logProcess: ReturnType<typeof spawn> | null = null;
  
  try {
    console.log(`Attempting to stream logs for container: ${containerName}`);
    // Use `docker logs` with follow flag and timestamps
    logProcess = spawn("docker", ["logs", "-f", "--timestamps", containerName], { 
        stdio: ['ignore', 'pipe', 'pipe'] // Pipe stdout and stderr
    });

    // Combine stdout and stderr into a single stream for the client
    const combinedStream = new Readable({
      read() {}
    });

    logProcess.stdout.on("data", (data) => {
        // Format as Server-Sent Event
        const formattedData = `data: ${data.toString().replace(/\n/g, '\ndata: ')}\n\n`;
        combinedStream.push(formattedData);
    });

    logProcess.stderr.on("data", (data) => {
        // Format errors as Server-Sent Events too
        const formattedData = `data: STDERR: ${data.toString().replace(/\n/g, '\ndata: STDERR: ')}\n\n`;
        combinedStream.push(formattedData);
    });

    logProcess.on("error", (err) => {
      console.error(`Error spawning/streaming docker logs for ${containerName}:`, err);
      combinedStream.push(`event: error\ndata: ${JSON.stringify({ message: `Error streaming logs: ${err.message}` })}\n\n`);
      combinedStream.push(null); // End the stream on error
    });

    logProcess.on("close", (code) => {
      console.log(`Docker logs process for ${containerName} exited with code ${code}`);
      combinedStream.push(`event: close\ndata: Log stream closed (code: ${code})\n\n`);
      combinedStream.push(null); // End the stream
    });

    // Ensure the process is killed if the request is aborted
    request.signal.addEventListener('abort', () => {
        console.log('Request aborted, killing docker logs process...');
        logProcess?.kill();
    });

    // Convert Node stream to Web stream and return as SSE
    const webStream = nodeReadableToWebReadableStream(combinedStream);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error('Error setting up log stream:', error);
    // Ensure process is killed if setup fails
    logProcess?.kill(); 
    return new NextResponse("Failed to start log stream", { status: 500 });
  }
} 