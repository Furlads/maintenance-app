/*
  Warnings:

  - You are about to drop the column `assignedWorkerId` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `hardToFind` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `overview` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrls` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `postcodeFull` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `what3words` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `what3wordsLink` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrl` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `schedulable` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Worker` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Business" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Furlads',
    "dayStart" TEXT NOT NULL DEFAULT '08:00',
    "dayEnd" TEXT NOT NULL DEFAULT '17:00',
    "prepMins" INTEGER NOT NULL DEFAULT 30,
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
INSERT INTO "new_Job" ("address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "postcode", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "title", "visitDate") SELECT "address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "postcode", "recurrenceActive", "recurrenceDurationMins", "recurrenceEveryWeeks", "recurrencePreferredDOW", "recurrencePreferredTime", "startTime", "status", "title", "visitDate" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE TABLE "new_Worker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Worker" ("active", "id", "key") SELECT "active", "id", "key" FROM "Worker";
DROP TABLE "Worker";
ALTER TABLE "new_Worker" RENAME TO "Worker";
CREATE UNIQUE INDEX "Worker_key_key" ON "Worker"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
