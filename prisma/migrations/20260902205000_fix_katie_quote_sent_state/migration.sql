-- Katie's quote was sent to the customer but an earlier workflow left it in
-- needs_review with no sent timestamp. Restore the actual customer-facing state
-- without treating the linked planning job as acceptance.
UPDATE "Quote"
SET
  "status" = 'sent',
  "sentAt" = COALESCE("sentAt", "updatedAt"),
  "acceptedAt" = NULL,
  "declinedAt" = NULL,
  "archivedAt" = NULL
WHERE "id" = 2
  AND "acceptedAt" IS NULL;
