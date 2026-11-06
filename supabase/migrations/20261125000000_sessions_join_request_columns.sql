-- started_by identifies the session/group's ORIGINAL starter specifically
-- (not just any member who has since joined and is now 'active' too) so
-- approve/decline authorization on a join request is a single-column
-- comparison instead of an unreliable derivation after the fact.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sessions_started_by_idx ON sessions(started_by);

-- Backfill: a solo row's own user is unambiguously its starter. Existing
-- multi-row groups can't be reconstructed this precisely after the fact,
-- but that's fine — authorization code also falls back to a row's own
-- user_id whenever started_by is null.
UPDATE sessions SET started_by = user_id WHERE started_by IS NULL;

-- Points a pending 'requested' row at the session/row it's asking to join,
-- so respondToJoinRequest can find and promote the right row on approval.
-- A requester can only insert their OWN row (RLS), so they can't stamp a
-- group_id onto someone else's existing row themselves — this is how the
-- server-side approval finds what to promote.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS request_target_id UUID REFERENCES sessions(id) ON DELETE SET NULL;
