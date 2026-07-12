-- Businesses under an agency, so Daily Finance can be tracked per business.
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_businesses_agency ON businesses(agency_id, created_at);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Same access as Daily Finance: managers + superadmins of the agency.
DROP POLICY IF EXISTS businesses_select ON businesses;
CREATE POLICY businesses_select ON businesses FOR SELECT USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS businesses_insert ON businesses;
CREATE POLICY businesses_insert ON businesses FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS businesses_update ON businesses;
CREATE POLICY businesses_update ON businesses FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS businesses_delete ON businesses;
CREATE POLICY businesses_delete ON businesses FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

-- Scope each finance entry to a business (cascade-deletes with the business).
ALTER TABLE daily_finance ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_daily_finance_business ON daily_finance(business_id, entry_date DESC);

ALTER TABLE businesses REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE businesses;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
