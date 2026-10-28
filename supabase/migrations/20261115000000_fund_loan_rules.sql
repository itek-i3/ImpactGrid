-- Member handbook §9 (Member Loans) — four rules the app didn't enforce
-- yet: a minimum qualifying period before a member can borrow, a maximum
-- loan per member, a fund-wide cap on how much of Loans & Operations can
-- be out on loan at once, and a late-repayment penalty. Every one of these
-- defaults to "no effect" so an existing fund's behaviour doesn't change
-- until a manager sets real numbers in the Loans tab.

ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_qualifying_months NUMERIC NOT NULL DEFAULT 0;  -- 0 = no minimum tenure required
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_max_per_member NUMERIC;                         -- null = no per-member cap, on top of the savings-based limit
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_max_pool_pct NUMERIC NOT NULL DEFAULT 100;      -- % of Loans & Operations that may be out on loan at once; 100 = no effective cap
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_late_penalty_pct NUMERIC NOT NULL DEFAULT 0;    -- flat % a manager can add to an overdue loan's balance; 0 = no penalty

-- A one-off charge a manager applies to an overdue loan — locked in at the
-- moment it's applied, same "flat, not compounding" philosophy as the
-- loan's own interest; never recalculated automatically.
ALTER TABLE fund_loans ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC NOT NULL DEFAULT 0;
