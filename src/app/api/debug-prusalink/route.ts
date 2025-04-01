import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { apiUrl, apiKey } = await request.json();
    
    console.log(`Testing PrusaLink connection to: ${apiUrl}`);
    console.log(`Using API key: ${apiKey ? "Provided" : "Not provided"}`);
    
    if (!apiUrl) {
      return NextResponse.json({ error: "API URL is required" }, { status: 400 });
    }
    
    // Try multiple endpoints with verbose logging
    const results = [];
    
    // Test 1: Basic API version info
    try {
      console.log(`Test 1: Trying /api/version endpoint on ${apiUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const versionResponse = await fetch(`${apiUrl}/api/version`, {
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const versionData = await versionResponse.json();
      
      results.push({
        endpoint: "/api/version",
        status: versionResponse.status,
        data: versionData,
        success: true
      });
      console.log(`Version endpoint successful: ${JSON.stringify(versionData)}`);
    } catch (error) {
      console.error(`Version endpoint error:`, error);
      results.push({
        endpoint: "/api/version",
        error: error.message,
        success: false
      });
    }
    
    // Test 2: Try v1 info API
    try {
      console.log(`Test 2: Trying /api/v1/info endpoint on ${apiUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const infoResponse = await fetch(`${apiUrl}/api/v1/info`, {
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const infoData = await infoResponse.json();
      
      results.push({
        endpoint: "/api/v1/info",
        status: infoResponse.status,
        data: infoData,
        success: true
      });
      console.log(`V1 Info endpoint successful: ${JSON.stringify(infoData)}`);
    } catch (error) {
      console.error(`V1 Info endpoint error:`, error);
      results.push({
        endpoint: "/api/v1/info",
        error: error.message,
        success: false
      });
    }
    
    // Test 3: Try printer API (original)
    try {
      console.log(`Test 3: Trying /api/printer endpoint on ${apiUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const printerResponse = await fetch(`${apiUrl}/api/printer`, {
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const printerData = await printerResponse.json();
      
      results.push({
        endpoint: "/api/printer",
        status: printerResponse.status,
        data: printerData,
        success: true
      });
      console.log(`Printer endpoint successful: ${JSON.stringify(printerData)}`);
    } catch (error) {
      console.error(`Printer endpoint error:`, error);
      results.push({
        endpoint: "/api/printer",
        error: error.message,
        success: false
      });
    }
    
    // Test if all tests failed
    const allFailed = results.every(result => !result.success);
    
    return NextResponse.json({
      apiUrl,
      results,
      allFailed,
      message: allFailed ? "All connection tests failed" : "Some tests succeeded"
    });
  } catch (error) {
    console.error("Debug PrusaLink error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 