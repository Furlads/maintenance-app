-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedMinutes" INTEGER NOT NULL DEFAULT 0;
