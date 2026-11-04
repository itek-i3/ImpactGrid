'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Video, X, BarChart3 } from 'lucide-react';
import SessionWidget from './SessionWidget';
import SessionModal from './SessionModal';
import { useSessionStore } from '@/lib/store/useSessionStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { applyAllPrefs } from '@/app/customize/page';
import { createClient } from '@/lib/supabase/client';
import { playMessageSound, playSessionCompleteSound } from '@/lib/utils/soundEffects';
import { isDmParticipant, buildDmChannel } from '@/lib/chat/dmChannels';
import { writeReceipt } from '@/lib/chat/receipts';
import { fetchUnreadChannels } from '@/lib/chat/unreadState';

const LS_KEY = 'impactgrid-session';

// Meetings fire a reminder the moment they start; this is the window (ms) after
// the start time during which a still-unreminded meeting will trigger.
const REMINDER_GRACE_MS = 5 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// VAPID public key (base64url) → Uint8Array, required by pushManager.subscribe.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// A pasted Meet link without a scheme is treated as relative — force https://.
function withScheme(url) {
  const s = (url || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
}

// The occurrence start (ms) that is "due" right now for a meeting, else null.
// Handles weekly recurrence by rolling the original start forward in 7-day steps.
function dueOccurrence(meeting, now) {
  const start = new Date(meeting.starts_at).getTime();
  if (isNaN(start)) return null;
  if (meeting.recurrence === 'weekly' && now >= start) {
    const weeks = Math.floor((now - start) / WEEK_MS);
    const occ = start + weeks * WEEK_MS;
    return now >= occ && now < occ + REMINDER_GRACE_MS ? occ : null;
  }
  return now >= start && now < start + REMINDER_GRACE_MS ? start : null;
}

function restoreFromStorage() {
  const current = useSessionStore.getState().session;
  if (current && current.status !== 'completed') return;

  const win = typeof window !== 'undefined' ? window.__igSession : null;
  if (win?.status && win.status !== 'completed') {
    if (win.status === 'active' && win.endTime <= Date.now()) win.status = 'expired';
    useSessionStore.setState({ session: win });
    return;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved?.status || saved.status === 'completed') return;
    if (saved.status === 'active' && saved.endTime <= Date.now()) saved.status = 'expired';
    useSessionStore.setState({ session: saved });
  } catch {}
}

export default function SessionProvider() {
  const router = useRouter();
  const { sessionModalOpen, closeSessionModal, rearmSW, session, fetchTeamSessions, acknowledgeInvite, cancelSession } = useSessionStore();
  
  // Workspace and profile status from global store
  const userId = useWorkspaceStore((s) => s.userProfile?.id);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const isDemo = useWorkspaceStore((s) => s.isDemo);
  const activeChatChannel = useWorkspaceStore((s) => s.activeChatChannel);
  const addChatNotification = useWorkspaceStore((s) => s.addChatNotification);
  const addMeetingNotification = useWorkspaceStore((s) => s.addMeetingNotification);
  const agencyId = useWorkspaceStore((s) => s.workspace?.agency_id || s.activeAgencyId || s.userProfile?.agency_id || null);

  const workspaceId = workspace?.id;

  // Local state to keep track of workspace members for display names in notifications
  const [members, setMembers] = useState([]);
  // Meeting reminders currently showing as an in-app banner.
  const [dueReminders, setDueReminders] = useState([]);

  // Watch preferences and load preferences when user ID is known
  useEffect(() => {
    if (!userId) return;
    applyAllPrefs(userId);
  }, [userId]);

  // Restore active focus session from storage and re-arm SW
  useEffect(() => {
    restoreFromStorage();
    rearmSW();

    const onVisible = () => {
      if (document.visibilityState === 'visible') restoreFromStorage();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pop the Sessions modal open when arriving from a "you were invited to a
  // focus session" push notification (see /api/sessions's notifyInvitees —
  // the notification links to ?openSessions=1). Plain DOM/URL access rather
  // than useSearchParams, since that needs a Suspense boundary and this only
  // needs to run once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('openSessions') !== '1') return;
    useSessionStore.getState().openSessionModal();
    params.delete('openSessions');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, []);

  // ── 1. Focus Session Expiration Sound & Notification ────────────────────────
  const sessionStatus = session?.status;
  const prevStatusRef = useRef(sessionStatus);

  useEffect(() => {
    if (sessionStatus === 'expired' && prevStatusRef.current === 'active') {
      const LS_SOUND_KEY = 'impactgrid-session-sound-played';
      const lastPlayed = localStorage.getItem(LS_SOUND_KEY);
      const now = Date.now();
      
      // Prevent sound double play across multiple open tabs
      if (!lastPlayed || now - parseInt(lastPlayed, 10) > 5000) {
        localStorage.setItem(LS_SOUND_KEY, now.toString());
        playSessionCompleteSound();
        
        // Desktop notification from the main thread if allowed and document is visible
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification("Time's up!", {
            body: session?.taskDescription 
              ? `"${session.taskDescription}" — your focus session is complete.` 
              : 'Your focus session is complete.',
            icon: '/os/app-icon-512.png',
            tag: 'session-complete',
            requireInteraction: true,
          });
        }
      }
    }
    prevStatusRef.current = sessionStatus;
  }, [sessionStatus, session?.taskDescription]);

  // ── 1b. Team Sessions: keep the sidebar's live-count badge accurate ──────────
  // `teamSessions` otherwise only gets fetched while the Sessions modal is open
  // (see SessionModal), so a teammate's session never shows up anywhere — not
  // even as the sidebar badge — until someone has opened that modal at least
  // once, and it goes stale again the moment it's closed. Poll here instead,
  // for the lifetime of the app, independent of the modal.
  useEffect(() => {
    if (!workspaceId) return;
    fetchTeamSessions(workspaceId);
    const t = setInterval(() => fetchTeamSessions(workspaceId), 20_000);
    return () => clearInterval(t);
  }, [workspaceId, fetchTeamSessions]);

  // ── 2. Load Workspace Members (to resolve display names) ────────────────────
  useEffect(() => {
    if (!workspaceId || isDemo) return;

    let active = true;
    fetch(`/os/api/workspaces/${workspaceId}/chat-members`)
      .then((res) => res.json())
      .then((j) => {
        if (active && j.data) setMembers(j.data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [workspaceId, isDemo]);

  // ── 2b. Seed real unread state on load ───────────────────────────────────────
  // The realtime listener below only catches messages that arrive while this tab
  // is open. On a fresh load there may already be unread messages from before —
  // fetch those from chat_reads/chat_messages so the Messages widget isn't empty
  // just because nothing happened to arrive live this session.
  useEffect(() => {
    if (!userId || !workspaceId || isDemo || members.length === 0) return;
    let cancelled = false;
    (async () => {
      const unread = await fetchUnreadChannels(userId, workspaceId);
      if (cancelled) return;
      await Promise.all(unread.map(async ({ channel, message, senderId, messageId }) => {
        const sender = members.find((m) => m.id === senderId);
        let senderName = sender?.full_name || sender?.email || '';
        // Sender may not be in `members` — RLS only lets a plain member see their
        // own profile row directly, so a DM partner outside normal agency
        // membership (e.g. a superadmin) won't resolve from the client-side
        // members list. Fall back to the chat API, which resolves names
        // server-side with the admin client.
        if (!senderName && messageId) {
          try {
            const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${encodeURIComponent(channel)}&messageId=${messageId}`);
            if (res.ok) { const m = (await res.json()).data?.[0]; if (m?.userName) senderName = m.userName; }
          } catch (_) {}
        }
        if (cancelled) return;
        addChatNotification(channel, {
          senderName: senderName || 'Someone',
          message,
          isDm: channel.startsWith('dm:'),
        });
      }));
    })();
    return () => { cancelled = true; };
  }, [userId, workspaceId, isDemo, members, addChatNotification]);

  // ── 3. Global Realtime Direct Messages Subscription ──────────────────────────
  useEffect(() => {
    if (!workspaceId || !userId || isDemo) return;

    const sb = createClient();
    const notifCh = sb.channel(`global-notif:${workspaceId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `workspace_id=eq.${workspaceId}` }, async (payload) => {
        const row = payload.new;
        
        // Ignore our own messages
        if (row.user_id === userId) return;

        // DMs should only notify the actual participants.
        if (row.channel?.startsWith('dm:') && !isDmParticipant(row.channel, userId)) return;

        // The message reached this recipient's app → mark it delivered so the
        // sender sees two grey ticks even if this DM isn't currently open. If
        // they're actively viewing it, ChatClient will upgrade this to "read".
        if (row.channel?.startsWith('dm:')) writeReceipt(row.channel, userId, { read: false });

        // Skip notifying if the user is actively viewing this specific channel in a visible tab
        const isViewingChannel = row.channel === activeChatChannel && document.visibilityState === 'visible';
        if (isViewingChannel) return;

        // Resolve who sent it. Prefer the loaded members list; if the sender
        // isn't there (members not loaded yet, or a cross-agency member), fall
        // back to the chat API which resolves names via admin — so a real member
        // is never shown as "Someone".
        const sender = members.find((m) => m.id === row.user_id);
        let senderName = sender?.full_name || sender?.email || '';
        if (!senderName) {
          try {
            const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${encodeURIComponent(row.channel)}&messageId=${row.id}`);
            if (res.ok) { const m = (await res.json()).data?.[0]; if (m?.userName) senderName = m.userName; }
          } catch (_) {}
        }
        if (!senderName) senderName = 'Someone';
        addChatNotification(row.channel, {
          senderName,
          message: row.message,
          isDm: row.channel?.startsWith('dm:'),
        });

        // Deduplicate notifications/sounds across multiple open tabs
        const msgKey = `msg-notif-${row.id}`;
        const lastNotified = localStorage.getItem(msgKey);
        const now = Date.now();

        if (!lastNotified) {
          localStorage.setItem(msgKey, now.toString());

          // Periodically clean up old message notification keys in localStorage
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('msg-notif-')) {
                const val = localStorage.getItem(k);
                if (val && now - parseInt(val, 10) > 60000) {
                  localStorage.removeItem(k);
                }
              }
            }
          } catch (_) {}

          // Play custom YouTube-like ping sound
          playMessageSound();

          // Show desktop notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const isDmCh = row.channel?.startsWith('dm:');
            
            const GROUP_CHANNELS = [
              { id: 'daily_tasks',  name: 'Daily Tasks' },
              { id: 'weekly_tasks', name: 'Weekly Tasks' },
              { id: 'random',       name: 'Random' },
            ];
            const chObj = GROUP_CHANNELS.find((c) => c.id === row.channel);
            const title = isDmCh ? senderName : `${senderName} · #${chObj?.name || row.channel}`;

            const notif = new Notification(title, {
              body: row.message,
              icon: '/os/app-icon-512.png',
              tag: row.channel,
              renotify: true,
            });

            notif.onclick = () => {
              window.focus();
              router.push(`/chat?workspaceId=${workspaceId}&channel=${encodeURIComponent(row.channel)}`);
              notif.close();
            };
          }
        }
      })
      .subscribe();

    return () => {
      sb.removeChannel(notifCh);
    };
  }, [workspaceId, userId, isDemo, members, activeChatChannel, router, addChatNotification]);

  // ── 4. Ask once for desktop-notification permission + restore saved reminders ─
  useEffect(() => {
    useWorkspaceStore.getState().hydrateMeetingNotifs();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch (_) {}
    }
  }, []);

  // ── 4b. Service worker + Web Push ────────────────────────────────────────
  // The SW registers unconditionally — Chrome's "Install app" prompt requires
  // an active service worker, independent of whether notification permission
  // has been granted (or even asked for). Push subscription is the part that
  // stays gated behind permission.
  useEffect(() => {
    if (isDemo || !userId) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        // Scope must be "/os" (matching the manifest's start_url exactly) not
        // "/os/" — Chrome's install check requires the SW's scope to cover
        // start_url, and "/os" doesn't fall under a "/os/" scope by prefix
        // rules. next.config.mjs sends Service-Worker-Allowed: /os so the
        // browser permits widening scope beyond the script's own directory.
        let reg = null;
        try { reg = await navigator.serviceWorker.register('/os/session-sw.js', { scope: '/os' }); } catch (_) {}
        if (!reg || cancelled) return;
        await navigator.serviceWorker.ready;

        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid || !('PushManager' in window)) return; // push not configured/supported — SW is still registered for installability
        if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (_) {} }
        if (Notification.permission !== 'granted') return;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
        }
        if (cancelled || !sub) return;
        await fetch('/os/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) });
      } catch (_) { /* push unsupported / blocked — silent */ }
    })();
    return () => { cancelled = true; };
  }, [userId, isDemo]);

  // ── 4c. Navigate when a notification is clicked ──────────────────────────────
  // The service worker's own client.navigate() attempt isn't reliably supported
  // everywhere; this is the guaranteed fallback via the app's own router.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_NAVIGATE' && event.data.url) {
        router.push(event.data.url.replace(/^\/os(?=\/|$)/, '') || '/');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  // ── 5. Meeting reminders — fire the moment a meeting I'm part of starts ──────
  useEffect(() => {
    const uid = userId || (isDemo ? 'demo-current-user' : null);
    if (!uid) return;
    if (!isDemo && !agencyId) return;

    let cancelled = false;
    const demoKey = agencyId ? `demo-meetings-${agencyId}` : 'demo-meetings';

    const loadMeetings = async () => {
      if (isDemo) {
        try { const raw = localStorage.getItem(demoKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
      }
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data } = await createClient().from('meetings').select('*').eq('agency_id', agencyId).gte('ends_at', since);
      return data || [];
    };

    const fire = (m, occ) => {
      const key = `mtg-reminded-${m.id}-${occ}`;
      try {
        if (localStorage.getItem(key)) return; // reminded already (also dedups across tabs / re-checks)
        localStorage.setItem(key, String(Date.now()));
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mtg-reminded-')) { const v = localStorage.getItem(k); if (v && now - parseInt(v, 10) > 3 * 60 * 60 * 1000) localStorage.removeItem(k); }
        }
      } catch (_) {}

      playMessageSound();

      const link = withScheme(m.meet_link);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('Meeting starting now', {
          body: m.title || 'You have a meeting now.',
          icon: '/os/app-icon-512.png',
          tag: `meeting-${m.id}-${occ}`,
          requireInteraction: true,
        });
        notif.onclick = () => { window.focus(); if (link) window.open(link, '_blank', 'noopener'); notif.close(); };
      }

      setDueReminders((prev) => (prev.some((r) => r.key === key) ? prev : [...prev, { key, id: m.id, title: m.title || 'Meeting', at: occ, meetLink: link }]));
      addMeetingNotification(key, { id: m.id, title: m.title || 'Meeting', at: occ, meetLink: link });
    };

    const check = async () => {
      const list = await loadMeetings();
      if (cancelled) return;
      const now = Date.now();
      list.forEach((m) => {
        const mine = m.created_by === uid || (Array.isArray(m.attendee_ids) && m.attendee_ids.includes(uid));
        if (!mine) return;
        const occ = dueOccurrence(m, now);
        if (occ != null) fire(m, occ);
      });
    };

    check();
    const timer = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [userId, isDemo, agencyId, addMeetingNotification]);

  const dismissReminder = (key) => setDueReminders((prev) => prev.filter((r) => r.key !== key));

  // Who invited me — approximated as the first other member of the group,
  // which is exact for the common 2-person case. Rows don't record a
  // separate "started by" field, only who else shares the group_id.
  const inviter = session?.invitePending ? (session.groupMembers?.[0] || null) : null;
  const inviterName = inviter?.full_name || inviter?.email || 'A teammate';
  const inviteDmChannel = inviter?.id && agencyId && userId ? buildDmChannel(agencyId, userId, inviter.id) : null;
  const declineInvite = () => cancelSession();

  return (
    <>
      <SessionWidget />
      <SessionModal isOpen={sessionModalOpen} onClose={closeSessionModal} />

      {(dueReminders.length > 0 || session?.invitePending) && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'calc(100vw - 32px)' }}>
          {session?.invitePending && (
            <div className="ig-reminder" style={{ width: 400, maxWidth: '100%', background: 'rgba(8,14,30,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', padding: 16, color: '#E2EEFF', position: 'relative', overflow: 'hidden' }}>
              <button onClick={acknowledgeInvite} title="Dismiss" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#6C82A3', cursor: 'pointer', padding: 2, display: 'flex', zIndex: 1 }}><X size={15} /></button>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: '#306CEC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart3 size={18} color="#fff" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 16 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 800 }}>{inviterName}</span> invited you to a focus session
                      </div>
                      {session.taskDescription && (
                        <div style={{ fontSize: 11.5, color: '#8FB4E8', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          &ldquo;{session.taskDescription}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={acknowledgeInvite} style={{ flex: 1, height: 34, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                    <button onClick={declineInvite} style={{ flex: 1, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#E2EEFF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                  </div>
                  {inviteDmChannel && (
                    <a
                      href={`/os/chat?workspaceId=${workspaceId}&channel=${encodeURIComponent(inviteDmChannel)}`}
                      onClick={acknowledgeInvite}
                      style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#6C82A3', textDecoration: 'none' }}
                    >
                      Write message.
                    </a>
                  )}
                </div>

                {/* Decorative laptop + popup — purely illustrative, hidden from screen readers */}
                <svg aria-hidden="true" width="92" height="96" viewBox="0 0 92 96" style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: -16, marginRight: -8 }}>
                  <line x1="8" y1="18" x2="14" y2="10" stroke="#306CEC" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="6" y1="30" x2="15" y2="27" stroke="#306CEC" strokeWidth="2.5" strokeLinecap="round" />
                  <rect x="30" y="8" width="56" height="62" rx="4" fill="#0F172A" stroke="#2A3A5C" strokeWidth="1.5" />
                  <rect x="18" y="70" width="80" height="7" rx="3.5" fill="#1A2744" />
                  <rect x="40" y="38" width="36" height="24" rx="6" fill="#F3F6FC" />
                  <rect x="45" y="44" width="12" height="12" rx="3" fill="#306CEC" />
                  <rect x="48.5" y="47.5" width="2" height="5" fill="#fff" />
                  <rect x="51.5" y="49.5" width="2" height="3" fill="#fff" />
                  <rect x="60" y="46" width="13" height="2.4" rx="1.2" fill="#C7D1E3" />
                  <rect x="60" y="51" width="9" height="2.4" rx="1.2" fill="#DCE3F0" />
                  <circle cx="72.5" cy="46.2" r="2.4" fill="#306CEC" />
                </svg>
              </div>
            </div>
          )}
          {dueReminders.map((r) => (
            <div key={r.key} className="ig-reminder" style={{ width: 320, maxWidth: '100%', background: 'rgba(8,14,30,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', padding: 14, color: '#E2EEFF' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(34,197,94,0.16)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={17} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7EB3FF', textTransform: 'uppercase', letterSpacing: '.05em' }}>Meeting starting now</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: '#8FB4E8', marginTop: 1 }}>{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <button onClick={() => dismissReminder(r.key)} title="Dismiss" style={{ background: 'none', border: 'none', color: '#6C82A3', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {r.meetLink && (
                  <a href={r.meetLink} target="_blank" rel="noreferrer" onClick={() => dismissReminder(r.key)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}><Video size={13} /> Join Meet</a>
                )}
                <button onClick={() => dismissReminder(r.key)} style={{ flex: r.meetLink ? '0 0 auto' : 1, padding: '0 14px', height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#9DB8DD', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
              </div>
            </div>
          ))}
          <style jsx>{`
            .ig-reminder { animation: igReminderIn 0.18s ease; }
            @keyframes igReminderIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
          `}</style>
        </div>
      )}
    </>
  );
}
