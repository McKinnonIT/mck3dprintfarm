#!/usr/bin/env node

/**
 * Database Migration Script for Print Farm
 * 
 * This script applies any pending migrations to the database.
 * It reads the current database version and applies all migrations
 * that have a higher version number.
 * 
 * Usage:
 *   node apply_migrations.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const packageJson = require('../package.json');
const currentAppVersion = packageJson.version;

// Get the database file path from environment variable or use default
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 
               path.join(__dirname, 'dev.db');

console.log(`Database path: ${dbPath}`);
console.log(`Application version: ${currentAppVersion}`);

async function getCurrentDbVersion() {
  try {
    // Check if SchemaVersion table exists
    const tableCheck = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='_SchemaVersion'`
    );
    
    if (!tableCheck || tableCheck.length === 0) {
      console.log('Schema version table does not exist yet');
      return 'none';
    }
    
    // Get the current version
    const versionRecord = await prisma.$queryRawUnsafe(
      `SELECT version FROM _SchemaVersion ORDER BY appliedAt DESC LIMIT 1`
    );
    
    if (!versionRecord || versionRecord.length === 0) {
      console.log('No version records found');
      return 'none';
    }
    
    return versionRecord[0].version;
  } catch (error) {
    console.error('Error getting current DB version:', error);
    return 'none';
  }
}

function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found');
    return [];
  }
  
  // Get all subdirectories in the migrations folder
  const migrationDirs = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  // Get all migration SQL files
  const migrations = [];
  
  for (const dir of migrationDirs) {
    const migrationSqlPath = path.join(migrationsDir, dir, 'migration.sql');
    
    if (fs.existsSync(migrationSqlPath)) {
      // Read the first few lines to extract the version
      const content = fs.readFileSync(migrationSqlPath, 'utf8');
      const versionMatch = content.match(/-- Version: ([0-9a-z.]+)/i);
      
      if (versionMatch) {
        migrations.push({
          dir,
          path: migrationSqlPath,
          version: versionMatch[1],
          description: dir.split('_').slice(1).join('_').replace(/-/g, ' ')
        });
      } else {
        // If no version tag, use dirname with timestamp as description
        migrations.push({
          dir,
          path: migrationSqlPath,
          version: null,  // Will be replaced with app version later
          description: dir.split('_').slice(1).join('_').replace(/-/g, ' ')
        });
      }
    }
  }
  
  return migrations;
}

function compareVersions(v1, v2) {
  // If either version is 'none', handle specially
  if (v1 === 'none') return -1;
  if (v2 === 'none') return 1;
  if (v1 === v2) return 0;
  
  // Parse versions into components
  const parseVersion = (version) => {
    // Extract numeric parts and suffix
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)([a-z]*)$/);
    if (!match) return [0, 0, 0, ''];
    
    const [, major, minor, patch, suffix] = match;
    return [
      parseInt(major, 10),
      parseInt(minor, 10), 
      parseInt(patch, 10),
      suffix || ''
    ];
  };
  
  const [major1, minor1, patch1, suffix1] = parseVersion(v1);
  const [major2, minor2, patch2, suffix2] = parseVersion(v2);
  
  // Compare major, minor, patch
  if (major1 !== major2) return major1 > major2 ? 1 : -1;
  if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1;
  if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1;
  
  // If we get here, compare suffixes lexicographically
  // No suffix is considered "higher" than any suffix
  if (suffix1 === suffix2) return 0;
  if (suffix1 === '') return 1;
  if (suffix2 === '') return -1;
  return suffix1 > suffix2 ? 1 : -1;
}

async function updateSchemaVersion(version, description) {
  try {
    // Escape single quotes in the description to prevent SQL injection
    const safeDescription = description.replace(/'/g, "''");
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_SchemaVersion" (version, description)
      VALUES ('${version}', '${safeDescription}');
    `);
    console.log(`Updated schema version to ${version} (${description})`);
    return true;
  } catch (error) {
    console.error('Error updating schema version:', error);
    return false;
  }
}

async function applyMigrations() {
  try {
    const currentDbVersion = await getCurrentDbVersion();
    console.log(`Current database version: ${currentDbVersion}`);
    
    // Get all available migrations
    const migrations = getMigrationFiles();
    console.log(`Found ${migrations.length} migrations`);
    
    // Set version for migrations without explicit version
    migrations.forEach(migration => {
      if (!migration.version) {
        migration.version = currentAppVersion;
      }
    });
    
    // Filter migrations that need to be applied
    const pendingMigrations = migrations.filter(migration => 
      compareVersions(migration.version, currentDbVersion) > 0
    );
    
    console.log(`Found ${pendingMigrations.length} pending migrations to apply`);
    
    if (pendingMigrations.length === 0) {
      console.log('No migrations to apply');
      
      // If no migrations but version mismatch, update to app version
      if (currentDbVersion !== currentAppVersion) {
        console.log(`Updating schema version from ${currentDbVersion} to ${currentAppVersion}`);
        await updateSchemaVersion(currentAppVersion, 'Automatic version update');
      }
      
      return;
    }
    
    // Sort migrations by version
    pendingMigrations.sort((a, b) => compareVersions(a.version, b.version));
    
    // Apply each migration
    for (const migration of pendingMigrations) {
      console.log(`Applying migration: ${migration.dir} (version ${migration.version})`);
      
      try {
        // Use the sqlite command to apply the migration
        execSync(`sqlite3 "${dbPath}" < "${migration.path}"`, {
          stdio: 'inherit',
        });
        
        console.log(`Successfully applied migration: ${migration.dir}`);
      } catch (error) {
        console.error(`Error applying migration ${migration.dir}:`, error);
        throw error; // Rethrow to stop the process
      }
    }
    
    console.log('All migrations applied successfully');
    
    // Ensure the schema version is updated to match the application version
    if (currentDbVersion !== currentAppVersion) {
      console.log(`Updating schema version to match application: ${currentAppVersion}`);
      await updateSchemaVersion(currentAppVersion, 'Migration complete');
    }
    
    // Final check to see the new version
    const newVersion = await getCurrentDbVersion();
    console.log(`New database version: ${newVersion}`);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migrations
applyMigrations(); 