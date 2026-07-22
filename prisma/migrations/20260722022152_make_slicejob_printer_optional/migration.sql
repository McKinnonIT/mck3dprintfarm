-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SliceJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sourceFileId" TEXT NOT NULL,
    "printerId" TEXT,
    "machineProfileId" TEXT,
    "filamentProfileId" TEXT,
    "slicingProfileId" TEXT,
    "customOverridesJson" TEXT,
    "resultFileId" TEXT,
    "submittedByUserId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "SliceJob_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_filamentProfileId_fkey" FOREIGN KEY ("filamentProfileId") REFERENCES "FilamentProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_slicingProfileId_fkey" FOREIGN KEY ("slicingProfileId") REFERENCES "SlicingProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_resultFileId_fkey" FOREIGN KEY ("resultFileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SliceJob" ("completedAt", "createdAt", "customOverridesJson", "errorMessage", "filamentProfileId", "id", "machineProfileId", "printerId", "resultFileId", "slicingProfileId", "sourceFileId", "startedAt", "status", "submittedByUserId", "updatedAt") SELECT "completedAt", "createdAt", "customOverridesJson", "errorMessage", "filamentProfileId", "id", "machineProfileId", "printerId", "resultFileId", "slicingProfileId", "sourceFileId", "startedAt", "status", "submittedByUserId", "updatedAt" FROM "SliceJob";
DROP TABLE "SliceJob";
ALTER TABLE "new_SliceJob" RENAME TO "SliceJob";
CREATE INDEX "SliceJob_status_idx" ON "SliceJob"("status");
CREATE INDEX "SliceJob_sourceFileId_idx" ON "SliceJob"("sourceFileId");
CREATE INDEX "SliceJob_printerId_idx" ON "SliceJob"("printerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
