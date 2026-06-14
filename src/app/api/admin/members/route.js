import { ok, badRequest, forbidden, unauthorized, fromSupabaseError } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';
import { createClient } from '@/lib/supabase/server';

async function requireSuperadmin() {
  const { data: profile, error } = await getUserProfile();
  if (error) return { error: error.status === 401 ? unauthorized(error.message) : fromSupabaseError(error) };
  if (profile.role !== 'superadmin') return { error: forbidden('Superadmin access required') };
  return { profile };
}

export async function GET() {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, agency_id, agency:agency_id(id, name, slug)')
    .order('full_name');

  if (dbError) return fromSupabaseError(dbError);
  return ok(data);
}

export async function PATCH(request) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const { userId, role } = body;

  if (!userId || !role) return badRequest('userId and role are required');

  const validRoles = ['superadmin', 'manager', 'member'];
  if (!validRoles.includes(role)) return badRequest(`role must be one of: ${validRoles.join(', ')}`);

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();

  if (dbError) return fromSupabaseError(dbError);
  return ok(data);
}
