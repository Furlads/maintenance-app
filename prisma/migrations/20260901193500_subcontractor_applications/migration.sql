CREATE TABLE IF NOT EXISTS "SubcontractorApplication" (
  "id" SERIAL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "tradingName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "postcode" TEXT,
  "companyNumber" TEXT,
  "vatNumber" TEXT,
  "utrNumber" TEXT,
  "cisRegistered" BOOLEAN NOT NULL DEFAULT FALSE,
  "trades" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "otherTrade" TEXT,
  "yearsExperience" INTEGER,
  "coverageArea" TEXT,
  "maxTravelMiles" INTEGER,
  "canDrive" BOOLEAN NOT NULL DEFAULT TRUE,
  "hasOwnVehicle" BOOLEAN NOT NULL DEFAULT FALSE,
  "suppliesTools" BOOLEAN NOT NULL DEFAULT FALSE,
  "suppliesMaterials" BOOLEAN NOT NULL DEFAULT FALSE,
  "worksForOthers" BOOLEAN NOT NULL DEFAULT FALSE,
  "fixesOwnDefects" BOOLEAN NOT NULL DEFAULT TRUE,
  "comfortableFixedPrice" BOOLEAN NOT NULL DEFAULT TRUE,
  "hasEmployees" BOOLEAN NOT NULL DEFAULT FALSE,
  "publicLiabilityInsurer" TEXT,
  "publicLiabilityPolicyNumber" TEXT,
  "publicLiabilityExpiresAt" TIMESTAMP(3),
  "publicLiabilityCover" TEXT,
  "qualifications" TEXT,
  "availability" TEXT,
  "preferredWork" TEXT,
  "dayRate" DOUBLE PRECISION,
  "referenceOne" TEXT,
  "referenceTwo" TEXT,
  "additionalNotes" TEXT,
  "privacyConsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "declarationAccepted" BOOLEAN NOT NULL DEFAULT FALSE,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByWorkerId" INTEGER,
  "reviewNotes" TEXT,
  "approvedWorkerId" INTEGER
);

CREATE INDEX IF NOT EXISTS "SubcontractorApplication_status_submittedAt_idx"
  ON "SubcontractorApplication" ("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "SubcontractorApplication_email_idx"
  ON "SubcontractorApplication" ("email");
CREATE INDEX IF NOT EXISTS "SubcontractorApplication_phone_idx"
  ON "SubcontractorApplication" ("phone");

CREATE TABLE IF NOT EXISTS "SubcontractorApplicationDocument" (
  "id" SERIAL PRIMARY KEY,
  "applicationId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentName" TEXT NOT NULL,
  "documentUrl" TEXT NOT NULL,
  "pathname" TEXT,
  "contentType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubcontractorApplicationDocument_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "SubcontractorApplication"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubcontractorApplicationDocument_applicationId_idx"
  ON "SubcontractorApplicationDocument" ("applicationId", "createdAt");
