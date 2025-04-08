import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { stat, unlink } from 'fs/promises'; // Import stat and unlink for deletion

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// Basic check to prevent path traversal
function isValidFilename(filename: string): boolean {
    // Disallow directory separators and ".."
    return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
}

export async function GET(
    request: Request, 
    { params }: { params: { filename: string } }
) {
    const session = await getServerSession(authOptions);

    // 1. Check Authorization
    if (!session || !session.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filename = params.filename;

    // 2. Validate Filename
    if (!filename || !isValidFilename(filename) || !filename.endsWith('.db')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    try {
        // 3. Check if file exists
        await stat(filePath); // Throws error if not found

        // 4. Read file content
        const fileBuffer = await fs.readFile(filePath);

        // 5. Create response with download headers
        const headers = new Headers();
        headers.set('Content-Type', 'application/vnd.sqlite3'); // Mime type for SQLite
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: headers,
        });

    } catch (error: any) {
        if (error.code === 'ENOENT') {
             console.error(`Backup file not found: ${filePath}`);
            return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
        } else {
            console.error(`Error reading backup file ${filename}:`, error);
            return NextResponse.json({ error: `Failed to read backup file: ${error.message}` }, { status: 500 });
        }
    }
}

export async function DELETE(
    request: Request, 
    { params }: { params: { filename: string } }
) {
    const session = await getServerSession(authOptions);

    // 1. Check Authorization
    if (!session || !session.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filename = params.filename;

    // 2. Validate Filename
    if (!filename || !isValidFilename(filename) || !filename.endsWith('.db')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_DIR, filename);
    console.log(`Attempting to delete backup file: ${filePath}`);

    try {
        // 3. Check if file exists before attempting delete
        await stat(filePath); // Throws error if not found

        // 4. Attempt to delete the file
        await unlink(filePath);
        console.log(`Successfully deleted backup file: ${filename}`);

        // 5. Return success response
        return NextResponse.json({ message: `Backup '${filename}' deleted successfully.` }, { status: 200 });

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Attempted to delete non-existent backup file: ${filePath}`);
            // Arguably, deleting something that doesn't exist isn't strictly an error
            // Return 200 or 404? Let's go with 404 for clarity.
            return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
        } else if (error.code === 'EACCES') {
             console.error(`Permission denied deleting backup file ${filename}:`, error);
             return NextResponse.json({ error: 'Permission denied deleting file.' }, { status: 500 });
        }else {
            console.error(`Error deleting backup file ${filename}:`, error);
            return NextResponse.json({ error: `Failed to delete backup file: ${error.message}` }, { status: 500 });
        }
    }
} 