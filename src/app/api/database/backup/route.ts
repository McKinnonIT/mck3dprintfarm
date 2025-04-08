import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';
import prisma from '@/lib/prisma'; // Import Prisma client

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

async function ensureDirExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Created backup directory: ${dirPath}`);
        } else {
            throw error; // Re-throw other errors
        }
    }
}

// Helper to format title into a safe filename part
function formatTitleForFilename(title: string | undefined | null): string {
    const defaultName = 'printfarm';
    if (!title) return defaultName;
    return title.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9\-]/g, '') || defaultName;
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Ensure backup directory exists
        await ensureDirExists(BACKUP_DIR);

        // Fetch the Print Farm Title from settings
        const farmTitleSetting = await prisma.setting.findUnique({
            where: { key: 'printFarmTitle' },
            select: { value: true },
        });
        const farmTitle = farmTitleSetting?.value;
        const formattedTitle = formatTitleForFilename(farmTitle);

        // Construct filename
        const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
        const filename = `${formattedTitle}-${timestamp}.db`;
        const destinationPath = path.join(BACKUP_DIR, filename);

        // Check if DB file exists before copying
        try {
            await fs.access(DB_PATH);
        } catch (dbError: any) {
             if (dbError.code === 'ENOENT') {
                 console.error(`Database file not found at ${DB_PATH}`);
                 return NextResponse.json({ error: 'Database file not found.' }, { status: 500 });
             } 
             throw dbError; // Re-throw other errors
        }

        // Copy the database file
        await fs.copyFile(DB_PATH, destinationPath);
        console.log(`Database backup created: ${filename}`);

        return NextResponse.json({ message: `Backup '${filename}' created successfully.` }, { status: 200 });

    } catch (error: any) {
        console.error('Error creating database backup:', error);
        // Provide more specific error message if possible
        let errorMessage = 'Failed to create backup.';
        if (error.code === 'EACCES') {
            errorMessage = 'Permission denied when trying to access database or backup directory.';
        } else if (error.message) {
            errorMessage = `Failed to create backup: ${error.message}`;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 