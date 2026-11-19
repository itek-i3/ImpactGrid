-- A manager logging a contribution sometimes needs to record a donor or
-- investor at exactly 0 (e.g. onboarding someone who hasn't actually put
-- money in yet, or correcting a mistaken entry down to nothing) without
-- that row being rejected outright. amount must still never go negative.
ALTER TABLE fund_contributions DROP CONSTRAINT fund_contributions_amount_check;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_amount_check CHECK (amount >= 0);
