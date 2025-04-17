/*
  Warnings:

  - You are about to drop the column `error` on the `PrintJob` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `PrintJob` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "queuedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "fileId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "failedAt" DATETIME,
    "rejectedAt" DATETIME,
    "errorMessage" TEXT,
    "notes" TEXT,
    CONSTRAINT "PrintJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PrintJob" ("completedAt", "createdAt", "fileId", "id", "name", "printerId", "startedAt", "status", "updatedAt") SELECT "completedAt", "createdAt", "fileId", "id", "name", "printerId", "startedAt", "status", "updatedAt" FROM "PrintJob";
DROP TABLE "PrintJob";
ALTER TABLE "new_PrintJob" RENAME TO "PrintJob";
CREATE INDEX "PrintJob_status_idx" ON "PrintJob"("status");
CREATE INDEX "PrintJob_submittedByUserId_idx" ON "PrintJob"("submittedByUserId");
CREATE INDEX "PrintJob_printerId_idx" ON "PrintJob"("printerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
