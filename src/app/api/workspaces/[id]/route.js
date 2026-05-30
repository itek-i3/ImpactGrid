import { ok, noContent, notFound, fromSupabaseError } from '@/lib/api/response';
import { getWorkspace, updateWorkspace, deleteWorkspace } from '@/lib/db/workspaces';

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await getWorkspace(id);
  if (error) return fromSupabaseError(error);
  if (!data) return notFound('Workspace not found');
  return ok(data);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { data, error } = await updateWorkspace(id, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { id } = await params;
  const { error } = await deleteWorkspace(id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
