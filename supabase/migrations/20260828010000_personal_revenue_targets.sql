-- Personal Finance: an optional monthly revenue target, one row per user per
-- month — mirrors personal_budgets but for the income side (a single overall
-- goal, not per-source) so progress toward it can be tracked the same way
-- budget-vs-spend is.

CREATE TABLE IF NOT EXISTS personal_revenue_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_key     TEXT NOT NULL, -- 'YYYY-MM'
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_personal_revenue_targets_user_month ON personal_revenue_targets(user_id, month_key);

ALTER TABLE personal_revenue_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_revenue_targets_select ON personal_revenue_targets;
CREATE POLICY personal_revenue_targets_select ON personal_revenue_targets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_revenue_targets_insert ON personal_revenue_targets;
CREATE POLICY personal_revenue_targets_insert ON personal_revenue_targets FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_revenue_targets_update ON personal_revenue_targets;
CREATE POLICY personal_revenue_targets_update ON personal_revenue_targets FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_revenue_targets_delete ON personal_revenue_targets;
CREATE POLICY personal_revenue_targets_delete ON personal_revenue_targets FOR DELETE USING (user_id = auth.uid());

ALTER TABLE personal_revenue_targets REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_revenue_targets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
