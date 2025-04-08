import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    // Check if user is authenticated and is an Admin
    if (!session || !session.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Ensure backup directory exists (though it should if backups were created)
        try {
            await fs.access(BACKUP_DIR);
        } catch (error) {
            // If the directory doesn't exist, return an empty list
            console.log(`Backup directory not found: ${BACKUP_DIR}. Returning empty list.`);
            return NextResponse.json({ backups: [] }, { status: 200 });
        }
        
        const dirents = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
        
        const backupFiles = await Promise.all(
            dirents
                .filter(dirent => dirent.isFile() && dirent.name.endsWith('.db'))
                .map(async (dirent) => {
                    const filePath = path.join(BACKUP_DIR, dirent.name);
                    try {
                        const stats = await fs.stat(filePath);
                        return {
                            filename: dirent.name,
                            size: stats.size, // Size in bytes
                            modifiedTime: stats.mtime.toISOString(), // ISO string format
                            modifiedTimeFormatted: format(stats.mtime, 'yyyy-MM-dd HH:mm:ss'), // User-friendly format
                        };
                    } catch (statError) {
                        console.error(`Error getting stats for file ${dirent.name}:`, statError);
                        return null; // Skip files we can't get stats for
                    }
                })
        );

        // Filter out any nulls (from stat errors) and sort by modified time descending
        const validBackups = backupFiles
            .filter(backup => backup !== null)
            .sort((a, b) => new Date(b!.modifiedTime).getTime() - new Date(a!.modifiedTime).getTime());

        return NextResponse.json({ backups: validBackups }, { status: 200 });

    } catch (error: any) {
        console.error('Error listing database backups:', error);
        return NextResponse.json({ error: `Failed to list backups: ${error.message}` }, { status: 500 });
    }
} 