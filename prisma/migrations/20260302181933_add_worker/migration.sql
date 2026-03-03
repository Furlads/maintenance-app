/*
  Warnings:

  - You are about to drop the `ChasMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `checkedInAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `checkedOutAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `what3words` on the `Job` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChasMessage";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Worker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Worker',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "notesLog" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "visitDate" DATETIME,
    "assignedTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postcode" TEXT NOT NULL DEFAULT '',
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "overrunMins" INTEGER NOT NULL DEFAULT 0,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "travelMinsHint" INTEGER NOT NULL DEFAULT 15,
    "recurrenceEveryWeeks" INTEGER,
    "recurrenceDurationMins" INTEGER,
    "recurrencePreferredDOW" INTEGER,
    "recurrencePreferredTime" TEXT,
    "recurrenceActive" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Job" ("address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "overrunMins", "postcode", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "title", "travelMinsHint", "visitDate") SELECT "address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "overrunMins", "postcode", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "title", "travelMinsHint", "visitDate" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_company_key_key" ON "Worker"("company", "key");
