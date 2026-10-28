-- A project idea a manager is pitching but hasn't started raising for yet
-- — not "active" (nobody should be expected to contribute to it) and not
-- "completed". Adds a third status alongside the original two.
ALTER TABLE fund_projects DROP CONSTRAINT fund_projects_status_check;
ALTER TABLE fund_projects ADD CONSTRAINT fund_projects_status_check
  CHECK (status IN ('prospect', 'active', 'completed'));
