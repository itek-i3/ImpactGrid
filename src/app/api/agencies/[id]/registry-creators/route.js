import { ok, forbidden, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Who created each record in this agency's Data Registry, as { [userId]: name }.
//
// Records made before "Registered by" existed carry no name of their own, so the
// registry falls back to whoever created the row (toig_business_registry.created_by).
// The names are resolved here with the admin client because RLS only lets a manager
// read profiles from their *home* agency — that misses admin-granted members and
// people who have since left. To keep that from becoming a general profile lookup it
// answers only for the registry's own audience (managers / superadmins who belong to
// the agency) and only for profiles that actually created a row in this agency.
export async function GET(_, { params }) {
  const { id: agencyId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return forbidden('Not authenticated');

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;

  const { data: me } = await admin.from('profiles').select('role, agency_id').eq('id', user.id).single();
  if (me?.role !== 'superadmin') {
    if (me?.role !== 'manager') return forbidden('Managers and admins only');
    const { data: membership } = await admin
      .from('agency_members')
      .select('user_id')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership && me?.agency_id !== agencyId) return forbidden('Not a member of this agency');
  }

  const { data: rows, error } = await admin
    .from('toig_business_registry')
    .select('created_by')
    .eq('agency_id', agencyId)
    .not('created_by', 'is', null);
  if (error) return fromSupabaseError(error);

  const ids = [...new Set((rows || []).map((r) => r.created_by))];
  if (ids.length === 0) return ok({});

  const { data: profiles, error: pErr } = await admin.from('profiles').select('id, full_name, email').in('id', ids);
  if (pErr) return fromSupabaseError(pErr);

  const names = {};
  (profiles || []).forEach((p) => {
    const name = (p.full_name || p.email || '').trim();
    if (name) names[p.id] = name;
  });
  return ok(names);
}
