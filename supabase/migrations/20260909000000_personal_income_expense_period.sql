-- Personal income/expenses so far only recorded a specific day. Some
-- finances are only ever known at a coarser granularity (a monthly salary
-- or rent, a weekly allowance or gig payout) rather than a specific date, so
-- entries now carry a `period` tag: 'daily' (unchanged), 'weekly', or
-- 'monthly'. `entry_date` still anchors the row for existing month/year
-- aggregation — a weekly row stores that week's Monday, a monthly row
-- stores the 1st of that month — so no query elsewhere needs to change.

ALTER TABLE personal_income
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly','monthly'));

ALTER TABLE personal_expenses
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly','monthly'));
