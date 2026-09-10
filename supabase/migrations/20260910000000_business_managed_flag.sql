-- Some businesses under an agency aren't actually being managed/tracked
-- right now (e.g. ACR isn't currently managing BiteBack). This flag lets the
-- Businesses tab and the home page's combined revenue/expenses/profit total
-- exclude them without deleting their finance history, so re-enabling later
-- is just flipping the flag back.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS managed BOOLEAN NOT NULL DEFAULT true;

UPDATE businesses SET managed = false
WHERE name = 'BiteBack' AND agency_id = (SELECT id FROM agencies WHERE name = 'ACR');
