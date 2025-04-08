import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db'; // Get path from env or default
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let dbSize = 0;
        let lastBackupDate: string | null = null;
        let lastBackupFilename: string | null = null;

        // 1. Get Database File Size
        try {
            const dbStats = await fs.stat(DB_PATH);
            dbSize = dbStats.size;
        } catch (err) {
            console.warn(`Could not get stats for database file ${DB_PATH}:`, err);
            // If DB file doesn't exist, size is 0, proceed with other stats
        }

        // 2. Get Counts from Prisma
        const [userCount, roleCount, printerCount] = await prisma.$transaction([
            prisma.user.count(),
            prisma.role.count(),
            prisma.printer.count(),
            // Add more counts here if needed (e.g., prisma.printJob.count())
        ]);

        // 3. Get Latest Backup Date
        try {
            await fs.access(BACKUP_DIR); // Check if backup dir exists
            const dirents = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
            let latestMtime = 0;

            for (const dirent of dirents) {
                if (dirent.isFile() && dirent.name.endsWith('.db')) {
                    const filePath = path.join(BACKUP_DIR, dirent.name);
                    try {
                        const stats = await fs.stat(filePath);
                        if (stats.mtimeMs > latestMtime) {
                            latestMtime = stats.mtimeMs;
                            lastBackupDate = stats.mtime.toISOString();
                            lastBackupFilename = dirent.name;
                        }
                    } catch (statError) {
                         console.warn(`Could not stat backup file ${dirent.name}:`, statError);
                    }
                }
            }
        } catch (err) {
             console.log(`Backup directory ${BACKUP_DIR} not found or not accessible, skipping last backup date.`);
        }

        const stats = {
            dbSize,
            userCount,
            roleCount,
            printerCount,
            lastBackupDate, // ISO string or null
            lastBackupFilename, // filename or null
        };

        return NextResponse.json(stats, { status: 200 });

    } catch (error: any) {
        console.error('Error fetching database stats:', error);
        return NextResponse.json({ error: `Failed to fetch stats: ${error.message}` }, { status: 500 });
    }
} 