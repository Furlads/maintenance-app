-- Max is no longer an active worker. Keep the worker row and historical
-- job/activity references intact, but remove login access and active scheduling.
UPDATE "Worker"
SET
  "active" = false,
  "passwordHash" = NULL,
  "pinHash" = NULL,
  "lockedUntil" = NULL,
  "failedLoginAttempts" = 0
WHERE lower("firstName") = 'max';

DELETE FROM "WebAuthnCredential"
WHERE "workerId" IN (
  SELECT "id"
  FROM "Worker"
  WHERE lower("firstName") = 'max'
);
