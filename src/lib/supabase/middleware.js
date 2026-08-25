import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// De-dupes concurrent supabase.auth.getUser() calls that carry the exact
// same cookies. getUser() always round-trips to Supabase and can rotate the
// refresh token; a single page load fires several requests in parallel
// (profile, workspaces, pages, ...), each hitting this middleware, and
// independent calls race on the SAME refresh token — Supabase's reuse-
// detection then revokes the whole session as a precaution. Sharing one
// in-flight call per cookie state avoids the race instead of just retrying
// after the damage (a logged-out session) is already done. Module-level
// state is fine here: one Node process per dev server / server instance.
const inFlightAuthChecks = new Map();

function getUserDeduped(supabase, cookieKey) {
  if (!cookieKey) return supabase.auth.getUser();
  const existing = inFlightAuthChecks.get(cookieKey);
  if (existing) return existing;
  const promise = supabase.auth.getUser().finally(() => {
    inFlightAuthChecks.delete(cookieKey);
  });
  inFlightAuthChecks.set(cookieKey, promise);
  return promise;
}

/**
 * Refreshes the Supabase auth session on every request via middleware.
 * Redirects unauthenticated users away from protected routes.
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  // Skip auth if Supabase is not configured (demo mode)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not remove. Refreshes the auth token.
  // Wrapped because a transient network failure reaching Supabase's auth
  // server otherwise throws uncaught here and fails the request outright
  // (surfacing to the client as e.g. "Failed to fetch workspaces") — data
  // routes independently re-check auth via RLS, so failing open here only
  // affects the redirect-to-login UX, not actual authorization.
  let user = null;
  try {
    const { data } = await getUserDeduped(supabase, request.headers.get('cookie'));
    user = data.user;
  } catch (err) {
    console.error('[middleware] supabase.auth.getUser() failed —', err.message);
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/agencies') ||
    pathname.startsWith('/api/push/log') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  // Redirect to login if not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const scheme = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : proto;
    const origin = `${scheme}://${host}`;
    const redirectUrl = new URL('/os/login', origin);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to home if authenticated and trying to access auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const scheme = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : proto;
    const origin = `${scheme}://${host}`;
    return NextResponse.redirect(new URL('/os', origin));
  }

  return supabaseResponse;
}
