-- fund_settings.monthly_split_loans_pct was added in
-- 20261108000000_fund_accounts.sql to split each month's contribution
-- between Loans & Operations and the Fund Account. The money-flow
-- restructure in 20261111000000_fund_project_baseline.sql replaced that
-- design outright — the monthly contribution now funds Loans & Operations
-- in full — without ever dropping the column, leaving dead schema that
-- looks like it does something (it doesn't; nothing in the app has read
-- or written it since).
ALTER TABLE fund_settings DROP COLUMN IF EXISTS monthly_split_loans_pct;
