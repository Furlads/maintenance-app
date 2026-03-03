-- Add columns for business + role (safe defaults)
ALTER TABLE "Job" ADD COLUMN "business" TEXT NOT NULL DEFAULT 'furlads';
ALTER TABLE "Job" ADD COLUMN "role"     TEXT NOT NULL DEFAULT 'maintenance';