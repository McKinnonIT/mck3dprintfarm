import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { join } from "path";
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import readline from 'readline';

// Helper function to parse thumbnail data from G-code
async function extractThumbnailFromGcode(filePath: string): Promise<{ format: string, base64Data: string } | null> {
    // Check file size to avoid reading huge files - adjust limit as needed (e.g., 5MB)
    try {
        const stats = await stat(filePath);
        if (stats.size > 5 * 1024 * 1024) {
            console.warn(`Thumbnail extraction skipped: File ${filePath} is too large (${stats.size} bytes)`);
            return null;
        }
    } catch (statError: any) {
         if (statError.code === 'ENOENT') {
             console.error(`Thumbnail extraction failed: File not found at ${filePath}`);
             return null; // File not found
         } 
         console.error(`Thumbnail extraction failed: Error getting file stats for ${filePath}:`, statError);
         return null; // Other stat error
    }

    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isThumbnailSection = false;
    let base64Data = "";
    let format = "png"; // Default format
    const maxSizeMb = 5; // Max thumbnail data size to prevent OOM
    let currentSize = 0;

    for await (const line of rl) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith("; thumbnail begin") || trimmedLine.match(/^; thumbnail_\w+ begin/)) {
            isThumbnailSection = true;
            // Try to extract format from the "thumbnail_FORMAT begin" line itself
            const formatMatch = trimmedLine.match(/^; thumbnail_(\w+) begin/);
            if (formatMatch && formatMatch[1]) {
                 format = formatMatch[1].toLowerCase();
                 console.log(`[Thumbnail Parser] Detected format from begin line: ${format}`);
            } else {
                 // Fallback: Check for separate "; format = ..." line (less common now)
                 const nextLineFormatMatch = line.match(/; format\s*=\s*(\w+)/); // Check original line var in case next line has it
                 if (nextLineFormatMatch && nextLineFormatMatch[1]) {
                    format = nextLineFormatMatch[1].toLowerCase();
                    console.log(`[Thumbnail Parser] Detected format from separate line: ${format}`);
                 }
             }
             // Optional: Parse width/height/size from the begin line if needed
             // e.g., ; thumbnail_JPG begin 200x200 8008
            continue;
        }

        if (trimmedLine.startsWith("; thumbnail end")) {
            isThumbnailSection = false;
            break; // Found the end, stop reading
        }

        // If inside the thumbnail section, append the line (without the check for leading ';')
        if (isThumbnailSection) {
             // Check if the line looks like base64 data (simple check: non-empty, doesn't start with '; ' which might indicate other metadata)
             // More robust check could involve regex for base64 characters, but this might suffice.
             if (trimmedLine && !trimmedLine.startsWith('; ')) {
                const dataPart = trimmedLine; // Use the whole trimmed line
                currentSize += dataPart.length * 0.75; // Estimate byte size
                if (currentSize > maxSizeMb * 1024 * 1024) {
                    console.warn(`Thumbnail extraction stopped: Thumbnail data exceeds ${maxSizeMb}MB limit for file ${filePath}`);
                    rl.close();
                    fileStream.destroy(); 
                    return null; // Exceeded size limit
                }
                base64Data += dataPart;
            }
        }
    }
    
    rl.close();
    fileStream.destroy(); // Ensure stream is closed

    if (base64Data) {
        return { format, base64Data };
    } else {
        return null; // No thumbnail found or extracted
    }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const fileId = params.id;
        const fileRecord = await prisma.file.findUnique({
            where: { id: fileId },
            select: { path: true, name: true, uploadedBy: true }
        });

        if (!fileRecord) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Authorization: Ensure user owns the file (or implement role-based access)
        if (fileRecord.uploadedBy !== userId && session.user.role !== 'ADMIN') {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Only process gcode/bgcode
        const lowerCaseFileName = fileRecord.name.toLowerCase();
        if (!lowerCaseFileName.endsWith('.gcode') && !lowerCaseFileName.endsWith('.bgcode')) {
             return NextResponse.json({ error: "Thumbnail preview only available for .gcode or .bgcode files" }, { status: 400 });
        }

        if (!fileRecord.path) {
             return NextResponse.json({ error: "File path not found in record" }, { status: 500 });
        }

        const absoluteFilePath = join(process.cwd(), "uploads", fileRecord.path);
        console.log(`[Thumbnail API] Reading file: ${absoluteFilePath}`);

        const thumbnailData = await extractThumbnailFromGcode(absoluteFilePath);

        if (!thumbnailData) {
             console.log(`[Thumbnail API] No thumbnail found in ${fileRecord.name}`);
             return NextResponse.json({ error: "No thumbnail found in G-code file" }, { status: 404 });
        }
        
        console.log(`[Thumbnail API] Extracted ${thumbnailData.format} thumbnail, ${thumbnailData.base64Data.length} base64 chars.`);

        // Return as data URI
        const dataUri = `data:image/${thumbnailData.format};base64,${thumbnailData.base64Data}`;
        return NextResponse.json({ dataUri });

    } catch (error) {
        console.error(`[Thumbnail API] Error getting thumbnail for file ${params.id}:`, error);
        return NextResponse.json({ error: "Failed to retrieve thumbnail" }, { status: 500 });
    }
} 