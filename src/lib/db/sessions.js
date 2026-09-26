import { createClient, createAdminClient } from '@/lib/supabase/server';
import { clientForUser } from './clientForUser';

// Only the owner's browser ever moves a session on to 'expired' / 'completed'.
// If they close the tab or lose power mid-session the row stays 'active' forever,
// so teammates would see them as live indefinitely. Reconcile on read instead:
//  - an 'active' session past its end_time is reported as 'expired', and
//  - a session nobody has touched for STALE_AFTER_MS past its last activity is
//    dropped from the team list (the row is kept — if the owner returns and
//    resumes/completes it, their PATCH brings it straight back).
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function reconcileTeamSession(s, now) {
  const endMs = new Date(s.end_time).getTime();
  const pausedMs = s.paused_at ? new Date(s.paused_at).getTime() : NaN;
  const updatedMs = new Date(s.updated_at).getTime();

  // A paused session's end_time is frozen until resume, so its last activity is
  // when it was paused, not when it would have ended.
  const lastActivity = s.status === 'paused' ? (Number.isNaN(pausedMs) ? updatedMs : pausedMs) : endMs;
  if (!Number.isNaN(lastActivity) && now - lastActivity > STALE_AFTER_MS) return null;

  if (s.status === 'active' && !Number.isNaN(endMs) && endMs <= now) return { ...s, status: 'expired' };
  return s;
}

export async function listSessionsForWorkspace(workspaceId) {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('sessions')
    .select('id, workspace_id, user_id, task_description, duration_seconds, started_at, end_time, paused_at, status, snooze_count, completion_note, completed_at, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .neq('status', 'completed')
    .order('started_at', { ascending: false });

  if (error) return { data: [], error };

  const now = Date.now();
  const sessions = (rows || []).map((s) => reconcileTeamSession(s, now)).filter(Boolean);
  if (!sessions.length) return { data: [], error: null };

  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const data = sessions.map((s) => ({ ...s, profiles: profileMap[s.user_id] || null }));

  return { data, error: null };
}

export async function createSession({
  workspaceId,
  taskDescription = '',
  durationSeconds,
  endTime,
}) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated' } };

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      workspace_id:     workspaceId,
      user_id:          userId,
      task_description: taskDescription,
      duration_seconds: durationSeconds,
      end_time:         new Date(endTime).toISOString(),
      status:           'active',
    })
    .select()
    .single();

  return { data, error };
}

export async function updateSession(id, updates) {
  const { supabase } = await clientForUser();
  const allowed = {};

  if (updates.status           !== undefined) allowed.status           = updates.status;
  if (updates.end_time         !== undefined) allowed.end_time         = new Date(updates.end_time).toISOString();
  if (updates.paused_at        !== undefined) allowed.paused_at        = updates.paused_at ? new Date(updates.paused_at).toISOString() : null;
  if (updates.snooze_count     !== undefined) allowed.snooze_count     = updates.snooze_count;
  if (updates.completion_note  !== undefined) allowed.completion_note  = updates.completion_note;
  if (updates.completed_at     !== undefined) allowed.completed_at     = updates.completed_at ? new Date(updates.completed_at).toISOString() : null;

  const { data, error } = await supabase
    .from('sessions')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteSession(id) {
  const { supabase } = await clientForUser();
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  return { error };
}

export async function listMySessionHistory(workspaceId) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('sessions')
    .select('id, task_description, duration_seconds, started_at, completed_at, completion_note, snooze_count')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(30);
  return { data: data || [], error };
}

export async function clearMySessionHistory(workspaceId) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { error: null };
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'completed');
  return { error };
}
