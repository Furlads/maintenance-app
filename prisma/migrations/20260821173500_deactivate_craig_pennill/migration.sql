-- Craig no longer works for the business. Keep the worker row and historical
-- job/activity references intact, but remove access and active scheduling.
UPDATE "Worker"
SET
  "active" = false,
  "passwordHash" = NULL,
  "pinHash" = NULL,
  "lockedUntil" = NULL,
  "failedLoginAttempts" = 0
WHERE "id" = 7
  AND lower("firstName") = 'craig'
  AND lower("lastName") = 'pennill';

DELETE FROM "WebAuthnCredential"
WHERE "workerId" = 7;
