-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Worker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Worker',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "landingPath" TEXT NOT NULL DEFAULT '/today',
    "schedulable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Worker" ("active", "company", "createdAt", "id", "key", "name", "photoUrl", "role", "updatedAt") SELECT "active", "company", "createdAt", "id", "key", "name", "photoUrl", "role", "updatedAt" FROM "Worker";
DROP TABLE "Worker";
ALTER TABLE "new_Worker" RENAME TO "Worker";
CREATE UNIQUE INDEX "Worker_company_key_key" ON "Worker"("company", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
