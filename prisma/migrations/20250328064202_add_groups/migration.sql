-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "operationalStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printStartTime" DATETIME,
    "printTimeElapsed" REAL,
    "printTimeRemaining" REAL,
    "webcamUrl" TEXT,
    "printImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "groupId" TEXT,
    CONSTRAINT "Printer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Printer" ("apiKey", "apiUrl", "createdAt", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printStartTime", "printTimeElapsed", "printTimeRemaining", "status", "type", "updatedAt", "webcamUrl") SELECT "apiKey", "apiUrl", "createdAt", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printStartTime", "printTimeElapsed", "printTimeRemaining", "status", "type", "updatedAt", "webcamUrl" FROM "Printer";
DROP TABLE "Printer";
ALTER TABLE "new_Printer" RENAME TO "Printer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
