/*
  Warnings:

  - You are about to drop the column `currentLayer` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedEndTime` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `progress` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `totalLayers` on the `PrintJob` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Printer" ADD COLUMN "printImageUrl" TEXT;
ALTER TABLE "Printer" ADD COLUMN "printStartTime" DATETIME;
ALTER TABLE "Printer" ADD COLUMN "printTimeElapsed" REAL;
ALTER TABLE "Printer" ADD COLUMN "printTimeRemaining" REAL;
ALTER TABLE "Printer" ADD COLUMN "webcamUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileId" TEXT NOT NULL,
    "printerId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrintJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintJob" ("createdAt", "fileId", "id", "name", "printerId", "status", "updatedAt", "userId") SELECT "createdAt", "fileId", "id", "name", "printerId", "status", "updatedAt", "userId" FROM "PrintJob";
DROP TABLE "PrintJob";
ALTER TABLE "new_PrintJob" RENAME TO "PrintJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
