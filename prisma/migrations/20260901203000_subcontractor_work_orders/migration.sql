ALTER TABLE "Worker"
  ADD COLUMN IF NOT EXISTS "tradingName" TEXT,
  ADD COLUMN IF NOT EXISTS "utrNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "publicLiabilityInsurer" TEXT,
  ADD COLUMN IF NOT EXISTS "publicLiabilityPolicyNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "publicLiabilityExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "coverageArea" TEXT,
  ADD COLUMN IF NOT EXISTS "suppliesTools" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "suppliesMaterials" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "SubcontractorWorkOrder" (
  "id" SERIAL PRIMARY KEY,
  "recipientId" INTEGER NOT NULL UNIQUE,
  "opportunityId" INTEGER NOT NULL,
  "jobId" INTEGER,
  "workerId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'accepted',
  "agreedPrice" DOUBLE PRECISION,
  "completionNotes" TEXT,
  "issuesNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "signoffStatus" TEXT NOT NULL DEFAULT 'pending',
  "signerName" TEXT,
  "signerRole" TEXT,
  "signedAt" TIMESTAMP(3),
  "snagNotes" TEXT,
  "officeApprovedByWorkerId" INTEGER,
  "officeApprovedAt" TIMESTAMP(3),
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "paymentApprovedAt" TIMESTAMP(3),
  "paymentApprovedByWorkerId" INTEGER,
  "cisDeductionRate" DOUBLE PRECISION,
  "cisDeductionAmount" DOUBLE PRECISION,
  "netPayable" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorWorkOrder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SubcontractorOpportunityRecipient"("id") ON DELETE CASCADE,
  CONSTRAINT "SubcontractorWorkOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SubcontractorOpportunity"("id") ON DELETE CASCADE,
  CONSTRAINT "SubcontractorWorkOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL,
  CONSTRAINT "SubcontractorWorkOrder_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE,
  CONSTRAINT "SubcontractorWorkOrder_officeApprovedByWorkerId_fkey" FOREIGN KEY ("officeApprovedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL,
  CONSTRAINT "SubcontractorWorkOrder_paymentApprovedByWorkerId_fkey" FOREIGN KEY ("paymentApprovedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "SubcontractorWorkOrder_jobId_idx" ON "SubcontractorWorkOrder"("jobId");
CREATE INDEX IF NOT EXISTS "SubcontractorWorkOrder_workerId_status_idx" ON "SubcontractorWorkOrder"("workerId", "status");
CREATE INDEX IF NOT EXISTS "SubcontractorWorkOrder_paymentStatus_idx" ON "SubcontractorWorkOrder"("paymentStatus");

CREATE TABLE IF NOT EXISTS "SubcontractorVariation" (
  "id" SERIAL PRIMARY KEY,
  "workOrderId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "approvedByWorkerId" INTEGER,
  CONSTRAINT "SubcontractorVariation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "SubcontractorWorkOrder"("id") ON DELETE CASCADE,
  CONSTRAINT "SubcontractorVariation_approvedByWorkerId_fkey" FOREIGN KEY ("approvedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "SubcontractorVariation_workOrderId_idx" ON "SubcontractorVariation"("workOrderId");

CREATE TABLE IF NOT EXISTS "SubcontractorDocument" (
  "id" SERIAL PRIMARY KEY,
  "workerId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentName" TEXT NOT NULL,
  "documentUrl" TEXT,
  "reference" TEXT,
  "expiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorDocument_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubcontractorDocument_workerId_idx" ON "SubcontractorDocument"("workerId");
CREATE INDEX IF NOT EXISTS "SubcontractorDocument_expiresAt_idx" ON "SubcontractorDocument"("expiresAt");
