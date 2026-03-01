-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "notes" TEXT,
    "notesLog" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "visitDate" TEXT,
    "startTime" TEXT,
    "assignedTo" TEXT NOT NULL,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "overrunMins" INTEGER NOT NULL DEFAULT 0,
    "arrivedAt" TEXT,
    "finishedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT,
    "photoUrl" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
