import { ok, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { updateSession, deleteSession } from '@/lib/db/sessions';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!id) return badRequest('session id is required');

  const { data, error } = await updateSession(id, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { id } = await params;
  if (!id) return badRequest('session id is required');

  const { error } = await deleteSession(id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
