import { ok, badRequest, fromSupabaseError } from '@/lib/api/response';
import { inviteToSession } from '@/lib/db/sessions';
import { sendPushToUsers } from '@/lib/push/send';

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const participantIds = Array.isArray(body.participantIds) ? body.participantIds : [];

  if (!id) return badRequest('session id is required');
  if (!participantIds.length) return badRequest('participantIds is required');

  const { data, error } = await inviteToSession(id, participantIds);
  if (error) return fromSupabaseError(error);

  const invitedIds = (data.invited || []).map((row) => row.user_id);
  if (invitedIds.length) {
    try {
      await sendPushToUsers(invitedIds, {
        title: `${data.starterName || 'A teammate'} added you to a focus session`,
        body: data.taskDescription ? `"${data.taskDescription}" — join in?` : 'You were added to a group focus session.',
        icon: data.starterAvatar || undefined,
        tag: 'session-invite',
        url: '/os/?openSessions=1',
      });
    } catch (_) { /* push is best-effort */ }
  }

  return ok({ groupId: data.groupId, invited: data.invited });
}
