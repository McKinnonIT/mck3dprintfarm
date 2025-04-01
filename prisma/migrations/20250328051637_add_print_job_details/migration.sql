-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN "currentLayer" INTEGER;
ALTER TABLE "PrintJob" ADD COLUMN "estimatedEndTime" DATETIME;
ALTER TABLE "PrintJob" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "PrintJob" ADD COLUMN "progress" REAL DEFAULT 0;
ALTER TABLE "PrintJob" ADD COLUMN "startTime" DATETIME;
ALTER TABLE "PrintJob" ADD COLUMN "totalLayers" INTEGER;
