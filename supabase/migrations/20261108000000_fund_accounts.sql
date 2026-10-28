-- ImpactFund's four accounts (member handbook §5) — Reserve, Loans &
-- Operations, Fund Account, Project Account. No new ledger table: every
-- account balance is derived in the app from fund_contributions (plus
-- fund_loans / fund_loan_repayments for Loans & Operations) the same way
-- every other fund total is — these two columns are just the knobs members
-- set for how money is split and what Reserve starts net of.

ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS monthly_split_loans_pct NUMERIC NOT NULL DEFAULT 100; -- % of each monthly contribution routed to Loans & Operations; the rest (if any) goes to the Fund Account — defaults to 100, i.e. the whole monthly instalment funds loans/chama
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS setup_costs NUMERIC NOT NULL DEFAULT 0;              -- one-off, deducted from membership contributions before the Reserve balance
