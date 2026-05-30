import { createClient } from '@/lib/supabase/server';

export async function listForms(databaseId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('database_id', databaseId)
    .order('created_at');

  return { data, error };
}

export async function getForm(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('forms')
    .select('*, databases(id, workspace_id, name, database_properties(*))')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createForm({ databaseId, title = 'Untitled Form', description = null, config = {}, isPublic = true }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('forms')
    .insert({ database_id: databaseId, title, description, config, is_public: isPublic })
    .select()
    .single();

  return { data, error };
}

export async function updateForm(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.title       !== undefined) allowed.title       = updates.title;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (updates.config      !== undefined) allowed.config      = updates.config;
  if (updates.is_public   !== undefined) allowed.is_public   = updates.is_public;

  const { data, error } = await supabase
    .from('forms')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteForm(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('forms').delete().eq('id', id);
  return { error };
}

// Public submission — no auth required, enforced via RLS
export async function submitForm(formId, submittedData) {
  const supabase = await createClient();

  // Resolve the database this form belongs to
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('database_id, is_public, config, databases(database_properties(id, name, type, config))')
    .eq('id', formId)
    .single();

  if (formErr || !form) return { data: null, error: formErr || { message: 'Form not found' } };
  if (!form.is_public) return { data: null, error: { message: 'Form is not accepting submissions', status: 403 } };

  // Build cells: map property names → ids for known properties
  const properties = form.databases?.database_properties ?? [];
  const cells = {};
  properties.forEach((prop) => {
    if (submittedData[prop.id] !== undefined) {
      cells[prop.id] = submittedData[prop.id];
    } else if (submittedData[prop.name] !== undefined) {
      cells[prop.id] = submittedData[prop.name];
    }
  });

  // Create the database row
  const { data: row, error: rowErr } = await supabase
    .from('database_rows')
    .insert({ database_id: form.database_id, cells })
    .select()
    .single();

  if (rowErr) return { data: null, error: rowErr };

  // Record the submission
  const { data: submission, error: subErr } = await supabase
    .from('form_submissions')
    .insert({ form_id: formId, database_row_id: row.id, submitted_data: submittedData })
    .select()
    .single();

  return { data: { row, submission }, error: subErr };
}

export async function listSubmissions(formId, { limit = 100, offset = 0 } = {}) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('form_submissions')
    .select('*', { count: 'exact' })
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, error, count };
}
