-- Strategic content per agency: vision, mission, purpose, objectives, banner.
-- Powers the "mission control" homepage. Editable by managers/superadmins of the
-- agency; visible to every agency member (primary or admin-granted).
CREATE TABLE IF NOT EXISTS agency_strategy (
  agency_id       UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  purpose         TEXT,
  lead_name       TEXT,
  stage           TEXT,                                  -- Growing | Scaling | Optimizing | Launching …
  vision          TEXT,
  mission         TEXT,
  objectives      JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ["Acquire 100 clients", …]
  objectives_year TEXT,                                  -- e.g. "2026"
  banner          TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agency_strategy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_strategy_select ON agency_strategy;
CREATE POLICY agency_strategy_select ON agency_strategy
  FOR SELECT USING (is_agency_member(agency_id));

DROP POLICY IF EXISTS agency_strategy_write ON agency_strategy;
CREATE POLICY agency_strategy_write ON agency_strategy
  FOR ALL USING (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  ) WITH CHECK (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  );
