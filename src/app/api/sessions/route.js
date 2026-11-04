import { ok, created, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listSessionsForWorkspace, createSession, createGroupSession, listMySessionHistory, clearMySessionHistory } from '@/lib/db/sessions';
import { sendPushToUsers } from '@/lib/push/send';

// Not everyone invited to a group session is actively looking at the app —
// this is what reaches them anyway: a real push notification (via the same
// infra chat messages already use), delivered to the website tab and to the
// installed mobile PWA alike, since both share one push subscription per
// device. openSessions=1 tells the app to pop the Sessions modal straight
// open once the notification is tapped.
async function notifyInvitees(userIds, { starterName, taskDescription, starterAvatar }) {
  if (!userIds?.length) return;
  try {
    await sendPushToUsers(userIds, {
      title: `${starterName || 'A teammate'} started a focus session`,
      body: taskDescription ? `"${taskDescription}" — join in?` : 'You were added to a group focus session.',
      icon: starterAvatar || undefined,
      tag: 'session-invite',
      url: '/os/?openSessions=1',
    });
  } catch (_) { /* push is best-effort */ }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return badRequest('workspaceId is required');

  if (searchParams.get('history') === 'true') {
    const { data, error } = await listMySessionHistory(workspaceId);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  const { data, error } = await listSessionsForWorkspace(workspaceId);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { workspaceId, taskDescription, durationSeconds, endTime, participantIds } = body;

  if (!workspaceId)    return badRequest('workspaceId is required');
  if (!durationSeconds) return badRequest('durationSeconds is required');
  if (!endTime)        return badRequest('endTime is required');

  if (Array.isArray(participantIds) && participantIds.length > 0) {
    const { data, error } = await createGroupSession({ workspaceId, taskDescription, durationSeconds, endTime, participantIds });
    if (error) return fromSupabaseError(error);
    await notifyInvitees(data.otherUserIds, { starterName: data.starterName, taskDescription, starterAvatar: data.starterAvatar });
    return created(data.mine);
  }

  const { data, error } = await createSession({ workspaceId, taskDescription, durationSeconds, endTime });
  if (error) return fromSupabaseError(error);
  return created(data);
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return badRequest('workspaceId is required');

  const { error } = await clearMySessionHistory(workspaceId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
