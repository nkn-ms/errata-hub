-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Book_publisherId_idx" ON "Book"("publisherId");

-- CreateIndex
CREATE INDEX "PublisherAccess_publisherId_idx" ON "PublisherAccess"("publisherId");

-- CreateIndex
CREATE INDEX "Report_bookId_idx" ON "Report"("bookId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- CreateIndex
CREATE INDEX "ReportImage_reportId_idx" ON "ReportImage"("reportId");

-- CreateIndex
CREATE INDEX "Upvote_profileId_idx" ON "Upvote"("profileId");
