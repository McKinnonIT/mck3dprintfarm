-- Create the schema version tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS "_SchemaVersion" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "version" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT
);

-- Insert initial version if not exists
INSERT INTO "_SchemaVersion" ("version", "description")
SELECT '0.0.3a', 'Initial schema version'
WHERE NOT EXISTS (SELECT 1 FROM "_SchemaVersion" WHERE "version" = '0.0.3a');

-- Function to ensure schema is appropriately upgraded based on version
-- This will be run during container startup to verify database structure 