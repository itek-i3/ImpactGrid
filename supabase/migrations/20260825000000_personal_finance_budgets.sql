-- Personal Finance, rebuilt around budgeting instead of a daily log:
--   personal_budgets  — a user's monthly allocation per category
--   personal_income   — income entries tagged with a source
--   personal_expenses — expense entries tagged with a category
-- All private (RLS locked to user_id = auth.uid()), same pattern as the
-- personal_finance table this replaces. That table is left in place
-- (unused, not dropped) and its rows are backfilled below so nothing
-- anyone already logged is lost.

CREATE TABLE IF NOT EXISTS personal_budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_key     TEXT NOT NULL, -- 'YYYY-MM'
  category      TEXT NOT NULL,
  amount        NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_key, category)
);

CREATE TABLE IF NOT EXISTS personal_income (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  source        TEXT NOT NULL DEFAULT 'Unspecified',
  amount        NUMERIC NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category      TEXT NOT NULL DEFAULT 'Miscellaneous',
  amount        NUMERIC NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_budgets_user_month ON personal_budgets(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_personal_income_user ON personal_income(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_expenses_user ON personal_expenses(user_id, entry_date DESC);

ALTER TABLE personal_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_budgets_select ON personal_budgets;
CREATE POLICY personal_budgets_select ON personal_budgets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_budgets_insert ON personal_budgets;
CREATE POLICY personal_budgets_insert ON personal_budgets FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_budgets_update ON personal_budgets;
CREATE POLICY personal_budgets_update ON personal_budgets FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_budgets_delete ON personal_budgets;
CREATE POLICY personal_budgets_delete ON personal_budgets FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_income_select ON personal_income;
CREATE POLICY personal_income_select ON personal_income FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_income_insert ON personal_income;
CREATE POLICY personal_income_insert ON personal_income FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_income_update ON personal_income;
CREATE POLICY personal_income_update ON personal_income FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_income_delete ON personal_income;
CREATE POLICY personal_income_delete ON personal_income FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_expenses_select ON personal_expenses;
CREATE POLICY personal_expenses_select ON personal_expenses FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_expenses_insert ON personal_expenses;
CREATE POLICY personal_expenses_insert ON personal_expenses FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_expenses_update ON personal_expenses;
CREATE POLICY personal_expenses_update ON personal_expenses FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_expenses_delete ON personal_expenses;
CREATE POLICY personal_expenses_delete ON personal_expenses FOR DELETE USING (user_id = auth.uid());

ALTER TABLE personal_budgets REPLICA IDENTITY FULL;
ALTER TABLE personal_income REPLICA IDENTITY FULL;
ALTER TABLE personal_expenses REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_budgets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_income;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_expenses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One-time backfill from the old personal_finance daily log, guarded so it
-- only ever runs once (skipped if personal_income/personal_expenses already
-- have rows, e.g. on a re-run of this migration).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM personal_income) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'personal_finance'
  ) THEN
    INSERT INTO personal_income (user_id, entry_date, source, amount, note, created_at, updated_at)
    SELECT user_id, entry_date, 'Unspecified', income, note, created_at, updated_at
    FROM personal_finance
    WHERE income > 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM personal_expenses) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'personal_finance'
  ) THEN
    -- Each itemized { what, amount } entry becomes its own row, categorized
    -- by its label (blank labels fall back to Miscellaneous).
    INSERT INTO personal_expenses (user_id, entry_date, category, amount, created_at, updated_at)
    SELECT pf.user_id, pf.entry_date,
           COALESCE(NULLIF(TRIM(item->>'what'), ''), 'Miscellaneous'),
           (item->>'amount')::numeric,
           pf.created_at, pf.updated_at
    FROM personal_finance pf,
         jsonb_array_elements(pf.expense_items) AS item
    WHERE (item->>'amount')::numeric > 0;

    -- Any leftover expense total not covered by itemized entries (e.g. logged
    -- before item-level detail existed) is preserved as Miscellaneous too.
    INSERT INTO personal_expenses (user_id, entry_date, category, amount, created_at, updated_at)
    SELECT pf.user_id, pf.entry_date, 'Miscellaneous',
           pf.expenses - COALESCE(items.total, 0),
           pf.created_at, pf.updated_at
    FROM personal_finance pf
    LEFT JOIN (
      SELECT pf2.id, SUM((item->>'amount')::numeric) AS total
      FROM personal_finance pf2, jsonb_array_elements(pf2.expense_items) AS item
      WHERE (item->>'amount')::numeric > 0
      GROUP BY pf2.id
    ) items ON items.id = pf.id
    WHERE pf.expenses - COALESCE(items.total, 0) > 0.5;
  END IF;
END $$;
