import { clientForUser } from './clientForUser';

const COLS = 'id, agency_id, created_by, business_name, total, evaluated_count, payload, created_at, updated_at';

// Reshape a DB row into the client-side evaluation object the panel expects.
function toClient(row) {
  const payload = row.payload || {};
  return {
    ...payload,
    id:             row.id,
    businessName:   payload.businessName   ?? row.business_name,
    total:          payload.total          ?? row.total,
    evaluatedCount: payload.evaluatedCount ?? row.evaluated_count,
    savedAt:        payload.savedAt        ?? row.created_at,
    createdBy:      row.created_by,
  };
}

// Build the DB row (structured columns + full payload) from a client evaluation.
function toRow(agencyId, evaluation) {
  const payload = { ...evaluation };
  delete payload.id; // id lives in its own column
  return {
    agency_id:       agencyId,
    business_name:   String(evaluation.businessName || '').slice(0, 300),
    total:           Number.isFinite(evaluation.total) ? evaluation.total : 0,
    evaluated_count: Number.isFinite(evaluation.evaluatedCount) ? evaluation.evaluatedCount : 0,
    payload,
  };
}

export async function listAcquisitions(agencyId) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { data: [], error: { message: 'Not authenticated', status: 401 } };

  const { data, error } = await supabase
    .from('acquisition_evaluations')
    .select(COLS)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: (data || []).map(toClient), error: null };
}

// Insert a new evaluation, or update an existing one when evaluation.id is set.
export async function saveAcquisition(agencyId, evaluation) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { data: null, error: { message: 'Not authenticated', status: 401 } };

  const row = toRow(agencyId, evaluation);

  if (evaluation.id) {
    const { data, error } = await supabase
      .from('acquisition_evaluations')
      .update(row)
      .eq('id', evaluation.id)
      .eq('agency_id', agencyId)
      .select(COLS)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') return { data: null, error };
    if (data) return { data: toClient(data), error: null };
    // Row no longer exists (e.g. deleted elsewhere) — fall through to insert.
  }

  const { data, error } = await supabase
    .from('acquisition_evaluations')
    .insert({ ...row, created_by: userId })
    .select(COLS)
    .single();

  return { data: data ? toClient(data) : null, error };
}

export async function deleteAcquisition(agencyId, id) {
  const { supabase, userId } = await clientForUser();
  if (!userId) return { error: { message: 'Not authenticated', status: 401 } };

  const { error } = await supabase
    .from('acquisition_evaluations')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId);

  return { error };
}
