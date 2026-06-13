import { ok, fromSupabaseError } from '@/lib/api/response';
import { listAgencies } from '@/lib/db/agencies';

export async function GET() {
  const { data, error } = await listAgencies();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
