-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReportAddendum" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportAddendum_reportId_idx" ON "ReportAddendum"("reportId");

-- AddForeignKey
ALTER TABLE "ReportAddendum" ADD CONSTRAINT "ReportAddendum_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
