import { ok, created, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listSessionsForWorkspace, createSession, listMySessionHistory, clearMySessionHistory } from '@/lib/db/sessions';

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
  const { workspaceId, taskDescription, durationSeconds, endTime } = body;

  if (!workspaceId)    return badRequest('workspaceId is required');
  if (!durationSeconds) return badRequest('durationSeconds is required');
  if (!endTime)        return badRequest('endTime is required');

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
