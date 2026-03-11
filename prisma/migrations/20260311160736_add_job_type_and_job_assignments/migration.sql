/*
  Warnings:

  - You are about to drop the column `assignedWorkerId` on the `Job` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_assignedWorkerId_fkey";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "assignedWorkerId",
ADD COLUMN     "jobType" TEXT NOT NULL DEFAULT 'Quote';

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "workerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_jobId_workerId_key" ON "JobAssignment"("jobId", "workerId");

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
