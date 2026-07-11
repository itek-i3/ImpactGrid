-- Itemized expenses: each day's expenses are a list of { what, amount } items;
-- the `expenses` column stays as their total (kept in sync by the client).
ALTER TABLE daily_finance ADD COLUMN IF NOT EXISTS expense_items JSONB NOT NULL DEFAULT '[]'::jsonb;
