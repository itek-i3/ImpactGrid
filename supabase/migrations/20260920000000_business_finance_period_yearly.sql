-- Some businesses (e.g. a long-held piece of land) only ever know their
-- figures once a year rather than day by day or month by month. Add
-- 'yearly' alongside the existing 'daily' and 'monthly' finance_period
-- options — a yearly entry anchors to Jan 1st of that year, the same
-- pattern monthly entries use for the 1st of the month.

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_finance_period_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_finance_period_check CHECK (finance_period IN ('daily','monthly','yearly'));
