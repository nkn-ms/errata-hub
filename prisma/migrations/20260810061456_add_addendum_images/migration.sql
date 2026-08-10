-- AlterTable
ALTER TABLE "ReportImage" ADD COLUMN     "addendumId" TEXT;

-- CreateIndex
CREATE INDEX "ReportImage_addendumId_idx" ON "ReportImage"("addendumId");

-- AddForeignKey
ALTER TABLE "ReportImage" ADD CONSTRAINT "ReportImage_addendumId_fkey" FOREIGN KEY ("addendumId") REFERENCES "ReportAddendum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
