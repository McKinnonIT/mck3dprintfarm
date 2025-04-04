import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const { connectPrinter } = require('@/lib/prusalink-fixed-bridge');

export async function POST(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const { ipAddress, apiKey } = await request.json();

    if (!ipAddress || !apiKey) {
      return NextResponse.json(
        { success: false, message: "Missing IP address or API key" },
        { status: 400 }
      );
    }

    console.log(`Testing connection to PrusaLink printer at ${ipAddress}...`);

    // Call the fixed connectPrinter function with a timeout of 10 seconds
    const result = await connectPrinter(ipAddress, apiKey, 10);

    console.log(`Connection test result:`, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error connecting to printer:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Unknown error",
        error: error
      },
      { status: 500 }
    );
  }
} 