CREATE OR REPLACE FUNCTION "enforce_subcontractor_work_acceptance"()
RETURNS TRIGGER AS $$
DECLARE
  requires_acceptance BOOLEAN := FALSE;
  has_acceptance BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE("workAcceptanceRequired", FALSE)
  INTO requires_acceptance
  FROM "Worker"
  WHERE "id" = NEW."workerId";

  IF requires_acceptance THEN
    SELECT EXISTS (
      SELECT 1
      FROM "SubcontractorOpportunity" o
      JOIN "SubcontractorOpportunityRecipient" r
        ON r."opportunityId" = o."id"
      WHERE o."sourceJobId" = NEW."jobId"
        AND r."workerId" = NEW."workerId"
        AND r."status" = 'accepted'
    )
    INTO has_acceptance;

    IF NOT has_acceptance THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "job_assignment_requires_subcontractor_acceptance" ON "JobAssignment";

CREATE TRIGGER "job_assignment_requires_subcontractor_acceptance"
BEFORE INSERT ON "JobAssignment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_subcontractor_work_acceptance"();
