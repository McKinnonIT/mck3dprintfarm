-- AlterTable
ALTER TABLE "Printer" DROP COLUMN "rtspUrl";
ALTER TABLE "Printer" ADD COLUMN "hlsUrl" TEXT;
ALTER TABLE "Printer" ADD COLUMN "webrtcUrl" TEXT;
ALTER TABLE "Printer" ADD COLUMN "cameraStreamMode" TEXT NOT NULL DEFAULT 'hls';
