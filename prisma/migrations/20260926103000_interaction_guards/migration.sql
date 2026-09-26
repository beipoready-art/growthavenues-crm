-- Each interaction belongs to exactly one lead or one client.
ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_exactly_one_parent"
  CHECK ((("leadId" IS NOT NULL)::int + ("clientId" IS NOT NULL)::int) = 1);

-- The interaction log is a permanent compliance record: block row deletes at
-- the database level (the app only ever soft-deletes). TRUNCATE, used by the
-- dev seed script, is unaffected.
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are permanent and cannot be deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Interaction_no_delete" BEFORE DELETE ON "Interaction"
  FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE TRIGGER "InteractionRevision_no_delete" BEFORE DELETE ON "InteractionRevision"
  FOR EACH ROW EXECUTE FUNCTION forbid_delete();
