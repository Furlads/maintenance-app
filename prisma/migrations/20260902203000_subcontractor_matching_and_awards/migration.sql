-- Structured subcontractor matching, pricing and availability
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "workSetup" TEXT NOT NULL DEFAULT 'just_me';
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "teamSize" INTEGER;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "teamDayRate" DOUBLE PRECISION;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "teamDescription" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "unavailableUntil" TIMESTAMP(3);
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "minimumCharge" DOUBLE PRECISION;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "halfDayRate" DOUBLE PRECISION;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "pricingPreference" TEXT NOT NULL DEFAULT 'either';
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vatRegistered" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "doNotUse" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "doNotUseReason" TEXT;

-- Application fields kept structured instead of burying them in notes
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "workSetup" TEXT NOT NULL DEFAULT 'just_me';
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "teamSize" INTEGER;
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "teamDayRate" DOUBLE PRECISION;
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "teamDescription" TEXT;
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "minimumCharge" DOUBLE PRECISION;
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "halfDayRate" DOUBLE PRECISION;
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "pricingPreference" TEXT NOT NULL DEFAULT 'either';
ALTER TABLE "SubcontractorApplication" ADD COLUMN IF NOT EXISTS "vatRegistered" BOOLEAN NOT NULL DEFAULT FALSE;

-- Opportunity commercial/site detail and reply deadline
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "replyBy" TIMESTAMP(3);
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "priceIncludesVat" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "workBasis" TEXT NOT NULL DEFAULT 'labour_only';
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "materialsResponsibility" TEXT;
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "plantResponsibility" TEXT;
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "wasteResponsibility" TEXT;
ALTER TABLE "SubcontractorOpportunity" ADD COLUMN IF NOT EXISTS "siteNotes" TEXT;

-- Response, counter-offer and award workflow
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "counterOffer" DOUBLE PRECISION;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "counterOfferNotes" TEXT;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "declineReason" TEXT;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "proposedCrewSize" INTEGER;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "attendeeNotes" TEXT;
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "awardedAt" TIMESTAMP(3);
ALTER TABLE "SubcontractorOpportunityRecipient" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SubcontractorOpportunity_replyBy_idx" ON "SubcontractorOpportunity"("replyBy");
CREATE INDEX IF NOT EXISTS "SubcontractorOpportunityRecipient_status_awardedAt_idx" ON "SubcontractorOpportunityRecipient"("status", "awardedAt");
