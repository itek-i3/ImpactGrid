-- What each day's expense was spent on (e.g. Rent, Supplies, Transport).
ALTER TABLE daily_finance ADD COLUMN IF NOT EXISTS expense_category TEXT;
