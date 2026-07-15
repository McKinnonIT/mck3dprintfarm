-- AlterTable
ALTER TABLE "Printer" ADD COLUMN "cameraPathName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Printer_cameraPathName_key" ON "Printer"("cameraPathName");
