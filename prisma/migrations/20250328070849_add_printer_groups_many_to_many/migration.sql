/*
  Warnings:

  - You are about to drop the column `groupId` on the `Printer` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "PrinterGroup" (
    "printerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    PRIMARY KEY ("printerId", "groupId"),
    CONSTRAINT "PrinterGroup_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrinterGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Printer" ("apiKey", "apiUrl", "createdAt", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printStartTime", "printTimeElapsed", "printTimeRemaining", "status", "type", "updatedAt", "webcamUrl") SELECT "apiKey", "apiUrl", "createdAt", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printStartTime", "printTimeElapsed", "printTimeRemaining", "status", "type", "updatedAt", "webcamUrl" FROM "Printer";
DROP TABLE "Printer";
ALTER TABLE "new_Printer" RENAME TO "Printer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
