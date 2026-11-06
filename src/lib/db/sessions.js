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

// Promotes a still-solo session row to a group by minting a group_id for
// it — shared by inviteToSession's invite path and respondToJoinRequest's
// approve path, since either one can be the first thing that turns
// someone's solo session into a group.
async function ensureGroupId(admin, row) {
  if (row.group_id) return row.group_id;
  const groupId = crypto.randomUUID();
  await admin.from('sessions').update({ group_id: groupId, started_by: row.started_by || row.user_id }).eq('id', row.id);
  // Any other still-pending join requests filed against this same
  // (until-now solo) row get the same group_id too, purely so they render
  // inside the group's roster from now on — their status stays 'requested'
  // until separately approved.
  await admin.from('sessions').update({ group_id: groupId }).eq('request_target_id', row.id).eq('status', 'requested');
  return groupId;
}

export async function listSessionsForWorkspace(workspaceId) {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('sessions')
    .select('id, workspace_id, user_id, task_description, duration_seconds, started_at, end_time, paused_at, status, snooze_count, completion_note, completed_at, created_at, updated_at, group_id, started_by, request_target_id')
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
      started_by:       userId,
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
    // The starter is in the session immediately; everyone else is only
    // invited — their row flips to 'active' when they actually accept
    // (see acceptInvite / updateSession), not the moment they're invited.
    status:           uid === userId ? 'active' : 'invited',
    group_id:         groupId,
    started_by:       userId,
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
    groupId = await ensureGroupId(admin, existing);
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
    // Invited, not active — they only actually join once they accept (see
    // acceptInvite / updateSession), regardless of the inviter's own
    // active/paused state right now.
    status:           'invited',
    group_id:         groupId,
    started_by:       existing.started_by || existing.user_id,
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

// A teammate asks to join a session they see running rather than waiting to
// be invited to one — the reverse of inviteToSession. Still just a
// self-insert (RLS lets anyone insert their OWN row), so no admin client is
// needed here; the row starts as 'requested' and only the session's
// original starter can move it to 'active' (see respondToJoinRequest),
// exactly mirroring how an invited row only becomes 'active' once accepted.
export async function requestToJoinSession(targetSessionId) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated' } };

  const { data: target } = await supabase.from('sessions').select('*').eq('id', targetSessionId).maybeSingle();
  if (!target) return { data: null, error: { message: 'Session not found', status: 404 } };
  if (target.user_id === userId) return { data: null, error: { message: "You can't request to join your own session", status: 400 } };
  if (!['active', 'paused'].includes(target.status)) {
    return { data: null, error: { message: 'That session is no longer open to join', status: 400 } };
  }

  // Already have a row for this exact session, for the group it belongs
  // to, or a pending request already filed against it.
  const { data: mineRows } = await supabase
    .from('sessions')
    .select('id, group_id, request_target_id')
    .eq('user_id', userId)
    .eq('workspace_id', target.workspace_id)
    .neq('status', 'completed');
  const alreadyIn = (mineRows || []).some((r) =>
    r.id === target.id ||
    (target.group_id && r.group_id === target.group_id) ||
    r.request_target_id === target.id
  );
  if (alreadyIn) return { data: null, error: { message: 'You already have a row in this session', status: 400 } };

  const startedBy = target.started_by || target.user_id;
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      workspace_id:      target.workspace_id,
      user_id:           userId,
      task_description:  target.task_description,
      duration_seconds:  target.duration_seconds,
      end_time:          target.end_time,
      status:            'requested',
      group_id:          target.group_id || null,
      started_by:        startedBy,
      request_target_id: target.id,
    })
    .select()
    .single();
  if (error) return { data: null, error };

  const { data: me } = await supabase.from('profiles').select('full_name, email, avatar_url').eq('id', userId).maybeSingle();
  return {
    data: {
      mine: data,
      starterId: startedBy,
      requesterName: me?.full_name || me?.email,
      requesterAvatar: me?.avatar_url,
      taskDescription: target.task_description,
    },
    error: null,
  };
}

// Approves or declines a pending join request. Only the ORIGINAL starter of
// the session/group being requested may call this — not just any other
// already-active member — so unlike inviteToSession's "is this my own row"
// check, this compares against started_by.
export async function respondToJoinRequest(requestRowId, accept) {
  const { userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated' } };

  const admin = createAdminClient();
  const { data: requestRow } = await admin.from('sessions').select('*').eq('id', requestRowId).maybeSingle();
  if (!requestRow) return { data: null, error: { message: 'Request not found', status: 404 } };
  if (requestRow.status !== 'requested') return { data: null, error: { message: 'That request has already been resolved', status: 400 } };

  const starterId = requestRow.started_by || requestRow.user_id;
  if (starterId !== userId) return { data: null, error: { message: 'Only the session starter can respond to join requests', status: 403 } };

  if (!accept) {
    // Mirrors declining an invite (DELETE) — except the STARTER is removing
    // someone else's row here, so it needs the admin client; a requester
    // withdrawing their own pending row still goes through the existing
    // DELETE /api/sessions/[id] route (deleteSession, RLS-scoped) unchanged.
    const { error } = await admin.from('sessions').delete().eq('id', requestRowId);
    return { data: error ? null : { requesterId: requestRow.user_id, accepted: false }, error };
  }

  const { data: target } = await admin.from('sessions').select('*').eq('id', requestRow.request_target_id).maybeSingle();
  if (!target) return { data: null, error: { message: 'The original session no longer exists', status: 400 } };

  // Promotes a still-solo target to a group on first approval — the exact
  // same helper inviteToSession uses for its own solo -> group case.
  const groupId = await ensureGroupId(admin, target);

  // Refresh from the target's CURRENT state in case it moved on (snoozed,
  // paused, task edited) while the request sat pending — the same rule
  // invited rows already follow when they're created.
  const { data, error } = await admin
    .from('sessions')
    .update({
      status:           'active',
      group_id:         groupId,
      started_by:       target.started_by || target.user_id,
      task_description: target.task_description,
      duration_seconds: target.duration_seconds,
      end_time:         target.end_time,
    })
    .eq('id', requestRowId)
    .select()
    .single();
  if (error) return { data: null, error };

  return { data: { requesterId: requestRow.user_id, accepted: true, groupId, session: data }, error: null };
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
  const { data, error } = await supabase.from('sessions').delete().eq('id', id).select('id');
  if (error) return { error };
  // Postgres/RLS reports a delete whose USING clause matched nothing as
  // success with zero rows affected, not an error — so without this check,
  // a decline/discard/withdraw that RLS actually blocked (stale id, a race
  // with some other change, anything not matching user_id = auth.uid())
  // would look like it worked here while the row quietly survives
  // server-side, invisible to the device that "declined" it but still
  // showing up for the inviter and any other device.
  if (!data?.length) return { error: { message: 'Session not found or already removed', status: 404 } };
  return { error: null };
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
