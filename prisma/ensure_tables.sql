-- Ensure all tables exist for the 3D Print Farm application

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Group table
CREATE TABLE IF NOT EXISTS "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Printer table
CREATE TABLE IF NOT EXISTS "Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "operationalStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printStartTime" DATETIME,
    "printTimeElapsed" REAL,
    "printTimeRemaining" REAL,
    "webcamUrl" TEXT,
    "printImageUrl" TEXT,
    "printJobName" TEXT,
    "bedTemp" REAL,
    "toolTemp" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "groupId" TEXT,
    FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- File table
CREATE TABLE IF NOT EXISTS "File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "previewUrl" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "groupId" TEXT,
    FOREIGN KEY ("uploadedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- PrintJob table
CREATE TABLE IF NOT EXISTS "PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fileId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "error" TEXT,
    FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Setting table
CREATE TABLE IF NOT EXISTS "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Ensure the unique constraint exists for settings
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_key" ON "Setting"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Only insert default settings if the Setting table is empty
INSERT OR IGNORE INTO "Setting" ("id", "key", "value", "createdAt", "updatedAt") 
SELECT '1', 'printFarmTitle', 'MCK 3D Print Farm', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM "Setting" WHERE key = 'printFarmTitle');

INSERT OR IGNORE INTO "Setting" ("id", "key", "value", "createdAt", "updatedAt") 
SELECT '2', 'organizationName', 'McKelvey Engineering', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM "Setting" WHERE key = 'organizationName');

INSERT OR IGNORE INTO "Setting" ("id", "key", "value", "createdAt", "updatedAt") 
SELECT '3', 'organizationWebsite', 'https://engineering.wustl.edu/', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM "Setting" WHERE key = 'organizationWebsite'); 