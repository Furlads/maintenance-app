/*
  Warnings:

  - You are about to drop the column `companyId` on the `Worker` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Worker" DROP CONSTRAINT "Worker_companyId_fkey";

-- AlterTable
ALTER TABLE "Worker" DROP COLUMN "companyId";

-- CreateTable
CREATE TABLE "WorkerCompany" (
    "id" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "WorkerCompany_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkerCompany" ADD CONSTRAINT "WorkerCompany_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCompany" ADD CONSTRAINT "WorkerCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
