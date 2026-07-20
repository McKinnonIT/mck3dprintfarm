import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchOnvifStreamUri } from "@/lib/onvif-client";

/**
 * Tests ONVIF camera credentials before a printer is even saved (the add
 * form has no printerId yet), so this takes the raw connection details
 * directly rather than looking up a printer.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const { host, port, username, password } = body;

  if (!host || typeof host !== "string") {
    return NextResponse.json({ success: false, message: "Camera host is required" }, { status: 400 });
  }

  try {
    const { uri, deviceInfo } = await fetchOnvifStreamUri({ host, port, username, password });
    return NextResponse.json({ success: true, streamUri: uri, deviceInfo });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Failed to connect to camera" });
  }
}
