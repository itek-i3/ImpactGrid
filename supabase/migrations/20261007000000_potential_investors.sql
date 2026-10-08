-- ACR's potential-investor pipeline: a simple CRM-style roster of investors
-- being courted for the businesses ACR manages. Same agency-scoping and
-- access pattern as `businesses` / `toig_business_registry`.
CREATE TABLE IF NOT EXISTS potential_investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  investor_type   TEXT,                 -- VC, PE, Angel, DFI, Family Office, Bank, Grant, Other
  sector          TEXT,                 -- investing focus, e.g. "SMEs", "Agriculture"
  stage_focus     TEXT,                 -- Seed, Early-stage, Growth, Mature, Any
  ticket_min      NUMERIC,
  ticket_max      NUMERIC,
  ticket_currency TEXT NOT NULL DEFAULT 'USD',
  geography       TEXT,
  status          TEXT NOT NULL DEFAULT 'prospect', -- prospect, contacted, in_talks, committed, invested, passed
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_potential_investors_agency ON potential_investors(agency_id, created_at);

ALTER TABLE potential_investors ENABLE ROW LEVEL SECURITY;

-- Same access as businesses/valuation: managers + superadmins of the agency.
DROP POLICY IF EXISTS potential_investors_select ON potential_investors;
CREATE POLICY potential_investors_select ON potential_investors FOR SELECT USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS potential_investors_insert ON potential_investors;
CREATE POLICY potential_investors_insert ON potential_investors FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS potential_investors_update ON potential_investors;
CREATE POLICY potential_investors_update ON potential_investors FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS potential_investors_delete ON potential_investors;
CREATE POLICY potential_investors_delete ON potential_investors FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP TRIGGER IF EXISTS update_potential_investors_modtime ON potential_investors;
CREATE TRIGGER update_potential_investors_modtime BEFORE UPDATE ON potential_investors
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE potential_investors REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE potential_investors;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
