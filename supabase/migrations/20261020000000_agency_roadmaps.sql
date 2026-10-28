-- Agency-wide forward roadmap: a target revenue for the year ahead, plus
-- objectives broken into one or more key results, each with a target per
-- quarter. Replaces the old "Our {year} Objective" display on the Home
-- dashboard. Editable by managers/superadmins of the agency (same policy
-- shape as agency_strategy); visible to every agency member.
CREATE TABLE IF NOT EXISTS agency_roadmaps (
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  target_revenue  NUMERIC,
  objectives      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- objectives: [{ text, keyResults: [{ text, targets: {Q1,Q2,Q3,Q4} }] }]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agency_id, year)
);

ALTER TABLE agency_roadmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_roadmaps_select ON agency_roadmaps;
CREATE POLICY agency_roadmaps_select ON agency_roadmaps
  FOR SELECT USING (is_agency_member(agency_id));

DROP POLICY IF EXISTS agency_roadmaps_write ON agency_roadmaps;
CREATE POLICY agency_roadmaps_write ON agency_roadmaps
  FOR ALL USING (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  ) WITH CHECK (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  );
