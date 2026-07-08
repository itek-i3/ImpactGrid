// Server-only helpers for the Google Calendar / Meet integration.
// Uses plain fetch against Google's OAuth + Calendar REST APIs (no extra deps).
import { createAdminClient } from '@/lib/supabase/server';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// calendar.events → create/delete events with Meet; email/openid → show which account is connected.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// The redirect URI must exactly match one registered in the Google Cloud console.
// Defaults to <origin>/os/api/google/callback; override with GOOGLE_REDIRECT_URI.
export function getRedirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${new URL(request.url).origin}/os/api/google/callback`;
}

export function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',   // get a refresh_token
    prompt: 'consent',        // force refresh_token on re-connect
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

// Best-effort email from the id_token payload (display only — not a trust boundary).
export function emailFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString()).email || null;
  } catch { return null; }
}

// Returns a currently-valid access token for the user, refreshing + persisting if needed.
export async function getValidAccessToken(userId) {
  const admin = createAdminClient();
  const { data: cred } = await admin
    .from('google_credentials').select('*').eq('user_id', userId).maybeSingle();
  if (!cred?.refresh_token) return null;

  const fresh = cred.access_token && cred.token_expiry
    && new Date(cred.token_expiry).getTime() - 60000 > Date.now();
  if (fresh) return cred.access_token;

  const refreshed = await refreshAccessToken(cred.refresh_token);
  const expiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
  await admin.from('google_credentials')
    .update({ access_token: refreshed.access_token, token_expiry: expiry, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  return refreshed.access_token;
}

// Creates a Calendar event with a Google Meet conference and emails invites.
// recurrence 'weekly' → one recurring event/series (single Meet link for all weeks).
export async function createMeetEvent(accessToken, { title, description, startsAt, endsAt, attendeeEmails, recurrence }) {
  const body = {
    summary: title,
    description: description || undefined,
    start: { dateTime: startsAt },
    end: { dateTime: endsAt },
    attendees: (attendeeEmails || []).filter(Boolean).map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
  if (recurrence === 'weekly') body.recurrence = ['RRULE:FREQ=WEEKLY'];
  const res = await fetch(`${CALENDAR_EVENTS}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google event create failed: ${await res.text()}`);
  const ev = await res.json();
  const meetLink = ev.hangoutLink
    || ev.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
    || null;
  return { eventId: ev.id, meetLink, htmlLink: ev.htmlLink || null };
}

export async function deleteMeetEvent(accessToken, eventId) {
  await fetch(`${CALENDAR_EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}
