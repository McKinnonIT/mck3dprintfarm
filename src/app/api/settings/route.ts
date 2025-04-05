// Force regenerate Prisma client
// @ts-ignore 
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// This is a workaround for Prisma Schema not being properly synchronized
// in the Docker environment
const settingsTable = 'Setting';

// Function to ensure the Setting table exists
async function ensureSettingTable() {
  try {
    // Check if table exists
    const tableCheck = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Setting'"
    );
    
    if (!Array.isArray(tableCheck) || tableCheck.length === 0) {
      console.log('Setting table does not exist, creating it now...');
      
      // Create the table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Setting" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);
      
      // Create index
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_key" ON "Setting"("key")
      `);
      
      // Check if any settings already exist
      const existingSettings = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "Setting"
      `);
      
      const count = (existingSettings as any)[0]?.count || 0;
      
      // Only insert default values if no settings exist
      if (count === 0) {
        console.log('No existing settings found, inserting defaults...');
        // Insert default values
        const defaults = [
          { id: crypto.randomUUID(), key: 'printFarmTitle', value: 'MCK 3D Print Farm' },
          { id: crypto.randomUUID(), key: 'organizationName', value: 'McKelvey Engineering' },
          { id: crypto.randomUUID(), key: 'organizationWebsite', value: 'https://engineering.wustl.edu/' }
        ];
        
        for (const setting of defaults) {
          await prisma.$executeRawUnsafe(`
            INSERT OR IGNORE INTO "Setting" ("id", "key", "value", "createdAt", "updatedAt")
            SELECT '${setting.id}', '${setting.key}', '${setting.value}', datetime('now'), datetime('now')
            WHERE NOT EXISTS (SELECT 1 FROM "Setting" WHERE key = '${setting.key}')
          `);
        }
        
        console.log('Default settings inserted successfully');
      } else {
        console.log('Settings already exist, skipping default inserts');
      }
      
      console.log('Setting table created successfully');
    }
  } catch (error) {
    console.error('Error ensuring Setting table:', error);
  }
}

// GET /api/settings
export async function GET() {
  try {
    // Ensure table exists before querying
    await ensureSettingTable();
    
    // Use Prisma's raw query with direct SQL
    const query = 'SELECT * FROM Setting';
    const settings = await prisma.$queryRawUnsafe(query);
    
    // Convert the results to the expected format
    const formattedSettings = Array.isArray(settings) 
      ? settings.reduce((acc, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {} as Record<string, string>)
      : {};
    
    return NextResponse.json(formattedSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required' },
        { status: 401 }
      );
    }
    
    // Ensure table exists before inserting/updating
    await ensureSettingTable();

    const data = await request.json();
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Process each key-value pair with raw SQL queries
    for (const [key, value] of Object.entries(data)) {
      // Check if setting exists first
      const checkQuery = `SELECT * FROM Setting WHERE key = '${key}' LIMIT 1`;
      const existing = await prisma.$queryRawUnsafe(checkQuery);
      
      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing setting
        const updateQuery = `UPDATE Setting SET value = '${String(value)}', updatedAt = datetime('now') WHERE key = '${key}'`;
        await prisma.$executeRawUnsafe(updateQuery);
      } else {
        // Create new setting
        const id = crypto.randomUUID();
        const insertQuery = `INSERT INTO Setting (id, key, value, createdAt, updatedAt) VALUES ('${id}', '${key}', '${String(value)}', datetime('now'), datetime('now'))`;
        await prisma.$executeRawUnsafe(insertQuery);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
} 