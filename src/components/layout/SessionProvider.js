'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

  const workspaceId = workspace?.id;

  // Local state to keep track of workspace members for display names in notifications
  const [members, setMembers] = useState([]);

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

        addChatNotification(row.channel);

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
            const sender = members.find((m) => m.id === row.user_id);
            const senderName = sender?.full_name || sender?.email || 'Someone';
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

  return (
    <>
      <SessionWidget />
      <SessionModal isOpen={sessionModalOpen} onClose={closeSessionModal} />
    </>
  );
}
