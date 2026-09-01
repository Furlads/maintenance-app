-- Additive worker profile fields. Existing workers remain employees with their
-- current jobs, assignments and calendar history unchanged.
ALTER TABLE "Worker"
  ADD COLUMN "employmentType" TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN "dayRate" DOUBLE PRECISION,
  ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "transportNotes" TEXT,
  ADD COLUMN "canDrive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "transportRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canUseCompanyTools" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canUseCompanyVehicle" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cisRegistered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cisVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cisVerificationNumber" TEXT,
  ADD COLUMN "cisDeductionRate" DOUBLE PRECISION,
  ADD COLUMN "workAcceptanceRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Crew" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dayRate" DOUBLE PRECISION NOT NULL,
  "durationMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "skillLevel" TEXT NOT NULL DEFAULT 'standard',
  "suitableJobTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "technicalSpecialist" BOOLEAN NOT NULL DEFAULT false,
  "summary" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrewMember" (
  "id" SERIAL NOT NULL,
  "crewId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Crew_slug_key" ON "Crew"("slug");
CREATE INDEX "Crew_active_name_idx" ON "Crew"("active", "name");
CREATE UNIQUE INDEX "CrewMember_crewId_workerId_key" ON "CrewMember"("crewId", "workerId");
CREATE INDEX "CrewMember_workerId_idx" ON "CrewMember"("workerId");

ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_crewId_fkey"
  FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Worker"
SET
  "employmentType" = 'subcontractor',
  "dayRate" = 150,
  "skills" = ARRAY['landscaping', 'groundworks', 'fencing'],
  "workAcceptanceRequired" = true
WHERE lower("firstName") IN ('steve', 'stephen', 'codie');

UPDATE "Worker"
SET
  "canDrive" = false,
  "transportRequired" = true,
  "transportNotes" = 'Non-driver — transport must be arranged.'
WHERE lower("firstName") = 'codie';

INSERT INTO "Crew" (
  "slug", "name", "dayRate", "durationMultiplier", "skillLevel",
  "suitableJobTypes", "technicalSpecialist", "summary"
)
VALUES
  (
    'steve-codie', 'Steve + Codie', 300, 0.67, 'experienced',
    ARRAY['landscaping', 'groundworks', 'fencing'], false,
    'Generally faster for standard landscaping, groundworks and fencing. Codie requires arranged transport.'
  ),
  (
    'luke-labourer', 'Luke + labourer', 250, 1, 'higher-skilled / qualified',
    ARRAY['technical', 'specialist', 'finish-critical'], true,
    'Generally slower, but the higher-skilled option for technical or finish-critical work.'
  );

INSERT INTO "CrewMember" ("crewId", "workerId")
SELECT crew."id", worker."id"
FROM "Crew" crew
JOIN "Worker" worker ON lower(worker."firstName") IN ('steve', 'stephen', 'codie')
WHERE crew."slug" = 'steve-codie';

INSERT INTO "CrewMember" ("crewId", "workerId")
SELECT crew."id", worker."id"
FROM "Crew" crew
JOIN "Worker" worker ON lower(worker."firstName") = 'luke'
WHERE crew."slug" = 'luke-labourer';

INSERT INTO "CrewMember" ("crewId", "workerId")
SELECT crew."id", worker."id"
FROM "Crew" crew
JOIN "Worker" worker ON (
  lower(worker."firstName") IN ('oli', 'oliver')
  OR lower(COALESCE(worker."jobTitle", '')) LIKE '%labourer%'
)
WHERE crew."slug" = 'luke-labourer'
  AND NOT EXISTS (
    SELECT 1 FROM "CrewMember" existing
    WHERE existing."crewId" = crew."id" AND existing."workerId" = worker."id"
  );
