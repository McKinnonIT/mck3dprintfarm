#!/usr/bin/env node

/**
 * Create Migration Script for 3D Print Farm
 * 
 * This script creates a timestamped migration file for database updates.
 * 
 * Usage:
 *   node scripts/create-migration.js "Add new feature XYZ"
 * 
 * This will create a timestamped migration file in the prisma/migrations directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const packageJson = require('../package.json');

// Get the migration description from command line arguments
const migrationDescription = process.argv[2];

if (!migrationDescription) {
  console.error('Please provide a migration description.');
  console.error('Usage: node scripts/create-migration.js "Add new feature XYZ"');
  process.exit(1);
}

// Create migrations directory if it doesn't exist
const migrationsDir = path.join(__dirname, '../prisma/migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Create a timestamp-based directory name
const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
const dirName = `${timestamp}_${migrationDescription.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
const migrationDir = path.join(migrationsDir, dirName);

// Create the migration directory
fs.mkdirSync(migrationDir);

// Get the current version from package.json
const currentVersion = packageJson.version;

// Create the migration SQL file
const migrationSql = `-- Version: ${currentVersion}
-- Migration: ${migrationDescription}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL statements here
-- Example:
-- ALTER TABLE "MyTable" ADD COLUMN "new_column" TEXT;

-- This migration will automatically update the _SchemaVersion table
-- No need to manually insert a version record
`;

fs.writeFileSync(path.join(migrationDir, 'migration.sql'), migrationSql);

// Create a README file with instructions
const readmeContent = `# Migration: ${migrationDescription}

This migration was created on ${new Date().toISOString()}.

## How to use

1. Add your SQL statements to the migration.sql file
2. Test the migration locally
3. When ready, commit the migration to the repository

## Running manually

To run this migration manually, you can use:

\`\`\`bash
sqlite3 prisma/dev.db < prisma/migrations/${dirName}/migration.sql
\`\`\`

## Automatic version updating

The system will automatically update the schema version to match the package.json version (${currentVersion})
after applying migrations. You don't need to manually add version records anymore.
`;

fs.writeFileSync(path.join(migrationDir, 'README.md'), readmeContent);

console.log(`Migration created at: ${migrationDir}`);
console.log(`Please add your SQL statements to: ${path.join(migrationDir, 'migration.sql')}`);
console.log(`The version ${currentVersion} will be automatically applied when this migration runs.`);
console.log('');
console.log('Remember to update package.json version if this is a major schema change!'); 