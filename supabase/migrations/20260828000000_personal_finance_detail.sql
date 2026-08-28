-- Personal Finance: an optional free-text "detail" per income/expense entry,
-- so a source or category can be broken down further (e.g. a specific
-- employer or vendor) without inventing a whole sub-category system.
-- Nullable, no default — most entries won't set it.

ALTER TABLE personal_income ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE personal_expenses ADD COLUMN IF NOT EXISTS detail TEXT;
