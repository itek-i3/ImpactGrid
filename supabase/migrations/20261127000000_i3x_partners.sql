-- i3x Africa's partner & sponsor roster: a flat, agency-scoped CRM table for
-- organisations i3x is partnering or sponsoring with, tracked the same way
-- ACR tracks its potential investors (see potential_investors) rather than
-- the JSONB profile shape used by toig_business_registry — every field here
-- is a single flat value, no multi-section wizard needed.
CREATE TABLE IF NOT EXISTS i3x_partners (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id          UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,       -- organization name
  org_type           TEXT,                -- Corporate, NGO, Government, Foundation, Academic, Media, Startup, Other
  website            TEXT,
  contact_name       TEXT,                -- contact person
  contact_email      TEXT,
  linkedin           TEXT,
  contact_phone      TEXT,                -- mobile phone
  industry           TEXT,
  location           TEXT,
  category           TEXT,                -- partnership category: Strategic Partner, Event Sponsor, Media Partner, Community Partner, Vendor / Supplier, Other
  priority           TEXT,                -- High, Medium, Low
  relationship_owner TEXT,                -- who internally owns this relationship
  status             TEXT NOT NULL DEFAULT 'prospective', -- relationship status: prospective, in_discussion, active, on_hold, lapsed, ended
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_i3x_partners_agency ON i3x_partners(agency_id, created_at);

ALTER TABLE i3x_partners ENABLE ROW LEVEL SECURITY;

-- Same access as potential_investors/toig_business_registry: managers + superadmins of the agency.
DROP POLICY IF EXISTS i3x_partners_select ON i3x_partners;
CREATE POLICY i3x_partners_select ON i3x_partners FOR SELECT USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS i3x_partners_insert ON i3x_partners;
CREATE POLICY i3x_partners_insert ON i3x_partners FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS i3x_partners_update ON i3x_partners;
CREATE POLICY i3x_partners_update ON i3x_partners FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS i3x_partners_delete ON i3x_partners;
CREATE POLICY i3x_partners_delete ON i3x_partners FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP TRIGGER IF EXISTS update_i3x_partners_modtime ON i3x_partners;
CREATE TRIGGER update_i3x_partners_modtime BEFORE UPDATE ON i3x_partners
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE i3x_partners REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE i3x_partners;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
