-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "uploadedByWorkerId" INTEGER,
    "label" TEXT,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_uploadedByWorkerId_fkey" FOREIGN KEY ("uploadedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
