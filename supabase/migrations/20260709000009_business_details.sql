-- General details for each business (created on the Businesses page).
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS handler  TEXT,   -- who runs it
  ADD COLUMN IF NOT EXISTS sector   TEXT,   -- e.g. Services, FMCG, Real Estate, Agriculture
  ADD COLUMN IF NOT EXISTS domain   TEXT;   -- e.g. Laundromat, Car Wash
