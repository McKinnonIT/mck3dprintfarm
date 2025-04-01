/*
  Warnings:

  - You are about to drop the `PrinterGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `File` table. All the data in the column will be lost.
  - Added the required column `uploadedBy` to the `File` table without a default value. This is not possible if the table is not empty.
  - Made the column `printerId` on table `PrintJob` required. This step will fail if there are existing NULL values in that column.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PrinterGroup";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "groupId" TEXT,
    CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "File_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_File" ("id", "name", "path", "size", "type", "updatedAt") SELECT "id", "name", "path", "size", "type", "updatedAt" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE TABLE "new_PrintJob" (
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
    CONSTRAINT "PrintJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintJob" ("createdAt", "fileId", "id", "name", "printerId", "status", "updatedAt", "userId") SELECT "createdAt", "fileId", "id", "name", "printerId", "status", "updatedAt", "userId" FROM "PrintJob";
DROP TABLE "PrintJob";
ALTER TABLE "new_PrintJob" RENAME TO "PrintJob";
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
