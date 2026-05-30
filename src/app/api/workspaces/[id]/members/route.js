import { ok, created, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listMembers, addMember, updateMemberRole, removeMember } from '@/lib/db/workspaces';

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await listMembers(id);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { userId, role } = body;

  if (!userId) return badRequest('userId is required');

  const { data, error } = await addMember(id, { userId, role });
  if (error) return fromSupabaseError(error);
  return created(data);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { userId, role } = body;

  if (!userId || !role) return badRequest('userId and role are required');

  const validRoles = ['owner', 'admin', 'editor', 'viewer'];
  if (!validRoles.includes(role)) return badRequest(`role must be one of: ${validRoles.join(', ')}`);

  const { data, error } = await updateMemberRole(id, userId, role);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) return badRequest('userId query param is required');

  const { error } = await removeMember(id, userId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
