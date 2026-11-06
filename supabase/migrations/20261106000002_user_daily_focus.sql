  -- "Today's Focus" tasks become one global per-user list, shared across every
  -- agency's Home page for that user — instead of one copy per (agency_id,
  -- user_id) row in member_missions. Everything else in member_missions
  -- (department, mission, priorities, outcomes, weekly_objectives, kpis) stays
  -- exactly as-is, per-agency, untouched — only "the task" (the user's own
  -- words) goes global.
  CREATE TABLE IF NOT EXISTS user_daily_focus (
    user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    tasks      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ text, expectedOutcome, done, date, result: {type,note}|null }]
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE user_daily_focus ENABLE ROW LEVEL SECURITY;

  -- Owner-only. Confirmed in the rendering code that no surface in the app ever
  -- shows another person's task list, unlike mission/department/priorities
  -- which the Team Focus Board does show for everyone.
  DROP POLICY IF EXISTS user_daily_focus_all ON user_daily_focus;
  CREATE POLICY user_daily_focus_all ON user_daily_focus
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  ALTER TABLE user_daily_focus REPLICA IDENTITY FULL;
  DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_daily_focus;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  -- ── Backfill: merge each user's existing per-agency tasks into one list ────
  -- Real data exists today. Flatten every agency's tasks array per user,
  -- de-duplicate byte-identical elements (same text+date+done+result, which
  -- happens if a task was ever logged in two agencies independently), keep the
  -- earliest occurrence's position so merged order stays deterministic.
  WITH flattened AS (
    SELECT mm.user_id, elem,
      row_number() OVER (PARTITION BY mm.user_id ORDER BY mm.agency_id, ord) AS seq
    FROM member_missions mm
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(mm.tasks, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE jsonb_typeof(mm.tasks) = 'array' AND jsonb_array_length(mm.tasks) > 0
  ),
  deduped AS (
    SELECT DISTINCT ON (user_id, elem) user_id, elem, seq
    FROM flattened ORDER BY user_id, elem, seq
  ),
  merged AS (
    SELECT user_id, jsonb_agg(elem ORDER BY seq) AS tasks
    FROM deduped GROUP BY user_id
  )
  INSERT INTO user_daily_focus (user_id, tasks, updated_at)
  SELECT user_id, tasks, NOW() FROM merged
  ON CONFLICT (user_id) DO NOTHING;

  -- ── Remove `tasks` from member_missions — data was copied above, nothing is
  -- lost. Dropping (not leaving unused) is deliberate: TeamPanel.js writes to
  -- this exact column too, and leaving it around risks a future write silently
  -- diverging from the new global store. Ships in the SAME release as the app
  -- code that stops sending/expecting a `tasks` key on member_missions.
  ALTER TABLE member_missions DROP COLUMN IF EXISTS tasks;
