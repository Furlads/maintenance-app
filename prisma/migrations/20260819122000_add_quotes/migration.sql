CREATE TABLE "Quote" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "jobId" INTEGER,
    "conversationId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerPostcode" TEXT,
    "scope" TEXT NOT NULL,
    "customerMessage" TEXT,
    "internalNotes" TEXT,
    "quoteWorking" TEXT,
    "priceExVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIncVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedDays" DOUBLE PRECISION,
    "estimatedTeamSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quote_status_createdAt_idx" ON "Quote"("status", "createdAt");
CREATE INDEX "Quote_customerId_createdAt_idx" ON "Quote"("customerId", "createdAt");
CREATE INDEX "Quote_jobId_idx" ON "Quote"("jobId");
CREATE INDEX "Quote_conversationId_idx" ON "Quote"("conversationId");
CREATE INDEX "Quote_archivedAt_idx" ON "Quote"("archivedAt");

ALTER TABLE "Quote"
ADD CONSTRAINT "Quote_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
ADD CONSTRAINT "Quote_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
ADD CONSTRAINT "Quote_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
