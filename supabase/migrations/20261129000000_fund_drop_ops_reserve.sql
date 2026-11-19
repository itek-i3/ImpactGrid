-- fund_settings.loans_ops_reserve_pct (added in
-- 20261111000000_fund_project_baseline.sql) let a manager flag part of the
-- Loans & Operations pool as "held for running costs" vs. actually
-- lendable. The money-flow restructure that splits the monthly
-- contribution 70/30 between the Fund Account and the Loan account
-- (src/lib/fund/shared.js MONTHLY_TO_LOAN_PCT) replaces that carve-out
-- outright — the Loan account is fully lendable now, nothing held back —
-- so this would otherwise become dead schema, same story as
-- monthly_split_loans_pct in 20261116000000_fund_drop_dead_column.sql.
ALTER TABLE fund_settings DROP COLUMN IF EXISTS loans_ops_reserve_pct;
