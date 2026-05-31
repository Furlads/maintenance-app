CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workerId" INTEGER,
  "workerName" TEXT,
  "jobId" INTEGER,
  "eventType" TEXT NOT NULL,
  "page" TEXT,
  "details" TEXT,
  "metadataJson" TEXT,
  "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_workerId_createdAt_idx" ON "ActivityLog"("workerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_jobId_createdAt_idx" ON "ActivityLog"("jobId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_eventType_createdAt_idx" ON "ActivityLog"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_page_createdAt_idx" ON "ActivityLog"("page", "createdAt");