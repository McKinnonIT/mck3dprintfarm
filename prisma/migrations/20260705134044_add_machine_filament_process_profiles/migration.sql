-- CreateTable
CREATE TABLE "MachineProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "machineJson" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachineProfile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FilamentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filamentJson" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FilamentProfile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processJson" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessPreset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SliceJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sourceFileId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "machineProfileId" TEXT,
    "filamentProfileId" TEXT,
    "processPresetId" TEXT,
    "customOverridesJson" TEXT,
    "resultFileId" TEXT,
    "submittedByUserId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "SliceJob_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_filamentProfileId_fkey" FOREIGN KEY ("filamentProfileId") REFERENCES "FilamentProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_processPresetId_fkey" FOREIGN KEY ("processPresetId") REFERENCES "ProcessPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_resultFileId_fkey" FOREIGN KEY ("resultFileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SliceJob_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "currentJobFilename" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "groupId" TEXT,
    "machineProfileId" TEXT,
    CONSTRAINT "Printer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Printer_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Printer" ("apiKey", "apiUrl", "bedTemp", "createdAt", "currentJobFilename", "groupId", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printJobName", "printStartTime", "printTimeElapsed", "printTimeRemaining", "serialNumber", "status", "toolTemp", "type", "updatedAt", "webcamUrl") SELECT "apiKey", "apiUrl", "bedTemp", "createdAt", "currentJobFilename", "groupId", "id", "lastSeen", "name", "operationalStatus", "printImageUrl", "printJobName", "printStartTime", "printTimeElapsed", "printTimeRemaining", "serialNumber", "status", "toolTemp", "type", "updatedAt", "webcamUrl" FROM "Printer";
DROP TABLE "Printer";
ALTER TABLE "new_Printer" RENAME TO "Printer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MachineProfile_name_key" ON "MachineProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FilamentProfile_name_key" ON "FilamentProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessPreset_name_key" ON "ProcessPreset"("name");

-- CreateIndex
CREATE INDEX "SliceJob_status_idx" ON "SliceJob"("status");

-- CreateIndex
CREATE INDEX "SliceJob_sourceFileId_idx" ON "SliceJob"("sourceFileId");

-- CreateIndex
CREATE INDEX "SliceJob_printerId_idx" ON "SliceJob"("printerId");
