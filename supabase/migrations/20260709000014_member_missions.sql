-- Per-member mission & accountability data (Team Mission Board + My Mission).
-- One row per (agency, member). A member edits their own; managers/superadmins
-- edit anyone's in the agency. Everyone in the agency can view the board.
CREATE TABLE IF NOT EXISTS member_missions (
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department        TEXT,
  mission           TEXT,
  priorities        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- monthly priorities  ["Build content strategy", …]
  outcomes          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- expected outcomes    ["Generate 50 qualified conversations", …]
  weekly_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["…"]
  kpis              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ label, target, current, unit }]
  tasks             JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ text, done }]
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agency_id, user_id)
);

ALTER TABLE member_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_missions_select ON member_missions;
CREATE POLICY member_missions_select ON member_missions
  FOR SELECT USING (is_agency_member(agency_id));

DROP POLICY IF EXISTS member_missions_write ON member_missions;
CREATE POLICY member_missions_write ON member_missions
  FOR ALL USING (
    (user_id = auth.uid() AND is_agency_member(agency_id))
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  ) WITH CHECK (
    (user_id = auth.uid() AND is_agency_member(agency_id))
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  );
