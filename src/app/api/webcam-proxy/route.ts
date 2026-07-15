import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PROXYABLE_FIELDS = ['webcamUrl', 'printImageUrl'] as const;
type ProxyableField = (typeof PROXYABLE_FIELDS)[number];

function isProxyableField(value: string): value is ProxyableField {
  return (PROXYABLE_FIELDS as readonly string[]).includes(value);
}

/** Mirrors the URL shape conventions webcam bridges use for stills vs continuous streams. */
function applyStreamOrSnapshotVariant(url: string, isSnapshot: boolean): string {
  if (isSnapshot) {
    if (url.includes('stream')) return url.replace('stream', 'snapshot');
    if (url.includes('webcam') && !url.includes('snapshot')) return url.replace('webcam', 'snapshot');
    return url;
  }
  if (url.includes('snapshot')) return url.replace('snapshot', 'stream');
  if (url.includes('screenshot')) return url.replace('screenshot', 'stream');
  return url;
}

type ResolvedTarget = { url: string } | { error: string; status: number };

/**
 * Resolves the actual URL to fetch server-side. The normal path looks a
 * printer's stored webcamUrl/printImageUrl up by id - the raw address is
 * never accepted from the client, closing the open-proxy/SSRF hole this
 * endpoint used to have. A legacy `?url=` path remains for the admin-only
 * webcam debug tools, gated on an ADMIN session.
 */
async function resolveTarget(request: Request): Promise<ResolvedTarget> {
  const { searchParams } = new URL(request.url);
  const printerId = searchParams.get('printerId');

  if (printerId) {
    const fieldParam = searchParams.get('field') || 'webcamUrl';
    if (!isProxyableField(fieldParam)) {
      return { error: 'Invalid field', status: 400 };
    }
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
      select: { webcamUrl: true, printImageUrl: true },
    });
    const raw = printer?.[fieldParam];
    if (!raw) {
      return { error: 'Printer has no such camera URL', status: 404 };
    }
    const isSnapshot = searchParams.get('snapshot') === 'true';
    return { url: fieldParam === 'webcamUrl' ? applyStreamOrSnapshotVariant(raw, isSnapshot) : raw };
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }
  const url = searchParams.get('url');
  if (!url) {
    return { error: 'No URL provided', status: 400 };
  }
  return { url };
}

export async function GET(request: Request) {
  const resolved = await resolveTarget(request);
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const url = resolved.url;
  const isSnapshot = new URL(request.url).searchParams.get('snapshot') === 'true';

  try {
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log(`Proxying webcam request to: ${url}`);

    // Add specific headers for different webcam types
    const headers: HeadersInit = {
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Stream requests need different handling than snapshots
    const fetchOptions: RequestInit = {
      signal: controller.signal,
      cache: "no-store",
      headers
    };

    const response = await fetch(url, fetchOptions);

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Error fetching webcam: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch webcam: ${response.status}` },
        { status: response.status }
      );
    }

    // Detect content type based on URL and response headers
    let contentType = response.headers.get("content-type");

    // Default content type based on URL patterns if no content-type header
    if (!contentType) {
      if (isSnapshot || url.includes("snapshot") || url.includes("screenshot")) {
        contentType = "image/jpeg";
      } else if (url.includes("stream") || url.includes("mjpg") || url.includes("mjpeg")) {
        contentType = "multipart/x-mixed-replace";
      } else {
        contentType = "application/octet-stream";
      }
    }

    console.log(`Content type for ${url}: ${contentType}`);

    // Common response headers
    const responseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };

    // For multipart streams (MJPEG), we need to use the stream directly
    if (contentType.includes("multipart") ||
        (!isSnapshot && (url.includes("stream") || url.includes("mjpg") || url.includes("mjpeg")))) {
      console.log(`Detected multipart stream for ${url}, using streaming response`);

      // Set response as streaming multipart content
      if (!contentType.includes("multipart")) {
        responseHeaders["Content-Type"] = "multipart/x-mixed-replace";
      }

      // For MJPEG streams, pipe directly
      return new NextResponse(response.body, {
        headers: {
          ...responseHeaders,
          "Connection": "keep-alive"
        }
      });
    }

    // For images and other content types, use arrayBuffer
    console.log(`Returning regular content for ${url} with type ${contentType}`);
    const data = await response.arrayBuffer();

    // Return the proxied response
    return new NextResponse(data, {
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error(`Webcam proxy error:`, error);

    // More descriptive error message
    const errorMessage = error.message || "Unknown error";
    const errorStack = error.stack || "";

    return NextResponse.json(
      {
        error: `Failed to proxy webcam: ${errorMessage}`,
        details: errorStack,
      },
      { status: 500 }
    );
  }
}
