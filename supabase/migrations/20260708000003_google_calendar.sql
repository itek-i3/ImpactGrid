-- Google Calendar / Meet integration: store each user's OAuth tokens and link
-- meetings to the Google event that was created for them.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;

CREATE TABLE IF NOT EXISTS google_credentials (
  user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email         TEXT,                       -- the connected Google account
  refresh_token TEXT,                       -- long-lived; used to mint access tokens
  access_token  TEXT,
  token_expiry  TIMESTAMPTZ,
  scope         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE google_credentials ENABLE ROW LEVEL SECURITY;

-- A user may only ever see/modify their own tokens. Server routes that need to
-- read tokens for refresh use the service-role (admin) client, which bypasses RLS.
DROP POLICY IF EXISTS google_credentials_select ON google_credentials;
CREATE POLICY google_credentials_select ON google_credentials
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS google_credentials_insert ON google_credentials;
CREATE POLICY google_credentials_insert ON google_credentials
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS google_credentials_update ON google_credentials;
CREATE POLICY google_credentials_update ON google_credentials
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS google_credentials_delete ON google_credentials;
CREATE POLICY google_credentials_delete ON google_credentials
  FOR DELETE USING (user_id = auth.uid());
