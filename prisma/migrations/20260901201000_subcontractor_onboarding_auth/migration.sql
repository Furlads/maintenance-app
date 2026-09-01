CREATE TABLE IF NOT EXISTS "SubcontractorOnboardingInvite" (
  "id" SERIAL PRIMARY KEY,
  "workerId" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorOnboardingInvite_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SubcontractorOnboardingInvite_workerId_idx"
  ON "SubcontractorOnboardingInvite" ("workerId", "createdAt");

CREATE TABLE IF NOT EXISTS "SubcontractorPasswordResetRequest" (
  "id" SERIAL PRIMARY KEY,
  "workerId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "token" TEXT UNIQUE,
  "expiresAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "SubcontractorPasswordResetRequest_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SubcontractorPasswordResetRequest_status_requestedAt_idx"
  ON "SubcontractorPasswordResetRequest" ("status", "requestedAt");
