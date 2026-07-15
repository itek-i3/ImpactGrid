'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Video, X } from 'lucide-react';
import SessionWidget from './SessionWidget';
import SessionModal from './SessionModal';
import { useSessionStore } from '@/lib/store/useSessionStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { applyAllPrefs } from '@/app/customize/page';
import { createClient } from '@/lib/supabase/client';
import { playMessageSound, playSessionCompleteSound } from '@/lib/utils/soundEffects';
import { isDmParticipant } from '@/lib/chat/dmChannels';
import { writeReceipt } from '@/lib/chat/receipts';

const LS_KEY = 'impactgrid-session';

// Meetings fire a reminder the moment they start; this is the window (ms) after
// the start time during which a still-unreminded meeting will trigger.
const REMINDER_GRACE_MS = 5 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  const { sessionModalOpen, closeSessionModal, rearmSW, session } = useSessionStore();
  
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
            icon: '/logo3.png',
            tag: 'session-complete',
            requireInteraction: true,
          });
        }
      }
    }
    prevStatusRef.current = sessionStatus;
  }, [sessionStatus, session?.taskDescription]);

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

  // ── 3. Global Realtime Direct Messages Subscription ──────────────────────────
  useEffect(() => {
    if (!workspaceId || !userId || isDemo) return;

    const sb = createClient();
    const notifCh = sb.channel(`global-notif:${workspaceId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
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

        // Resolve who sent it so the bell can show the sender + a preview.
        const sender = members.find((m) => m.id === row.user_id);
        const senderName = sender?.full_name || sender?.email || 'Someone';
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
              icon: '/logo3.png',
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
          icon: '/logo3.png',
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

  return (
    <>
      <SessionWidget />
      <SessionModal isOpen={sessionModalOpen} onClose={closeSessionModal} />

      {dueReminders.length > 0 && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'calc(100vw - 32px)' }}>
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
