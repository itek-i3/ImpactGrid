-- TOIG Business Intelligence & Growth Profile — a standalone registry of the
-- businesses TOIG works with. Deliberately separate from `businesses` (ACR's
-- own day-to-day managed businesses used by Daily Finance / Valuation /
-- Acquisition) — this is TOIG's own roster of businesses it is profiling for
-- growth support, which may or may not overlap with ACR's list.
--
-- Name/industry/location are plain columns (fast listing); everything else —
-- identity extras, operations, performance, infrastructure, challenges,
-- growth needs, and a per-field verification level — lives in `data` as
-- JSONB, same approach as acquisition_evaluations.
CREATE TABLE IF NOT EXISTS toig_business_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  industry    TEXT,
  location    TEXT,
  data        JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_toig_registry_agency ON toig_business_registry(agency_id, created_at);

ALTER TABLE toig_business_registry ENABLE ROW LEVEL SECURITY;

-- Same access as businesses/valuation: managers + superadmins of the agency.
DROP POLICY IF EXISTS toig_registry_select ON toig_business_registry;
CREATE POLICY toig_registry_select ON toig_business_registry FOR SELECT USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS toig_registry_insert ON toig_business_registry;
CREATE POLICY toig_registry_insert ON toig_business_registry FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS toig_registry_update ON toig_business_registry;
CREATE POLICY toig_registry_update ON toig_business_registry FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS toig_registry_delete ON toig_business_registry;
CREATE POLICY toig_registry_delete ON toig_business_registry FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP TRIGGER IF EXISTS update_toig_registry_modtime ON toig_business_registry;
CREATE TRIGGER update_toig_registry_modtime BEFORE UPDATE ON toig_business_registry
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE toig_business_registry REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE toig_business_registry;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
