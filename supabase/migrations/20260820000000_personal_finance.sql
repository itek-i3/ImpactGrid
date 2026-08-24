-- Personal finance: a private, per-user daily income/expense log (distinct from
-- the shared agency `daily_finance` table). Each row is one user's one day;
-- expense_items is a client-maintained { what, amount } list, expenses stays
-- as their total. Realtime, like the other personal spaces.

CREATE TABLE IF NOT EXISTS personal_finance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  income        NUMERIC NOT NULL DEFAULT 0,
  expenses      NUMERIC NOT NULL DEFAULT 0,
  expense_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_personal_finance_user ON personal_finance(user_id, entry_date DESC);

ALTER TABLE personal_finance ENABLE ROW LEVEL SECURITY;

-- Strictly private: only the owning user can see or touch their rows.
DROP POLICY IF EXISTS personal_finance_select ON personal_finance;
CREATE POLICY personal_finance_select ON personal_finance
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_finance_insert ON personal_finance;
CREATE POLICY personal_finance_insert ON personal_finance
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_finance_update ON personal_finance;
CREATE POLICY personal_finance_update ON personal_finance
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_finance_delete ON personal_finance;
CREATE POLICY personal_finance_delete ON personal_finance
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE personal_finance REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_finance;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
