/*
  Warnings:

  - You are about to drop the column `postcode` on the `Job` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL DEFAULT 'furlads',
    "customerName" TEXT NOT NULL,
    "overview" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "notesLog" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postcodeFull" TEXT NOT NULL DEFAULT '',
    "postcodeOutward" TEXT NOT NULL DEFAULT '',
    "what3words" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "visitDate" DATETIME,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "assignedTo" TEXT,
    "assignedWorkerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "overrunMins" INTEGER NOT NULL DEFAULT 0,
    "travelMinsHint" INTEGER NOT NULL DEFAULT 15,
    "recurrenceEveryWeeks" INTEGER,
    "recurrenceDurationMins" INTEGER,
    "recurrencePreferredDOW" INTEGER,
    "recurrencePreferredTime" TEXT,
    "recurrenceActive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Job_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("address", "assignedWorkerId", "company", "createdAt", "customerName", "durationMins", "fixed", "id", "notes", "notesLog", "overrunMins", "overview", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "travelMinsHint", "updatedAt", "visitDate", "what3words") SELECT "address", "assignedWorkerId", "company", "createdAt", "customerName", "durationMins", "fixed", "id", coalesce("notes", '') AS "notes", "notesLog", "overrunMins", "overview", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "travelMinsHint", "updatedAt", "visitDate", coalesce("what3words", '') AS "what3words" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_company_status_idx" ON "Job"("company", "status");
CREATE INDEX "Job_company_assignedTo_idx" ON "Job"("company", "assignedTo");
CREATE INDEX "Job_company_postcodeOutward_idx" ON "Job"("company", "postcodeOutward");
CREATE INDEX "Job_company_visitDate_idx" ON "Job"("company", "visitDate");
CREATE TABLE "new_Worker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Worker',
    "jobTitle" TEXT,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "schedulable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Worker" ("active", "company", "createdAt", "id", "jobTitle", "key", "name", "photoUrl", "role", "updatedAt") SELECT "active", "company", "createdAt", "id", "jobTitle", "key", "name", "photoUrl", "role", "updatedAt" FROM "Worker";
DROP TABLE "Worker";
ALTER TABLE "new_Worker" RENAME TO "Worker";
CREATE INDEX "Worker_company_active_idx" ON "Worker"("company", "active");
CREATE INDEX "Worker_company_schedulable_idx" ON "Worker"("company", "schedulable");
CREATE UNIQUE INDEX "Worker_company_key_key" ON "Worker"("company", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
