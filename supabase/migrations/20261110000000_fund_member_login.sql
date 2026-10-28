-- Links a fund_members record to the login that belongs to that person, so
-- the app can show someone their own ImpactFund profile once they're a paid
-- member. fund_members.contact is freeform (an M-Pesa number more often
-- than an email), so it isn't a safe match against an account — this is a
-- separate, explicit field a manager sets instead.

ALTER TABLE fund_members ADD COLUMN IF NOT EXISTS login_email TEXT;
