import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { gcode, filename, metadata } = data;

    if (!gcode || !filename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create gcode directory if it doesn't exist
    const gcodeDir = path.join(process.cwd(), 'public', 'gcode');
    await fs.mkdir(gcodeDir, { recursive: true });

    // Save the gcode file
    const filePath = path.join(gcodeDir, filename);
    await fs.writeFile(filePath, gcode);

    // Save metadata
    const metadataPath = path.join(gcodeDir, `${filename}.meta.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({ success: true, filePath });
  } catch (error) {
    console.error('Error saving G-code:', error);
    return NextResponse.json({ error: 'Failed to save G-code' }, { status: 500 });
  }
} 