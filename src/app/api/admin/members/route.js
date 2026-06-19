import { ok, created, noContent, badRequest, forbidden, unauthorized, fromSupabaseError } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';
import { addAgencyMember, removeAgencyMember } from '@/lib/db/agencies';
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

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, agency_id, agency:agency_id(id, name, slug)')
    .order('full_name');

  if (profilesErr) return fromSupabaseError(profilesErr);

  // Try agency_members — falls back gracefully if table doesn't exist yet
  const byUser = {};
  try {
    const { data: memberships, error: memErr } = await supabase
      .from('agency_members')
      .select('user_id, agency_id, agency:agency_id(id, name, slug)');

    if (!memErr && memberships) {
      memberships.forEach((m) => {
        if (!byUser[m.user_id]) byUser[m.user_id] = [];
        byUser[m.user_id].push({ id: m.agency_id, name: m.agency?.name, slug: m.agency?.slug });
      });
    }
  } catch (_) {}

  const data = (profiles || []).map((p) => ({
    ...p,
    // Fall back to profile.agency if no agency_members yet
    agencyMemberships: byUser[p.id] || (p.agency ? [{ id: p.agency_id, name: p.agency.name }] : []),
  }));

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

export async function POST(request) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const { userId, agencyId, role = 'member' } = body;
  if (!userId || !agencyId) return badRequest('userId and agencyId are required');

  const { data, error: dbError } = await addAgencyMember(agencyId, userId, role);
  if (dbError) return fromSupabaseError(dbError);
  return created(data);
}

export async function DELETE(request) {
  const { error } = await requireSuperadmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const agencyId = searchParams.get('agencyId');
  if (!userId || !agencyId) return badRequest('userId and agencyId are required');

  const { error: dbError } = await removeAgencyMember(agencyId, userId);
  if (dbError) return fromSupabaseError(dbError);
  return noContent();
}
