import { ok, unauthorized, fromSupabaseError } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';

export async function GET() {
  const { data, error } = await getUserProfile();
  if (error) {
    if (error.status === 401) return unauthorized(error.message);
    return fromSupabaseError(error);
  }
  return ok(data);
}
