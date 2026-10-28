-- The standard monthly instalment every member is expected to pay — e.g.
-- membership 5,000 once into the Reserve, then 1,000/month into Loans &
-- Operations (the chama/loan book), plus whatever they choose to put into
-- a project on top. This is the figure the Installments tab checks each
-- member's this-month total against, so "paid" means "met the instalment",
-- not just "made some payment".

ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS monthly_contribution_amount NUMERIC NOT NULL DEFAULT 1000;
