-- Web Push subscriptions — one row per device/browser the user enabled push on.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage only their own subscriptions from the client. The server sends
-- pushes to OTHER users via the service-role (admin) client, which bypasses RLS.
DROP POLICY IF EXISTS push_subs_select ON push_subscriptions;
CREATE POLICY push_subs_select ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_insert ON push_subscriptions;
CREATE POLICY push_subs_insert ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_delete ON push_subscriptions;
CREATE POLICY push_subs_delete ON push_subscriptions FOR DELETE USING (user_id = auth.uid());
