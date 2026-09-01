CREATE TABLE IF NOT EXISTS "SubcontractorAgreementAcceptance" (
  "id" SERIAL PRIMARY KEY,
  "workerId" INTEGER NOT NULL,
  "version" TEXT NOT NULL,
  "agreementTitle" TEXT NOT NULL,
  "typedName" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "SubcontractorAgreementAcceptance_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubcontractorAgreementAcceptance_workerId_version_key"
  ON "SubcontractorAgreementAcceptance" ("workerId", "version");
CREATE INDEX IF NOT EXISTS "SubcontractorAgreementAcceptance_workerId_acceptedAt_idx"
  ON "SubcontractorAgreementAcceptance" ("workerId", "acceptedAt");
