import { ok, badRequest, forbidden, serverError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken, createMeetEvent, deleteMeetEvent } from '@/lib/google/oauth';

// Creates a Google Calendar event with a Meet link (and emails invites) using the
// caller's connected Google account. Returns { eventId, meetLink, htmlLink }.
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const { title, description, startsAt, endsAt, attendeeEmails, recurrence } = body;
  if (!title || !startsAt || !endsAt) return badRequest('title, startsAt and endsAt are required');

  let token;
  try {
    token = await getValidAccessToken(user.id);
  } catch (e) {
    return serverError(e);
  }
  if (!token) return forbidden('Google account not connected');

  try {
    const result = await createMeetEvent(token, { title, description, startsAt, endsAt, attendeeEmails, recurrence });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}

// Deletes a previously-created Google event (best effort) when a meeting is removed.
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) return badRequest('eventId is required');

  const token = await getValidAccessToken(user.id).catch(() => null);
  if (token) await deleteMeetEvent(token, eventId);
  return ok({ ok: true });
}
