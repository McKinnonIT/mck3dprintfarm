import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const filenameDecoded = decodeURIComponent(params.id);
    const filePath = join(process.cwd(), "uploads", filenameDecoded);

    console.log(`API: Serving file preview for ${filenameDecoded}`);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`API: File not found at path: ${filePath}`);
      
      // If the file doesn't exist, try to find it in the uploads directory
      // This is a fallback for when just the filename is provided without timestamp
      try {
        const uploads = join(process.cwd(), "uploads");
        const files = require('fs').readdirSync(uploads);
        
        console.log("API: Looking for a file matching:", filenameDecoded);
        console.log("API: Available files in uploads directory:", files);
        
        // Try different matching strategies
        let matchingFile = null;
        
        // Strategy 1: Exact ends-with match
        matchingFile = files.find(file => file.endsWith(filenameDecoded));
        
        // Strategy 2: Case-insensitive match on the file name without the timestamp prefix
        if (!matchingFile) {
          const searchName = filenameDecoded.toLowerCase();
          matchingFile = files.find(file => {
            // Skip timestamp prefix (everything before the first dash)
            const parts = file.split('-');
            if (parts.length > 1) {
              // Join all parts except the first one (timestamp)
              const nameWithoutTimestamp = parts.slice(1).join('-').toLowerCase();
              return nameWithoutTimestamp === searchName;
            }
            return false;
          });
        }
        
        // Strategy 3: Match just by the most important part of the filename
        if (!matchingFile) {
          // For example: Match "Divided_Nest_PLA_1h57m.gcode" to any file containing "Divided_Nest"
          const fileNameParts = filenameDecoded.split('_');
          if (fileNameParts.length > 1) {
            const importantPart = fileNameParts.slice(0, 2).join('_').toLowerCase();
            console.log("API: Trying to match with important part:", importantPart);
            
            matchingFile = files.find(file => 
              file.toLowerCase().includes(importantPart)
            );
          }
        }
        
        if (matchingFile) {
          const correctedPath = join(uploads, matchingFile);
          console.log(`API: Found matching file at ${correctedPath}`);
          
          // Read and serve the file from the corrected path
          const fileBuffer = await readFile(correctedPath);
          
          // Get file extension to determine content type
          const fileExtension = filenameDecoded.split('.').pop()?.toLowerCase();
          
          // Set content type based on file extension
          let contentType = "application/octet-stream"; // Default fallback
          
          if (fileExtension === "stl") {
            contentType = "model/stl";
          } else if (fileExtension === "gcode") {
            contentType = "text/plain";
          }
          
          console.log(`API: Serving ${fileExtension} file with content type: ${contentType}`);
          console.log(`API: Successfully read file (${fileBuffer.length} bytes)`);
          
          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `inline; filename="${filenameDecoded}"`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
              "X-Content-Type-Options": "nosniff",
              "Content-Length": fileBuffer.length.toString()
            },
          });
        }
      } catch (err) {
        console.error("API: Error in fallback file lookup:", err);
      }
      
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Get file extension to determine content type
    const fileExtension = filenameDecoded.split('.').pop()?.toLowerCase();
    
    // Set content type based on file extension
    let contentType = "application/octet-stream"; // Default fallback
    
    if (fileExtension === "stl") {
      contentType = "model/stl";
    } else if (fileExtension === "gcode") {
      contentType = "text/plain";
    }

    console.log(`API: Serving ${fileExtension} file with content type: ${contentType}`);

    // Read the file
    const fileBuffer = await readFile(filePath);
    console.log(`API: Successfully read file (${fileBuffer.length} bytes)`);

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filenameDecoded}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": fileBuffer.length.toString()
      },
    });
  } catch (error) {
    console.error("API Error: Failed to serve file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(
  request: Request,
  { params }: { params: { id: string } }
) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
      "Access-Control-Max-Age": "86400"
    },
  });
} 