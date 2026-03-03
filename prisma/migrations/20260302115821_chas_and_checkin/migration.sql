/*
  Warnings:

  - You are about to drop the `Worker` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `Job` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `arrivedAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `finishedAt` on the `Job` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Job` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `visitDate` on the `Job` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Worker";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ChasMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company" TEXT NOT NULL,
    "worker" TEXT NOT NULL,
    "jobId" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "imageDataUrl" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ChasMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "company" TEXT NOT NULL DEFAULT 'furlads',
    "what3words" TEXT NOT NULL DEFAULT '',
    "checkedInAt" DATETIME,
    "checkedOutAt" DATETIME,
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
INSERT INTO "new_Job" ("address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", "notesLog", "overrunMins", "postcode", "startTime", "status", "title", "visitDate") SELECT "address", "assignedTo", "createdAt", "durationMins", "fixed", "id", "notes", coalesce("notesLog", '') AS "notesLog", "overrunMins", "postcode", "startTime", "status", "title", "visitDate" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
