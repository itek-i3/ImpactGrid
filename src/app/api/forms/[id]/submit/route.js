import { created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { submitForm } from '@/lib/db/forms';

// Public endpoint — no auth required, enforced via Supabase RLS
export async function POST(request, { params }) {
  const { id: formId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return badRequest('Submission data is required');
  }

  const { data, error } = await submitForm(formId, body);
  if (error) return fromSupabaseError(error);
  return created(data);
}
