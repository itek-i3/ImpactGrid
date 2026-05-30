import { ok, noContent, notFound, fromSupabaseError } from '@/lib/api/response';
import { getDatabase, updateDatabase, deleteDatabase } from '@/lib/db/databases';

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await getDatabase(id);
  if (error) return fromSupabaseError(error);
  if (!data) return notFound('Database not found');
  return ok(data);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await updateDatabase(id, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { id } = await params;
  const { error } = await deleteDatabase(id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
