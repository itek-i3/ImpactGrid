-- A teammate can now ask to join a session they see running, instead of
-- only accepting invites sent to them. Their row starts as 'requested' and
-- only the session's starter can flip it to 'active' by approving (see
-- respondToJoinRequest) — mirrors 'invited', just initiated by the other
-- side of the relationship.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('invited', 'active', 'paused', 'expired', 'logging', 'completed', 'requested'));
