import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleConfigured, getRedirectUri, buildAuthUrl } from '@/lib/google/oauth';

// Kicks off the Google OAuth consent flow (full-page redirect).
export async function GET(request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/os/?meet=notconfigured', request.url));
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/os/login', request.url));

  const state = crypto.randomUUID();
  const url = buildAuthUrl(getRedirectUri(request), state);

  const res = NextResponse.redirect(url);
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600,
  });
  return res;
}
