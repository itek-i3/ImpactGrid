import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { requestToJoinSession, respondToJoinRequest } from '@/lib/db/sessions';
import { sendPushToUsers } from '@/lib/push/send';

// POST: `id` is the session you want to join (any row belonging to it works
// — a solo session's own id, or any member's row id if it's already a
// group). Creates YOUR OWN new row with status 'requested'.
export async function POST(_, { params }) {
  const { id } = await params;
  if (!id) return badRequest('session id is required');

  const { data, error } = await requestToJoinSession(id);
  if (error) return fromSupabaseError(error);

  if (data.starterId) {
    try {
      await sendPushToUsers([data.starterId], {
        title: `${data.requesterName || 'A teammate'} wants to join your focus session`,
        body: data.taskDescription ? `"${data.taskDescription}"` : 'Open Sessions to approve or decline.',
        icon: data.requesterAvatar || undefined,
        tag: 'session-join-request',
        url: '/os/?openSessions=1',
      });
    } catch (_) { /* push is best-effort */ }
  }

  return created(data.mine);
}

// PATCH: `id` is the pending request row itself (the requester's own row,
// still status 'requested') — body { accept: boolean }. Only the original
// session starter may call this; respondToJoinRequest enforces it.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!id) return badRequest('request id is required');
  if (typeof body.accept !== 'boolean') return badRequest('accept (boolean) is required');

  const { data, error } = await respondToJoinRequest(id, body.accept);
  if (error) return fromSupabaseError(error);

  if (data.accepted) {
    try {
      await sendPushToUsers([data.requesterId], {
        title: 'Your request to join was approved',
        body: "You're in — open Sessions to see the group.",
        tag: 'session-join-approved',
        url: '/os/?openSessions=1',
      });
    } catch (_) { /* push is best-effort */ }
  }

  return ok(data.session || data);
}
