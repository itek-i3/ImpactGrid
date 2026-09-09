-- Not every business reports finances at the same cadence — a retail shop
-- might log revenue/expenses daily, while a real estate holding only ever
-- knows its figures monthly. `finance_period` is a per-business setting
-- (not per-entry) that the Finance panel reads to decide which UI to show:
-- 'daily' keeps the existing day/week/month drill-down, 'monthly' switches
-- to a flat list of one revenue+expenses figure per calendar month.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS finance_period TEXT NOT NULL DEFAULT 'daily' CHECK (finance_period IN ('daily','monthly'));
