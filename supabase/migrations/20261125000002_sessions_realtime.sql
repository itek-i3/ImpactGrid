-- Put sessions on the realtime publication so invites/accepts/declines/
-- pause/resume reach teammates instantly instead of waiting on the 20s poll.
--
-- REPLICA IDENTITY FULL matters specifically for DELETE: by default Postgres
-- only includes a deleted row's PRIMARY KEY in the replication event, not its
-- other columns. SessionProvider's realtime subscription filters on
-- workspace_id (`workspace_id=eq.${workspaceId}`) — with the default replica
-- identity, a DELETE event carries no workspace_id to filter on, so Realtime
-- can't tell whether it matches and drops it. That silently demotes every
-- decline/withdraw (a DELETE) to the 20s polling fallback while invites/
-- accepts/pauses (INSERT/UPDATE, which always carry full row data) keep
-- updating instantly — exactly the asymmetry reported: declining looks like
-- it doesn't work because the owner's view only catches up up to 20s later.
ALTER TABLE sessions REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
