CREATE TABLE "SubcontractorOpportunity" (
  "id" SERIAL NOT NULL,
  "company" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "sourceJobId" INTEGER,
  "title" TEXT NOT NULL,
  "trade" TEXT NOT NULL,
  "roughArea" TEXT NOT NULL,
  "publicDescription" TEXT NOT NULL,
  "durationText" TEXT,
  "timingText" TEXT,
  "pricingMode" TEXT NOT NULL DEFAULT 'price',
  "fixedPrice" DOUBLE PRECISION,
  "quoteGuidance" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdByWorkerId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubcontractorOpportunityRecipient" (
  "id" SERIAL NOT NULL,
  "opportunityId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "viewedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorOpportunityRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubcontractorOpportunityRecipient_token_key" ON "SubcontractorOpportunityRecipient"("token");
CREATE UNIQUE INDEX "SubcontractorOpportunityRecipient_opportunityId_workerId_key" ON "SubcontractorOpportunityRecipient"("opportunityId", "workerId");
CREATE INDEX "SubcontractorOpportunity_status_createdAt_idx" ON "SubcontractorOpportunity"("status", "createdAt");
CREATE INDEX "SubcontractorOpportunityRecipient_workerId_status_idx" ON "SubcontractorOpportunityRecipient"("workerId", "status");
CREATE INDEX "SubcontractorOpportunityRecipient_opportunityId_status_idx" ON "SubcontractorOpportunityRecipient"("opportunityId", "status");

ALTER TABLE "SubcontractorOpportunity" ADD CONSTRAINT "SubcontractorOpportunity_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorOpportunity" ADD CONSTRAINT "SubcontractorOpportunity_createdByWorkerId_fkey" FOREIGN KEY ("createdByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD CONSTRAINT "SubcontractorOpportunityRecipient_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "SubcontractorOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD CONSTRAINT "SubcontractorOpportunityRecipient_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
