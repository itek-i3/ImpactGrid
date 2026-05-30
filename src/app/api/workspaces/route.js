import { ok, created, badRequest, serverError, fromSupabaseError } from '@/lib/api/response';
import { listWorkspaces, createWorkspace } from '@/lib/db/workspaces';

export async function GET() {
  const { data, error } = await listWorkspaces();
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { name, icon } = body;

  if (!name?.trim()) return badRequest('name is required');

  const { data, error } = await createWorkspace({ name: name.trim(), icon });
  if (error) return fromSupabaseError(error);
  return created(data);
}
