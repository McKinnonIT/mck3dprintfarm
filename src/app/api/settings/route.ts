// Force regenerate Prisma client
// @ts-ignore 
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
// Re-add auth imports needed for POST
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
      
      console.log('Setting table created successfully (if it didn\'t exist)');
    }
  } catch (error) {
    console.error('Error ensuring Setting table:', error);
  }
}

// GET /api/settings - Now Public
export async function GET() {
  console.log("GET /api/settings - Request received (Public Access)");
  try {
    // Remove session and role check for public access
    // const session = await getServerSession(authOptions);
    // if (session?.user?.role !== "ADMIN") {
    //   console.log(`GET /api/settings - Unauthorized: Role check failed.`);
    //   return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    // }
    // console.log(`GET /api/settings - Admin access granted for user: ${session?.user?.email}`);

    // Define expected keys and their corresponding env var names + code defaults
    const settingDefinitions = {
      printFarmTitle: { env: 'DEFAULT_PRINT_FARM_TITLE', default: 'MCK 3D Print Farm' },
      organizationName: { env: 'DEFAULT_ORG_NAME', default: 'McKelvey Engineering' },
      organizationWebsite: { env: 'DEFAULT_ORG_WEBSITE', default: 'https://engineering.wustl.edu/' },
    };
    const expectedKeys = Object.keys(settingDefinitions);

    // Fetch existing settings from DB
    const query = `SELECT key, value FROM Setting WHERE key IN (${expectedKeys.map(k => `'${k}'`).join(', ')})`;
    console.log("GET /api/settings - Executing query:", query);
    const dbSettingsRaw = await prisma.$queryRawUnsafe(query);
    console.log("GET /api/settings - Raw DB result:", dbSettingsRaw);

    // Format DB settings into a map
    const dbSettingsMap = Array.isArray(dbSettingsRaw) 
      ? dbSettingsRaw.reduce((acc, setting: any) => {
          if (setting.key) {
             acc[setting.key] = setting.value;
          }
          return acc;
        }, {} as Record<string, string>)
      : {};
      
    // Build final settings object, using DB value or Env Var or Code Default
    const finalSettings: Record<string, string> = {};
    for (const key of expectedKeys) {
        if (dbSettingsMap[key] !== undefined) {
            finalSettings[key] = dbSettingsMap[key];
        } else {
            const def = settingDefinitions[key as keyof typeof settingDefinitions];
            finalSettings[key] = process.env[def.env] || def.default;
        }
    }
    
    console.log("GET /api/settings - Returning final settings:", finalSettings);
    return NextResponse.json(finalSettings);
  } catch (error) {
    console.error('GET /api/settings - Error fetching settings:', error);
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
    
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      console.log(`POST /api/settings - Unauthorized: Role check failed. Expected 'ADMIN', got '${session?.user?.role}'`);
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required' },
        { status: 401 }
      );
    }
    
    console.log(`POST /api/settings - Admin access granted for user: ${session?.user?.email}`);
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