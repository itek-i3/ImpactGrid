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
    .select('id, workspace_id, user_id, task_description, duration_seconds, started_at, end_time, paused_at, status, snooze_count, completion_note, completed_at, created_at, updated_at, group_id')
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

// A group session is one row per participant, sharing a single group_id —
// each still runs their own pause/resume/snooze/completion note (exactly
// like createSession's row), they just started together on the same task,
// duration and end time. Needs the admin client because RLS only lets a
// user insert a row for themselves; participants are re-validated here
// server-side rather than trusted from the client.
export async function createGroupSession({
  workspaceId,
  taskDescription = '',
  durationSeconds,
  endTime,
  participantIds = [],
}) {
  const { userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated' } };

  const admin = createAdminClient();

  const { data: workspace } = await admin.from('workspaces').select('agency_id').eq('id', workspaceId).maybeSingle();
  if (!workspace) return { data: null, error: { message: 'Workspace not found' } };

  // Same membership rule as the chat-members picker this list is drawn from:
  // profile.agency_id match, OR admin-granted cross-agency access.
  const candidateIds = [...new Set([userId, ...participantIds])].filter(Boolean);
  const [{ data: byProfile }, { data: byGrant }] = await Promise.all([
    admin.from('profiles').select('id').eq('agency_id', workspace.agency_id).in('id', candidateIds),
    admin.from('agency_members').select('user_id').eq('agency_id', workspace.agency_id).in('user_id', candidateIds),
  ]);
  const validIds = new Set([
    userId,
    ...(byProfile || []).map((p) => p.id),
    ...(byGrant || []).map((m) => m.user_id),
  ]);

  const groupId = crypto.randomUUID();
  const rows = [...validIds].map((uid) => ({
    workspace_id:     workspaceId,
    user_id:          uid,
    task_description: taskDescription,
    duration_seconds: durationSeconds,
    end_time:         new Date(endTime).toISOString(),
    status:           'active',
    group_id:         groupId,
  }));

  const { data, error } = await admin.from('sessions').insert(rows).select();
  if (error) return { data: null, error };

  const mine = data.find((row) => row.user_id === userId);
  const otherUserIds = data.filter((row) => row.user_id !== userId).map((row) => row.user_id);
  const { data: starter } = await admin.from('profiles').select('full_name, email, avatar_url').eq('id', userId).maybeSingle();
  return { data: { mine, otherUserIds, starterName: starter?.full_name || starter?.email, starterAvatar: starter?.avatar_url }, error: null };
}

// Adds more people to an already-running session — only its owner may call
// this. If the session was started solo (no group_id yet), one is created
// now and retroactively applied to the owner's own row. New rows copy the
// session's CURRENT state (end_time, paused_at, status) so an invitee who
// joins mid-countdown sees the real time remaining, not a fresh timer.
export async function inviteToSession(sessionId, participantIds = []) {
  const { userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated' } };
  if (!participantIds.length) return { data: { invited: [], groupId: null }, error: null };

  const admin = createAdminClient();

  const { data: existing } = await admin.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!existing) return { data: null, error: { message: 'Session not found', status: 404 } };
  if (existing.user_id !== userId) return { data: null, error: { message: 'Only the session owner can invite others', status: 403 } };
  if (existing.status === 'completed') return { data: null, error: { message: 'Session already completed' } };

  const { data: workspace } = await admin.from('workspaces').select('agency_id').eq('id', existing.workspace_id).maybeSingle();
  if (!workspace) return { data: null, error: { message: 'Workspace not found' } };

  const candidateIds = [...new Set(participantIds)].filter((id) => id && id !== userId);
  const [{ data: byProfile }, { data: byGrant }] = await Promise.all([
    admin.from('profiles').select('id').eq('agency_id', workspace.agency_id).in('id', candidateIds),
    admin.from('agency_members').select('user_id').eq('agency_id', workspace.agency_id).in('user_id', candidateIds),
  ]);
  const validIds = new Set([...(byProfile || []).map((p) => p.id), ...(byGrant || []).map((m) => m.user_id)]);

  let groupId = existing.group_id;
  if (!groupId) {
    groupId = crypto.randomUUID();
    await admin.from('sessions').update({ group_id: groupId }).eq('id', sessionId);
  } else {
    // Already in this group — don't hand out a second row.
    const { data: already } = await admin.from('sessions').select('user_id').eq('group_id', groupId);
    (already || []).forEach((row) => validIds.delete(row.user_id));
  }
  if (!validIds.size) return { data: { invited: [], groupId }, error: null };

  const rows = [...validIds].map((uid) => ({
    workspace_id:     existing.workspace_id,
    user_id:          uid,
    task_description: existing.task_description,
    duration_seconds: existing.duration_seconds,
    end_time:         existing.end_time,
    paused_at:        existing.paused_at,
    status:           existing.status === 'paused' ? 'paused' : 'active',
    group_id:         groupId,
  }));

  const { data: invited, error } = await admin.from('sessions').insert(rows).select();
  if (error) return { data: null, error };

  const { data: starter } = await admin.from('profiles').select('full_name, email, avatar_url').eq('id', userId).maybeSingle();
  return {
    data: {
      invited,
      groupId,
      taskDescription: existing.task_description,
      starterName: starter?.full_name || starter?.email,
      starterAvatar: starter?.avatar_url,
    },
    error: null,
  };
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
