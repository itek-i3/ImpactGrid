-- Loan rule rework: how much a member can borrow is no longer a formula
-- ("savings × loan_multiplier") — it's the manager's call, guided by the
-- member's credit score (src/lib/fund/shared.js creditScoreOf), which is
-- itself driven mainly by instalment consistency and how their past loans
-- went. Repaying a loan late now lowers that score instead of earning a
-- smaller gain; repaying on time or early raises it.
--
-- The chama also doesn't charge a late-repayment fee, and every loan's
-- repayment period is fixed at one month (never per-loan or per-chama
-- configurable). That makes loan_multiplier, loan_term_months,
-- loan_late_penalty_pct, fund_loans.term_months and fund_loans.penalty_amount
-- dead schema, same story as monthly_split_loans_pct in
-- 20261116000000_fund_drop_dead_column.sql. loan_max_per_member and
-- loan_qualifying_months are untouched — they're independent rules, not
-- part of the removed formula.
ALTER TABLE fund_settings DROP COLUMN IF EXISTS loan_multiplier;
ALTER TABLE fund_settings DROP COLUMN IF EXISTS loan_term_months;
ALTER TABLE fund_settings DROP COLUMN IF EXISTS loan_late_penalty_pct;
ALTER TABLE fund_loans DROP COLUMN IF EXISTS term_months;
ALTER TABLE fund_loans DROP COLUMN IF EXISTS penalty_amount;
