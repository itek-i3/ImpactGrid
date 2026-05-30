import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listForms, createForm } from '@/lib/db/forms';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const databaseId = searchParams.get('databaseId');

  if (!databaseId) return badRequest('databaseId query param is required');

  const { data, error } = await listForms(databaseId);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { databaseId, title, description, config, isPublic } = body;

  if (!databaseId) return badRequest('databaseId is required');

  const { data, error } = await createForm({ databaseId, title, description, config, isPublic });
  if (error) return fromSupabaseError(error);
  return created(data);
}
