-- ImpactFund project pledges — when a project is created, a manager can set
-- how much each member is expected to put toward it. A pledge is a target,
-- not money moved: the member's actual progress still reads off
-- fund_contributions the same way everything else does (filtered to that
-- project_id + member_id). One row per (project, member); re-saving a
-- project's goals deletes and re-inserts rather than tracking history.

DROP TABLE IF EXISTS fund_project_pledges CASCADE;

CREATE TABLE fund_project_pledges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES fund_projects(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES fund_members(id) ON DELETE CASCADE,
  amount     NUMERIC NOT NULL CHECK (amount > 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, member_id)
);

CREATE INDEX idx_fund_project_pledges_agency ON fund_project_pledges(agency_id);
CREATE INDEX idx_fund_project_pledges_project ON fund_project_pledges(project_id);
CREATE INDEX idx_fund_project_pledges_member ON fund_project_pledges(member_id);

ALTER TABLE fund_project_pledges ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_project_pledges_select ON fund_project_pledges FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_project_pledges_write ON fund_project_pledges FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

CREATE TRIGGER update_fund_project_pledges_modtime BEFORE UPDATE ON fund_project_pledges
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE fund_project_pledges REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_project_pledges; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
