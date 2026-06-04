import { NextResponse } from 'next/server';

export function ok(data, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created(data) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(err) {
  console.error('[API Error]', err);
  const message = err?.message ?? 'Internal server error';
  const status  = err?.status ?? 500;
  return NextResponse.json({ error: message }, { status });
}

// Translates a Supabase error into an appropriate HTTP response
export function fromSupabaseError(error) {
  if (!error) return null;
  if (error.status) return serverError(error);
  // PGRST116 = no rows found
  if (error.code === 'PGRST116') return notFound();
  // 23505 = unique violation
  if (error.code === '23505') return NextResponse.json({ error: 'Conflict: resource already exists' }, { status: 409 });
  // 42501 = insufficient privilege (RLS)
  if (error.code === '42501') return forbidden('Insufficient permissions');
  return serverError(error);
}
