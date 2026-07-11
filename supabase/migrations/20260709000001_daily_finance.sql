-- Daily finance: a shared, agency-wide daily figures table. Every member can add
-- a dated row (revenue / expenses / note); net is revenue - expenses. Real-time
-- like the other shared spaces.

CREATE TABLE IF NOT EXISTS daily_finance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue     NUMERIC NOT NULL DEFAULT 0,
  expenses    NUMERIC NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_finance_agency ON daily_finance(agency_id, entry_date DESC);

ALTER TABLE daily_finance ENABLE ROW LEVEL SECURITY;

-- Collaborative agency model: any member of the agency can read/add/edit/delete
-- their agency's rows (superadmin anywhere).
DROP POLICY IF EXISTS daily_finance_select ON daily_finance;
CREATE POLICY daily_finance_select ON daily_finance
  FOR SELECT USING (get_my_role() = 'superadmin' OR agency_id = get_my_agency_id());

DROP POLICY IF EXISTS daily_finance_insert ON daily_finance;
CREATE POLICY daily_finance_insert ON daily_finance
  FOR INSERT WITH CHECK (get_my_role() = 'superadmin' OR agency_id = get_my_agency_id());

DROP POLICY IF EXISTS daily_finance_update ON daily_finance;
CREATE POLICY daily_finance_update ON daily_finance
  FOR UPDATE USING (get_my_role() = 'superadmin' OR agency_id = get_my_agency_id());

DROP POLICY IF EXISTS daily_finance_delete ON daily_finance;
CREATE POLICY daily_finance_delete ON daily_finance
  FOR DELETE USING (get_my_role() = 'superadmin' OR agency_id = get_my_agency_id());

ALTER TABLE daily_finance REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_finance;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
