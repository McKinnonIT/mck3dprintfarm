import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { spawn, execSync, ChildProcessWithoutNullStreams } from 'child_process';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { fileId, printerId, printNow = true } = data;

    if (!fileId || !printerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get file details
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Get printer details
    const printer = await prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return NextResponse.json(
        { error: "Printer not found" },
        { status: 404 }
      );
    }

    if (!printer.apiKey && (printer.type.toLowerCase().includes('prusa') || printer.type.toLowerCase() === 'moonraker')) {
        return NextResponse.json({ error: "Printer API key is missing for this printer type." }, { status: 400 });
    }

    // Determine status based on printNow flag
    const jobStatus = printNow ? "pending" : "uploaded";
    
    // Find the absolute path based on the stored relative path
    const absoluteFilePath = path.join(process.cwd(), "uploads", file.path);

    // Check if file exists on disk before proceeding
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`File not found on server disk at path: ${absoluteFilePath}. DB record path: ${file.path}`);
      return NextResponse.json(
        { error: "File not found on server disk. It may have been deleted or moved." },
        { status: 404 }
      );
    }

    // Create a record of the print job in the database *before* calling the bridge
    // We will update its status later
    const printJob = await prisma.printJob.create({
      data: {
        name: file.name,
        fileId: file.id, // Link to the existing file record
        printerId: printerId,
        status: "pending", // Initial status
        userId: session.user.id
      }
    });

    // Get file extension to determine the correct API flow
    const fileExt = path.extname(file.name).toLowerCase();
    const isPrusaLink = printer.type.toLowerCase().includes('prusa');
    const isMoonraker = printer.type.toLowerCase() === 'moonraker';
    const isBambuLab = printer.type.toLowerCase().includes('bambu');
    const isBGCode = fileExt === '.bgcode';
    const isGCode = fileExt === '.gcode';
    const is3MF = fileExt === '.3mf';
    
    // --- File Type Compatibility Checks ---
    if (isPrusaLink && !isBGCode) {
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "failed", error: "PrusaLink printers currently only support .bgcode files via this interface." } });
       return NextResponse.json({ error: "PrusaLink printers currently only support .bgcode files via this interface.", jobId: printJob.id }, { status: 400 });
    }
    if (isMoonraker && !isGCode) {
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "failed", error: "Moonraker printers only support .gcode files." } });
       return NextResponse.json({ error: "Moonraker printers only support .gcode files.", jobId: printJob.id }, { status: 400 });
    }
    if (isBambuLab && !is3MF && !isGCode) { // Bambu can often take gcode too
       await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "failed", error: "Bambu Lab printers currently only support .3mf files (and sometimes .gcode) via this interface." } });
       return NextResponse.json({ error: "Bambu Lab printers currently only support .3mf files (and sometimes .gcode) via this interface.", jobId: printJob.id }, { status: 400 });
    }
    // --- End Compatibility Checks ---

    try {
      // --- PrusaLink Handling (Using Python Bridge) ---
      if (isPrusaLink) {
        console.log(`[Print Job API] Using Python bridge for PrusaLink printer ${printer.name}`);
        const printerIp = printer.apiUrl.replace(/^https?:\/\//, '').split(':')[0]; // Extract IP
        const apiKey = printer.apiKey; // Already checked if exists
        const filenameOnPrinter = path.basename(file.name); // Use original filename on printer

        // Use absolute path directly inside the container
        const pythonScriptPath = '/app/src/lib/prusalink_bridge.py';

        // Verify the script exists (optional, but good practice)
        if (!fs.existsSync(pythonScriptPath)) {
            console.error(`[Print Job API] Python bridge script not found at ${pythonScriptPath}`);
            throw new Error(`PrusaLink bridge script not found.`);
        }

        // Prepare arguments for the Python script
        const pythonArgs = [
            pythonScriptPath, // Script path is the first argument
            '--ip', printerIp,
            '--apikey', apiKey,
            '--filepath', absoluteFilePath,
            '--filename', filenameOnPrinter
        ];
        if (printNow) {
            pythonArgs.push('--printnow');
        }

        console.log(`[Print Job API] Spawning Python: /usr/bin/python3 ${pythonArgs.join(' ')}`);

        // --- Spawn the Actual Python Script --- 
        const pythonProcess = spawn('/usr/bin/python3', pythonArgs);

        let scriptStdout = '';
        let scriptStderr = '';

        // --- Handle Python Script Output/Errors --- 
        pythonProcess.stdout.on('data', (data) => {
            const outputChunk = data.toString();
            scriptStdout += outputChunk;
            console.log(`[Print Job API - Python stdout]: ${outputChunk.trim()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            // Python script logs messages to stderr
            const errorChunk = data.toString();
            scriptStderr += errorChunk;
            console.error(`[Print Job API - Python stderr]: ${errorChunk.trim()}`);
        });

        // Promise to wait for the Python script process to finish
        const scriptResult = await new Promise<{success: boolean; message?: string; error?: any}>((resolve, reject) => {
            pythonProcess.on('error', (err) => {
                // This catches errors spawning the process itself (e.g., command not found)
                console.error('[Print Job API] Failed to spawn Python process:', err);
                reject(new Error(`Failed to start Python bridge: ${err.message}`));
            });

            pythonProcess.on('close', (code) => {
                console.log(`[Print Job API] Python process exited with code ${code}`);
                if (code !== 0) {
                    // Non-zero exit code indicates an error *within* the Python script (already logged to stderr)
                    console.error(`[Print Job API] Python script failed (code ${code}). Stderr:\n${scriptStderr}`);
                    // Try parsing stdout for a JSON error message, otherwise use stderr
                    try {
                        const errorResult = JSON.parse(scriptStdout || '{}');
                        reject(new Error(errorResult.message || scriptStderr || `Python script failed with exit code ${code}`));
                    } catch (parseError) {
                        reject(new Error(scriptStderr || `Python script failed with exit code ${code}`));
                    }
                } else {
                    // Success (exit code 0)
                    try {
                        // The result JSON is printed to stdout
                        const result = JSON.parse(scriptStdout);
                        if (result.success) {
                            resolve(result);
                        } else {
                            // Script ran but reported failure
                            console.error(`[Print Job API] Python script reported failure:`, result);
                            reject(new Error(result.message || "Python script reported an unspecified error."));
                        }
                    } catch (parseError: any) {
                        console.error('[Print Job API] Failed to parse Python script JSON output:', parseError);
                        console.error(`[Print Job API] Raw stdout from Python:\n${scriptStdout}`);
                        reject(new Error(`Failed to parse response from Python bridge: ${parseError.message}`));
                    }
                }
            });
        }); // End of Python script promise

        console.log('[Print Job API] Python bridge script completed.', scriptResult);

        // --- Update Job Status Based on Python Result --- 
        if (scriptResult.success) {
            const finalStatus = printNow ? "printing" : "uploaded";
            await prisma.printJob.update({
              where: { id: printJob.id },
              data: { 
                    status: finalStatus, 
                    startedAt: printNow ? new Date() : null,
                    error: null // Clear any previous error
                }
            });
            if (printNow) {
                await prisma.printer.update({ 
                    where: { id: printer.id }, 
                    data: { 
                        operationalStatus: "printing", 
                        printStartTime: new Date() 
                    }
                });
            }
            console.log(`[Print Job API] Job ${printJob.id} status updated to ${finalStatus} successfully.`);
        } else {
            // This case should technically be handled by the reject in the promise, but as a fallback:
            console.error('[Print Job API] Python script failed, updating job status.');
            throw new Error(scriptResult.message || "Unknown error from PrusaLink Python bridge");
        }

      // --- End PrusaLink Handling ---

      } else if (isMoonraker) {
        // --- Moonraker Handling (Existing Code - Needs Verification) ---
        console.log(`[Print Job API] Using Moonraker bridge for ${printer.name}`);
        // This part still uses require - needs verification if moonraker-bridge-py works this way
        const moonrakerBridge = require("@/lib/moonraker-bridge-py"); 
        let uploadResult;
        try {
            uploadResult = await moonrakerBridge.uploadAndPrint(
                printer.apiUrl,
                printer.apiKey,
                absoluteFilePath,
                path.basename(file.name),
                printNow
            );
            console.log(`[Print Job API] Moonraker bridge result:`, uploadResult);
            if (!uploadResult.success) {
                console.error('[Print Job API] Moonraker bridge returned error:', uploadResult);
                throw new Error(uploadResult.message || "Unknown error from Moonraker bridge");
            }
         } catch (error: any) {
             console.error('[Print Job API] Moonraker bridge error:', error);
             throw error; // Rethrow to be caught by outer try/catch
         }
        // Update job status based on operation result
        const finalStatus = printNow ? "printing" : "uploaded";
        await prisma.printJob.update({ where: { id: printJob.id }, data: { status: finalStatus, startedAt: printNow ? new Date() : null } });
        if (printNow) {
            await prisma.printer.update({ where: { id: printer.id }, data: { operationalStatus: "printing", printStartTime: new Date() } });
        }
       // --- End Moonraker Handling ---

      } else if (isBambuLab) {
          // TODO: Implement Bambu Lab handling using its Python bridge
          console.warn(`[Print Job API] Bambu Lab handling not yet implemented via Python bridge.`);
          throw new Error('Bambu Lab printing not yet implemented via bridge.');
      } else {
          // --- Generic/Fallback Handling (Needs Review) ---
          // This path should ideally not be hit if types are handled above
          console.warn(`[Print Job API] Reached generic handling for printer type ${printer.type}. Review required.`);
          throw new Error(`Unsupported printer type for bridge: ${printer.type}`);
          // const uploadResult = await uploadFileToPrinter(printer, absoluteFilePath, file.name);
          // if (!uploadResult.success) throw new Error(uploadResult.message);
          // if (printNow) {
          //     const printResult = await startPrintJob(printer, uploadResult, file.name);
          //     if (!printResult.success) throw new Error(printResult.message);
          //     await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "printing", startedAt: new Date() } });
          //     await prisma.printer.update({ where: { id: printer.id }, data: { operationalStatus: "printing", printStartTime: new Date() } });
          // } else {
          //     await prisma.printJob.update({ where: { id: printJob.id }, data: { status: "uploaded" } });
          // }
      }

      // If we reach here, the operation specific to the printer type was successful
      const finalJob = await prisma.printJob.findUnique({ where: { id: printJob.id }});
      return NextResponse.json(finalJob);

    } catch (error: any) {
      // Outer error handler: Catches errors from bridge calls or other issues within the try block
      console.error('[Print Job API] Error during printer communication or job update:', error);
      // Update job status to failed
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: "failed",
              error: error.message || "Unknown communication error" 
        }
      }).catch(dbErr => console.error("DB update failed on outer error:", dbErr)); // Catch potential error during update
      
      return NextResponse.json(
        { 
          error: error.message || "Unknown communication error", 
          jobId: printJob.id
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Top-level error handler: Catches errors before job creation or in initial setup
    console.error('[Print Job API] Top-level API error:', error);
    return NextResponse.json(
      { error: error.message || "Unknown internal server error" }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const printJobs = await prisma.printJob.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        file: true,
        printer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(printJobs);
  } catch (error) {
    console.error("Failed to fetch print jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch print jobs" },
      { status: 500 }
    );
  }
} 