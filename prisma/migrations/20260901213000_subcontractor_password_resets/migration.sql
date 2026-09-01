CREATE TABLE IF NOT EXISTS "SubcontractorPasswordResetRequest" (
  "id" SERIAL PRIMARY KEY,
  "workerId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByWorkerId" INTEGER,
  CONSTRAINT "SubcontractorPasswordResetRequest_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubcontractorPasswordResetRequest_status_requestedAt_idx"
  ON "SubcontractorPasswordResetRequest" ("status", "requestedAt");
CREATE INDEX IF NOT EXISTS "SubcontractorPasswordResetRequest_workerId_idx"
  ON "SubcontractorPasswordResetRequest" ("workerId", "requestedAt");
