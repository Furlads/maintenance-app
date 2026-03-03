/*
  Warnings:

  - You are about to drop the column `customerName` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `lat` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `overrunMins` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `postcodeOutward` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `travelMinsHint` on the `Job` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL DEFAULT 'furlads',
    "title" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postcodeFull" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "overview" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "notesLog" TEXT NOT NULL DEFAULT '',
    "hardToFind" BOOLEAN NOT NULL DEFAULT false,
    "what3wordsLink" TEXT NOT NULL DEFAULT '',
    "photoUrls" JSONB NOT NULL DEFAULT [],
    "what3words" TEXT NOT NULL DEFAULT '',
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "visitDate" DATETIME,
    "startTime" TEXT,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "assignedTo" TEXT,
    "assignedWorkerId" INTEGER,
    "recurrenceEveryWeeks" INTEGER,
    "recurrenceDurationMins" INTEGER,
    "recurrencePreferredDOW" INTEGER,
    "recurrencePreferredTime" TEXT,
    "recurrenceActive" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("address", "assignedTo", "assignedWorkerId", "company", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "overview", "postcodeFull", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "updatedAt", "visitDate", "what3words") SELECT "address", "assignedTo", "assignedWorkerId", "company", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "overview", "postcodeFull", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "updatedAt", "visitDate", "what3words" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_company_status_idx" ON "Job"("company", "status");
CREATE INDEX "Job_company_assignedTo_idx" ON "Job"("company", "assignedTo");
CREATE INDEX "Job_company_postcode_idx" ON "Job"("company", "postcode");
CREATE INDEX "Job_company_visitDate_idx" ON "Job"("company", "visitDate");
CREATE INDEX "Job_company_assignedWorkerId_idx" ON "Job"("company", "assignedWorkerId");
CREATE INDEX "Job_company_deletedAt_idx" ON "Job"("company", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
