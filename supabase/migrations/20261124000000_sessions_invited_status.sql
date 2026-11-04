-- Group-session invites now gate on acceptance: an invited participant's row
-- starts as 'invited' (not 'active') and only flips to 'active' when they
-- explicitly accept — they never silently "join" just by being invited.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('invited', 'active', 'paused', 'expired', 'logging', 'completed'));
