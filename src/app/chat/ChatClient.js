'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageSquare, Lock, Smile, Search, Check, CheckCheck, Pencil, Trash2, X, Forward, ChevronLeft, AtSign } from 'lucide-react';
import { buildDmChannel, parseDmChannel, isDmParticipant } from '@/lib/chat/dmChannels';
import { writeReceipt } from '@/lib/chat/receipts';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import styles from '@/styles/layout.module.css';

// A user is "online" if their last heartbeat landed within this window.
// Clients beat every 25s, so 60s tolerates a missed beat / slow network.
const ONLINE_WINDOW_MS = 60 * 1000;

// WhatsApp-style: a line that starts with "- " (or "* ") becomes a "• " bullet.
const pointifyBullets = (text) => text.replace(/(^|\n)[-*] /g, '$1• ');

// WhatsApp-style unread-count badge shown beside a conversation.
const UNREAD_BADGE = { flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#22C55E', color: '#052e16', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' };

// "@all" — a special mention that pings everyone in the conversation.
const ALL_MENTION = { id: '__all__', label: 'Everyone', token: 'all', role: 'Notify everyone in this chat', __all: true };

function ChatContent() {
  const searchParams = useSearchParams();
  const targetWorkspaceId = searchParams.get('workspaceId');

  const { workspace, fetchUserProfile, loadWorkspace, initDemoWorkspace, userProfile, isDemo, activeAgencyId, setActiveChatChannel, clearChatNotifications, chatNotifs } = useWorkspaceStore();

  const urlChannel = searchParams.get('channel') || 'daily_tasks';
  const [activeChannel, setActiveChannel] = useState(urlChannel);
  // Follow the URL's channel param when it changes, while still allowing manual
  // channel switches — adjust during render (React's documented pattern) instead
  // of in an effect.
  const [prevUrlChannel, setPrevUrlChannel] = useState(urlChannel);
  if (urlChannel !== prevUrlChannel) {
    setPrevUrlChannel(urlChannel);
    setActiveChannel(urlChannel);
  }
  const isMobile = useIsMobile();
  const [mobileChatOpen, setMobileChatOpen] = useState(false); // on phones: false = show list, true = show the conversation
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // @mentions (WhatsApp-style): a picker that pops up when you type "@".
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(null); // index of the "@" in inputText
  const [mentionIdx, setMentionIdx] = useState(0);
  const [agencyMembers, setAgencyMembers] = useState([]);
  const [reactions, setReactions] = useState({});
  const [reactOpen, setReactOpen] = useState(null);
  const [reactPos, setReactPos] = useState({ top: 0, left: 0 });
  const [panelSearch, setPanelSearch] = useState('');
  const [lastMessages, setLastMessages] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [hoverMsgId, setHoverMsgId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Forwarding: the message being forwarded + the picker's search + a transient confirmation
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardToast, setForwardToast] = useState('');
  // Read receipts for the active DM: the *other* participant's last read/delivered times.
  const [partnerReceipt, setPartnerReceipt] = useState({ lastReadAt: null, lastDeliveredAt: null });
  // Online presence: last_seen_at map (for "last seen"), the set of online user
  // ids, and the timestamp both were computed at (kept in state so render stays
  // pure — no Date.now() during render).
  const [presence, setPresence] = useState({});
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [presenceAt, setPresenceAt] = useState(0);
  // Clear the partner's ticks the moment we switch conversations (adjust during
  // render, same documented pattern as prevUrlChannel above).
  const [receiptChannel, setReceiptChannel] = useState(activeChannel);
  if (receiptChannel !== activeChannel) {
    setReceiptChannel(activeChannel);
    setPartnerReceipt({ lastReadAt: null, lastDeliveredAt: null });
  }
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const editRef = useRef(null);
  const emojiRef = useRef(null);
  const dmBcastRef = useRef(null);
  const workspaceIdRef = useRef(null);
  // Always holds the latest partner-receipt refresher so the broadcast handler
  // (subscribed once per channel) can call it without stale-closure issues.
  const refreshReceiptRef = useRef(() => {});

  const GROUP_CHANNELS = [
    { id: 'daily_tasks',  name: 'Daily Tasks',  icon: '📋', desc: 'Daily team updates',   managerOnly: false },
    { id: 'weekly_tasks', name: 'Weekly Tasks', icon: '📅', desc: 'Weekly planning',       managerOnly: false, postManagerOnly: true },
    { id: 'random',       name: 'Random',        icon: '💬', desc: 'Off-topic chat',        managerOnly: false },
  ];

  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const isDm = activeChannel.startsWith('dm:');
  const dmMeta = isDm ? parseDmChannel(activeChannel) : null;
  const dmPartnerId = isDm ? (dmMeta?.participants?.find(p => p !== currentUserId) || null) : null;

  // Pure online check — `onlineIds` is precomputed off-render (in the presence
  // poll) so render never calls Date.now(). Demo mode fakes everyone online.
  const isUserOnline = (uid) => Boolean(uid) && (isDemo || onlineIds.has(uid));
  const canPost = isDm
    ? Boolean(dmMeta?.participants?.includes(currentUserId))
    : !GROUP_CHANNELS.find(c => c.id === activeChannel)?.postManagerOnly || ['manager', 'superadmin'].includes(userProfile?.role);

  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      if (profile) await loadWorkspace(targetWorkspaceId || undefined);
      else initDemoWorkspace();
    }
    init();
  }, [targetWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      const mockMembers = [
        { id: 'admin-1', full_name: 'System Administrator', role: 'superadmin', email: 'admin@example.com' },
        { id: 'manager-1', full_name: 'John Doe', role: 'manager', email: 'john@example.com' },
        { id: 'member-1', full_name: 'Alice Smith', role: 'member', email: 'alice@example.com' },
      ];
      if (isDemo) { if (!cancelled) setAgencyMembers(mockMembers); return; }
      const wsId = workspace?.id;
      if (!wsId || !userProfile) return;
      if (!cancelled) setAgencyMembers([]);
      try {
        const res = await fetch(`/os/api/workspaces/${wsId}/chat-members`);
        if (res.ok) {
          const j = await res.json();
          if (j.data?.length && !cancelled) setAgencyMembers(j.data);
        }
      } catch (_) {}
    }
    loadMembers();
    return () => { cancelled = true; };
  }, [workspace?.id, userProfile, isDemo]);

  useEffect(() => {
    if (!emojiOpen) return;
    const h = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [emojiOpen]);

  useEffect(() => {
    if (!reactOpen) return;
    const h = (e) => { if (!e.target.closest('[data-react]')) setReactOpen(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [reactOpen]);

  // workspace.agency_id is ground truth; activeAgencyId is the early fallback set by fetchUserProfile
  // DM channel encodes agency so messages never bleed between agencies.
  // Returns null when agencyId isn't resolved yet — callers must guard against null.
  const getDmId = (otherId) => {
    if (!agencyId || !currentUserId || !otherId) return null;
    return buildDmChannel(agencyId, currentUserId, otherId);
  };
  const otherMembers = agencyMembers.filter(m => m.id !== currentUserId);
  const [notifPermission, setNotifPermission] = useState(
    () => (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default'
  );

  // Request notification permission if not yet decided
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  // Sync the active channel with the global store so SessionProvider knows when to silence notifications
  useEffect(() => {
    setActiveChatChannel(activeChannel);
    if (activeChannel) {
      clearChatNotifications(activeChannel);
    }
    return () => {
      setActiveChatChannel(null);
    };
  }, [activeChannel, setActiveChatChannel, clearChatNotifications]);

  // Keep workspaceIdRef current so broadcast handler never captures a stale value
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  // DM real-time: broadcast on the DM channel name itself so both users connect
  // to the same Supabase channel regardless of which workspace they loaded.
  useEffect(() => {
    if (!activeChannel.startsWith('dm:') || !currentUserId || isDemo) return;
    const sb = createClient();
    const ch = sb.channel(activeChannel)
      .on('broadcast', { event: 'new_msg' }, () => {
        const wsId = workspaceIdRef.current;
        if (!wsId) return;
        fetch(`/os/api/workspaces/${wsId}/chat?channel=${encodeURIComponent(activeChannel)}`)
          .then(r => r.json())
          .then(j => {
            if (!j.data?.length) return;
            setMessages(j.data);
            setLastMessages(p => ({ ...p, [activeChannel]: j.data[j.data.length - 1] }));
          })
          .catch(() => {});
      })
      // Partner reported reading — repaint our ticks immediately.
      .on('broadcast', { event: 'read' }, () => { refreshReceiptRef.current(); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') dmBcastRef.current = ch; });
    return () => { sb.removeChannel(ch); dmBcastRef.current = null; };
  }, [activeChannel, currentUserId, isDemo]);

  // Polling fallback every 3s — works even if Supabase Realtime isn't configured
  useEffect(() => {
    if (!workspaceId || !activeChannel.startsWith('dm:') || isDemo) return;
    const poll = setInterval(() => {
      fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${encodeURIComponent(activeChannel)}`)
        .then(r => r.json())
        .then(j => {
          if (!j.data?.length) return;
          setMessages(prev => {
            if (prev[prev.length - 1]?.id === j.data[j.data.length - 1]?.id) return prev;
            return j.data;
          });
          setLastMessages(p => ({ ...p, [activeChannel]: j.data[j.data.length - 1] }));
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
  }, [workspaceId, activeChannel, isDemo]);

  const getDemoMessages = useCallback(() => ([
    { id: '1', message: 'Welcome to the team chat! Use this channel to share your daily updates.', createdAt: new Date(Date.now() - 7200000).toISOString(), userId: 'admin-1', userName: 'System Administrator', userRole: 'superadmin' },
    { id: '2', message: 'Hi team! Just completed the event budget table. Please review in the Welcome doc.', createdAt: new Date(Date.now() - 3600000).toISOString(), userId: 'manager-1', userName: 'John Doe', userRole: 'manager' },
    { id: '3', message: 'Looks great John! Working on the client contacts database now.', createdAt: new Date(Date.now() - 600000).toISOString(), userId: 'member-1', userName: 'Alice Smith', userRole: 'member' },
  ]), []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function loadMsgs() {
      if (!cancelled) setMessages([]);
      if (isDemo) {
        const stored = localStorage.getItem(`demo-chat-${workspaceId}-${activeChannel}`);
        const msgs = stored ? JSON.parse(stored) : (activeChannel === 'daily_tasks' ? getDemoMessages() : []);
        if (cancelled) return;
        setMessages(msgs);
        if (!stored) localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(msgs));
        if (msgs.length > 0) setLastMessages(p => ({ ...p, [activeChannel]: msgs[msgs.length - 1] }));
        return;
      }

      if (isDm && currentUserId && !isDmParticipant(activeChannel, currentUserId)) {
        if (!cancelled) setMessages([]);
        return;
      }
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}`);
        if (res.ok) {
          const j = await res.json();
          if (j.data && !cancelled) {
            setMessages(j.data);
            if (j.data.length > 0) setLastMessages(p => ({ ...p, [activeChannel]: j.data[j.data.length - 1] }));
          }
        }
      } catch (err) { console.error(err); }
    }
    loadMsgs();

    if (isDemo) return () => { cancelled = true; };

    const sb = createClient();
    const ch = sb.channel(`chat:${workspaceId}:${activeChannel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `workspace_id=eq.${workspaceId}` }, async (payload) => {
        // Deletes: drop the message locally (id is present even in the old row)
        if (payload.eventType === 'DELETE') {
          const delId = payload.old?.id;
          if (delId) setMessages(prev => prev.filter(m => m.id !== delId));
          return;
        }
        const row = payload.new;
        if (!row || row.channel !== activeChannel) return;
        try {
          const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${row.id}`);
          if (res.ok) {
            const msg = (await res.json()).data?.[0];
            if (!msg) return;
            if (payload.eventType === 'UPDATE') {
              setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
            } else {
              setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            }
            setLastMessages(p => ({ ...p, [activeChannel]: msg }));
          }
        } catch (_) {}
      }).subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [workspaceId, activeChannel, isDemo, getDemoMessages]);

  const loadReactions = useCallback(async (msgIds) => {
    if (isDemo) return;
    if (!msgIds?.length) { setReactions({}); return; }
    const { data } = await createClient().from('chat_reactions').select('message_id, user_id, emoji').in('message_id', msgIds);
    if (!data) return;
    const grouped = {};
    data.forEach(r => {
      if (!grouped[r.message_id]) grouped[r.message_id] = {};
      if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = [];
      grouped[r.message_id][r.emoji].push(r.user_id);
    });
    setReactions(grouped);
  }, [isDemo]);

  useEffect(() => {
    const ids = messages.map(m => m.id);
    async function run() { await loadReactions(ids); }
    run();
  }, [messages, loadReactions]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Grow the message box with its content (and shrink back after send / clearing).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  // ── Presence: heartbeat our own last_seen + poll everyone else's ──────────
  // DB-backed so it works even when Supabase Realtime isn't configured (the rest
  // of the chat already relies on a polling fallback for the same reason).
  useEffect(() => {
    if (!workspaceId || isDemo || !currentUserId) return;
    let cancelled = false;
    const beat = () => { fetch(`/os/api/workspaces/${workspaceId}/presence`, { method: 'POST' }).catch(() => {}); };
    const pull = () => {
      fetch(`/os/api/workspaces/${workspaceId}/presence`)
        .then(r => r.json())
        .then(j => {
          if (cancelled || !Array.isArray(j.data)) return;
          const now = Date.now();
          const map = {};
          const online = new Set();
          j.data.forEach(p => {
            map[p.id] = p.lastSeenAt;
            if (p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() < ONLINE_WINDOW_MS) online.add(p.id);
          });
          setPresence(map);
          setOnlineIds(online);
          setPresenceAt(now);
        })
        .catch(() => {});
    };
    beat(); pull();
    const beatId = setInterval(beat, 25000);
    const pullId = setInterval(pull, 15000);
    const onActive = () => { if (document.visibilityState === 'visible') { beat(); pull(); } };
    document.addEventListener('visibilitychange', onActive);
    window.addEventListener('focus', onActive);
    return () => {
      cancelled = true;
      clearInterval(beatId); clearInterval(pullId);
      document.removeEventListener('visibilitychange', onActive);
      window.removeEventListener('focus', onActive);
    };
  }, [workspaceId, isDemo, currentUserId]);

  // ── Read receipts (DMs only) ──────────────────────────────────────────────
  // Acknowledge incoming DM messages: "read" when the tab is visible, else just
  // "delivered". Runs whenever the message list changes.
  useEffect(() => {
    if (isDemo || !activeChannel.startsWith('dm:') || !messages.length) return;
    if (!messages.some(m => m.userId !== currentUserId)) return;
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    writeReceipt(activeChannel, currentUserId, { read: visible })
      .then(() => { if (visible) dmBcastRef.current?.send({ type: 'broadcast', event: 'read', payload: {} }); })
      .catch(() => {});
  }, [messages, isDemo, activeChannel, currentUserId]);

  // Returning to the tab while a DM is open counts as reading it.
  useEffect(() => {
    if (isDemo || !activeChannel.startsWith('dm:')) return;
    const onActive = () => {
      if (document.visibilityState !== 'visible') return;
      writeReceipt(activeChannel, currentUserId, { read: true })
        .then(() => dmBcastRef.current?.send({ type: 'broadcast', event: 'read', payload: {} }))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onActive);
    window.addEventListener('focus', onActive);
    return () => {
      document.removeEventListener('visibilitychange', onActive);
      window.removeEventListener('focus', onActive);
    };
  }, [isDemo, activeChannel, currentUserId]);

  // Poll the *partner's* receipt so our outgoing ticks turn grey→blue within a
  // few seconds; also expose the fetch via a ref for the realtime "read" event.
  useEffect(() => {
    if (isDemo || !activeChannel.startsWith('dm:')) return;
    const partnerId = parseDmChannel(activeChannel).participants.find(p => p !== currentUserId);
    if (!partnerId) return;
    let cancelled = false;
    const pull = async () => {
      const { data } = await createClient()
        .from('chat_reads')
        .select('last_read_at, last_delivered_at')
        .eq('channel', activeChannel)
        .eq('user_id', partnerId)
        .maybeSingle();
      if (!cancelled) setPartnerReceipt({ lastReadAt: data?.last_read_at || null, lastDeliveredAt: data?.last_delivered_at || null });
    };
    refreshReceiptRef.current = pull;
    pull();
    const id = setInterval(pull, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isDemo, activeChannel, currentUserId]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !workspaceId) return;
    const text = inputText.trim();
    setInputText('');
    setMentionOpen(false);
    setSending(true);
    if (isDemo) {
      const msg = { id: crypto.randomUUID(), message: text, channel: activeChannel, createdAt: new Date().toISOString(), userId: currentUserId, userName: userProfile?.full_name || 'You', userRole: userProfile?.role || 'member' };
      setMessages(prev => { const next = [...prev, msg]; localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(next)); return next; });
      setLastMessages(p => ({ ...p, [activeChannel]: msg }));
      setSending(false);
      return;
    }
    try {
      const res = await fetch(`/os/api/workspaces/${workspaceId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, channel: activeChannel }) });
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          setMessages(prev => prev.some(m => m.id === j.data.id) ? prev : [...prev, j.data]);
          setLastMessages(p => ({ ...p, [activeChannel]: j.data }));
          // Signal the other user via DM-scoped broadcast channel
          dmBcastRef.current?.send({ type: 'broadcast', event: 'new_msg', payload: {} });
        }
      }
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  // ── @mentions ──────────────────────────────────────────────────────────────
  // Input change: keep the text in sync AND look for an "@query" token ending at
  // the caret so we can pop the mention picker (like WhatsApp/Slack).
  const onInputChange = (e) => {
    const el = e.target;
    const value = pointifyBullets(el.value);
    setInputText(value);
    const caret = el.selectionStart ?? value.length;
    const m = value.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
      setMentionStart(caret - m[1].length - 1);
      setMentionIdx(0);
    } else if (mentionOpen) {
      setMentionOpen(false);
    }
  };

  // People you can @mention (everyone in the space except yourself), plus a
  // special "@all" that pings the whole conversation (offered first).
  const mentionCandidates = (() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    const people = otherMembers.filter((m) => {
      const n = (m.full_name || m.email || '').toLowerCase();
      return !q || n.includes(q) || n.split(/\s+/).some((w) => w.startsWith(q));
    });
    const showAll = !q || 'all'.startsWith(q) || 'everyone'.startsWith(q);
    return [...(showAll ? [ALL_MENTION] : []), ...people].slice(0, 6);
  })();

  // Replace the "@query" token with "@Full Name " (or "@all ") and drop the caret after it.
  const insertMention = (member) => {
    const name = member.token || member.full_name || member.email || 'user';
    const el = inputRef.current;
    const caret = el ? (el.selectionStart ?? inputText.length) : inputText.length;
    const start = mentionStart ?? caret;
    const before = inputText.slice(0, start);
    const after = inputText.slice(caret);
    const insert = `@${name} `;
    setInputText(before + insert + after);
    setMentionOpen(false);
    const newCaret = (before + insert).length;
    requestAnimationFrame(() => {
      if (el) { el.focus(); try { el.setSelectionRange(newCaret, newCaret); } catch { /* noop */ } }
    });
  };

  // Highlight "@Name" tokens inside a rendered message. Names come from the member
  // list (longest first so "@John Doe" wins over "@John").
  const myName = (userProfile?.full_name || '').trim();
  const mentionNameList = (() => {
    const names = ['everyone', 'all']; // "@all" / "@everyone" ping the whole chat
    agencyMembers.forEach((m) => {
      const full = (m.full_name || '').trim();
      if (full) { names.push(full); const first = full.split(/\s+/)[0]; if (first && first !== full) names.push(first); }
      if (m.email) names.push(m.email);
    });
    return [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  })();
  const mentionSource = mentionNameList.length
    ? `@(?:${mentionNameList.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
    : null;
  const renderMessageText = (text, isOwn) => {
    if (!text || !mentionSource) return text;
    const re = new RegExp(mentionSource, 'g');
    const out = [];
    let last = 0, match, key = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) out.push(text.slice(last, match.index));
      const token = match[0];
      const mentioned = token.slice(1);
      const isAll = mentioned.toLowerCase() === 'all' || mentioned.toLowerCase() === 'everyone';
      const mentionsMe = isAll || (!!myName && (mentioned === myName || mentioned === myName.split(/\s+/)[0]));
      out.push(
        <span key={`mn-${key++}`} style={{
          fontWeight: 700,
          color: mentionsMe ? '#052e16' : (isOwn ? '#EAF3FF' : '#7EB3FF'),
          background: mentionsMe ? '#5BE59A' : (isOwn ? 'rgba(255,255,255,0.16)' : 'rgba(48,108,236,0.20)'),
          borderRadius: 5, padding: '0 3px',
        }}>{token}</span>
      );
      last = match.index + token.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  // Grow the edit box to fit the whole message so it's all visible while editing.
  const autosizeEdit = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  };
  useEffect(() => {
    if (!editingId) return;
    const el = editRef.current;
    if (!el) return;
    autosizeEdit(el);
    el.focus();
    // Put the caret at the end so they can start editing straight away.
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [editingId]);

  // ── Forwarding ────────────────────────────────────────────────────────────
  const sendToChannel = async (channel, text) => {
    if (!text || !workspaceId || !channel) return;
    if (isDemo) {
      const key = `demo-chat-${workspaceId}-${channel}`;
      const arr = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } })();
      const msg = { id: crypto.randomUUID(), message: text, channel, createdAt: new Date().toISOString(), userId: currentUserId, userName: userProfile?.full_name || 'You', userRole: userProfile?.role || 'member' };
      const next = [...arr, msg];
      localStorage.setItem(key, JSON.stringify(next));
      setLastMessages(p => ({ ...p, [channel]: msg }));
      if (channel === activeChannel) setMessages(prev => [...prev, msg]);
      return;
    }
    const res = await fetch(`/os/api/workspaces/${workspaceId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, channel }) });
    if (res.ok) {
      const j = await res.json();
      if (j.data) {
        setLastMessages(p => ({ ...p, [channel]: j.data }));
        if (channel === activeChannel) setMessages(prev => prev.some(m => m.id === j.data.id) ? prev : [...prev, j.data]);
        // Recipient picks it up via the realtime subscription / polling — no broadcast ref needed here.
      }
    }
  };

  const doForward = async (targetChannel, targetName) => {
    const m = forwardMsg;
    setForwardMsg(null);
    setForwardSearch('');
    if (!m) return;
    const text = `↪ Forwarded from ${m.userName || 'someone'}\n${m.message}`;
    try { await sendToChannel(targetChannel, text); } catch (_) {}
    setForwardToast(`Forwarded to ${targetName}`);
    setTimeout(() => setForwardToast(''), 2500);
  };

  // ── Edit / delete a message ──────────────────────────────────────────────
  const canModerate = ['manager', 'superadmin'].includes(userProfile?.role);
  const canDeleteMsg = (msg) => msg.userId === currentUserId || canModerate;

  const startEdit = (msg) => { setReactOpen(null); setConfirmDeleteId(null); setEditingId(msg.id); setEditText(msg.message); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const saveEdit = async (msg) => {
    const text = editText.trim();
    if (!text || text === msg.message) { cancelEdit(); return; }
    cancelEdit();
    setMessages(prev => {
      const next = prev.map(m => m.id === msg.id ? { ...m, message: text, edited: true } : m);
      if (isDemo) localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(next));
      return next;
    });
    if (isDemo) return;
    try {
      const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${encodeURIComponent(activeChannel)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id, message: text }),
      });
      if (res.ok) { const j = await res.json(); if (j.data) setMessages(prev => prev.map(m => m.id === j.data.id ? j.data : m)); }
      dmBcastRef.current?.send({ type: 'broadcast', event: 'new_msg', payload: {} });
    } catch (_) {}
  };

  const deleteMsg = async (msg) => {
    setConfirmDeleteId(null);
    setReactOpen(null);
    setMessages(prev => {
      const next = prev.filter(m => m.id !== msg.id);
      if (isDemo) localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(next));
      return next;
    });
    if (isDemo) return;
    try {
      await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${encodeURIComponent(activeChannel)}&messageId=${msg.id}`, { method: 'DELETE' });
      dmBcastRef.current?.send({ type: 'broadcast', event: 'new_msg', payload: {} });
    } catch (_) {}
  };

  const toggleReaction = async (messageId, emoji) => {
    if (!currentUserId || isDemo) return;
    setReactOpen(null);
    const hasReacted = (reactions[messageId]?.[emoji] || []).includes(currentUserId);
    setReactions(prev => {
      const msg = { ...(prev[messageId] || {}) };
      if (hasReacted) { const f = (msg[emoji] || []).filter(id => id !== currentUserId); if (f.length === 0) delete msg[emoji]; else msg[emoji] = f; }
      else msg[emoji] = [...(msg[emoji] || []), currentUserId];
      return { ...prev, [messageId]: msg };
    });
    const sb = createClient();
    if (hasReacted) await sb.from('chat_reactions').delete().eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
    else await sb.from('chat_reactions').upsert({ message_id: messageId, user_id: currentUserId, emoji }, { onConflict: 'message_id,user_id,emoji' });
  };

  const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😅','🙏','👍','👏','🔥','❤️','✅','🎉','💡','📌','⚡','🚀','💪','😢'];
  const QUICK_REACTIONS = ['👍','❤️','😂','😮','🔥','✅'];
  const roleColor = { superadmin: '#F5A623', manager: '#5B9BFF', member: '#4ECDC4' };
  const ACT_BTN = { width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#8FB4E8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

  // Resolve selected chat info
  const groupCh = GROUP_CHANNELS.find(c => c.id === activeChannel);
  let chatName = groupCh?.name || 'Chat';
  let chatSub = groupCh?.desc || '';
  let dmPartner = null;
  if (isDm) {
    // Channel format: dm:agencyId:user1:user2 (4 parts) or dm:user1:user2 (3 parts, legacy)
    const chParts = activeChannel.split(':');
    const userParts = chParts.length === 4 ? [chParts[2], chParts[3]] : [chParts[1], chParts[2]];
    const partnerId = userParts.find(p => p !== currentUserId);
    dmPartner = agencyMembers.find(m => m.id === partnerId);
    chatName = dmPartner?.full_name || dmPartner?.email || 'Direct Message';
    chatSub = dmPartner ? (dmPartner.role === 'superadmin' ? 'Admin' : dmPartner.role === 'manager' ? 'Manager' : 'Member') : '';
  }

  // Build conversation list for left panel
  const visibleGroupChannels = GROUP_CHANNELS;

  const baseConversations = [
    ...visibleGroupChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      icon: ch.icon,
      isGroup: true,
      lastMsg: lastMessages[ch.id],
    })),
    // Only include DM contacts once agencyId is resolved — prevents empty/wrong channel names
    ...(agencyId ? otherMembers.map(m => {
      const dmId = getDmId(m.id);
      return {
        id: dmId,
        name: m.full_name || m.email,
        avatar: m.avatar_url,
        role: m.role,
        isGroup: false,
        online: isUserOnline(m.id),
        lastMsg: lastMessages[dmId],
      };
    }) : []),
  ].filter(c => c.id);

  const allConversations = baseConversations.filter(c => !panelSearch || c.name.toLowerCase().includes(panelSearch.toLowerCase()));
  const forwardTargets = baseConversations.filter(c => !forwardSearch || c.name.toLowerCase().includes(forwardSearch.toLowerCase()));

  const formatPanelTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const relativeTime = (dateStr) => {
    if (!dateStr || !presenceAt) return '';
    const diff = presenceAt - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // WhatsApp-style delivery ticks for our own messages.
  //   sent (single ✓) → delivered (grey ✓✓) → read (blue ✓✓)
  // Ticks only apply to DMs (a single recipient); group channels show one ✓.
  const renderOwnTicks = (msg) => {
    if (!isDm) return <Check size={12} style={{ color: 'rgba(255,255,255,0.55)' }} />;
    if (isDemo) return <CheckCheck size={14} style={{ color: '#7DD3FC' }} />;
    const t = new Date(msg.createdAt).getTime();
    const readAt = partnerReceipt.lastReadAt ? new Date(partnerReceipt.lastReadAt).getTime() : 0;
    const delAt = partnerReceipt.lastDeliveredAt ? new Date(partnerReceipt.lastDeliveredAt).getTime() : 0;
    if (readAt >= t) return <CheckCheck size={14} style={{ color: '#7DD3FC' }} title="Read" />;
    if (delAt >= t) return <CheckCheck size={14} style={{ color: 'rgba(255,255,255,0.72)' }} title="Delivered" />;
    return <Check size={12} style={{ color: 'rgba(255,255,255,0.55)' }} title="Sent" />;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Group messages by date
  let lastDateLabel = null;
  const withDates = messages.map((msg, i) => {
    const dateLabel = formatDate(msg.createdAt);
    const showDate = dateLabel !== lastDateLabel;
    if (showDate) lastDateLabel = dateLabel;
    const prev = messages[i - 1];
    const isContinuation = prev && prev.userId === msg.userId && new Date(msg.createdAt) - new Date(prev.createdAt) < 3 * 60 * 1000;
    return { ...msg, showDate, dateLabel, isContinuation };
  });

  return (
    <div className={styles.workspaceShell} style={{ background: '#000' }}>
      <Sidebar />
      <div className={styles.mainContent} style={{ background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />

        {workspaceId ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* ── Left panel (WhatsApp conversation list) ── */}
            <div style={{
              width: isMobile ? '100%' : 220, flexShrink: 0,
              display: (isMobile && mobileChatOpen) ? 'none' : 'flex', flexDirection: 'column',
              background: '#000', borderRight: isMobile ? 'none' : '1px solid rgba(48,108,236,0.15)',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{ padding: '12px 10px 10px', borderBottom: '1px solid rgba(48,108,236,0.12)', flexShrink: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#E2EEFF', marginBottom: 8 }}>Messages</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(48,108,236,0.18)', borderRadius: 20, padding: '6px 10px' }}>
                  <Search size={12} style={{ color: '#3D5A8A', flexShrink: 0 }} />
                  <input
                    value={panelSearch}
                    onChange={e => setPanelSearch(e.target.value)}
                    placeholder="Search…"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#B8D4FF', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* Conversation list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Group channels label */}
                <div style={{ padding: '8px 10px 3px', fontSize: 9.5, fontWeight: 700, color: '#2A3F60', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Channels
                </div>
                {allConversations.filter(c => c.isGroup).map(conv => {
                  const isActive = activeChannel === conv.id;
                  return (
                    <button key={conv.id} onClick={() => { setActiveChannel(conv.id); setMobileChatOpen(true); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'rgba(48,108,236,0.18)' : 'none', transition: '.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none'; }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: isActive ? 'rgba(48,108,236,0.30)' : 'rgba(48,108,236,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {conv.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#E2EEFF' : '#B8D0F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.name}</span>
                          {conv.lastMsg && <span style={{ fontSize: 9.5, color: '#2A3F60', flexShrink: 0 }}>{formatPanelTime(conv.lastMsg.createdAt)}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#3D5A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.lastMsg ? `${conv.lastMsg.userName?.split(' ')[0] || ''}: ${conv.lastMsg.message}` : 'No messages yet'}
                          </span>
                          {(chatNotifs?.[conv.id]?.count || 0) > 0 && (
                            <span style={UNREAD_BADGE}>{chatNotifs[conv.id].count > 99 ? '99+' : chatNotifs[conv.id].count}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* DMs label */}
                {otherMembers.length > 0 && (
                  <div style={{ padding: '8px 10px 3px', fontSize: 9.5, fontWeight: 700, color: '#2A3F60', textTransform: 'uppercase', letterSpacing: '.08em', borderTop: '1px solid rgba(48,108,236,0.08)', marginTop: 4 }}>
                    Direct Messages
                  </div>
                )}
                {allConversations.filter(c => !c.isGroup).map(conv => {
                  const isActive = activeChannel === conv.id;
                  const rc = roleColor[conv.role] || '#5B9BFF';
                  const initial = (conv.name || '?').charAt(0).toUpperCase();
                  return (
                    <button key={conv.id} onClick={() => { setActiveChannel(conv.id); setMobileChatOpen(true); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'rgba(48,108,236,0.18)' : 'none', transition: '.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none'; }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${rc}22`, border: `2px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc, overflow: 'hidden' }}>
                          {conv.avatar ? <img src={conv.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                        </div>
                        {conv.online && (
                          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid #000' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#E2EEFF' : '#B8D0F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.name}</span>
                          {conv.lastMsg && <span style={{ fontSize: 9.5, color: '#2A3F60', flexShrink: 0 }}>{formatPanelTime(conv.lastMsg.createdAt)}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#3D5A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.lastMsg ? conv.lastMsg.message : `${chatSub || 'Say hello!'}`}
                          </span>
                          {(chatNotifs?.[conv.id]?.count || 0) > 0 && (
                            <span style={UNREAD_BADGE}>{chatNotifs[conv.id].count > 99 ? '99+' : chatNotifs[conv.id].count}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Chat area ── */}
            <div style={{ flex: 1, display: (isMobile && !mobileChatOpen) ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

              {/* Chat header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', height: 60, flexShrink: 0, background: '#000', borderBottom: '1px solid rgba(48,108,236,0.15)' }}>
                {isMobile && (
                  <button onClick={() => setMobileChatOpen(false)} title="Back to conversations"
                    style={{ background: 'none', border: 'none', color: '#7EB3FF', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: -4, flexShrink: 0 }}>
                    <ChevronLeft size={22} />
                  </button>
                )}
                {isDm && dmPartner ? (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${roleColor[dmPartner.role] || '#5B9BFF'}22`, border: `2px solid ${roleColor[dmPartner.role] || '#5B9BFF'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: roleColor[dmPartner.role] || '#5B9BFF', overflow: 'hidden' }}>
                      {dmPartner.avatar_url ? <img src={dmPartner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : chatName.charAt(0).toUpperCase()}
                    </div>
                    {isUserOnline(dmPartnerId) && (
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: '#22C55E', border: '2px solid #000' }} />
                    )}
                  </div>
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(48,108,236,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {groupCh?.icon || '💬'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#E2EEFF', lineHeight: 1.2 }}>{chatName}</div>
                  {isDm ? (
                    isUserOnline(dmPartnerId) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#22C55E', marginTop: 1 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} /> Online
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: '#3D5A8A', marginTop: 1 }}>
                        {presence[dmPartnerId] ? `Last seen ${relativeTime(presence[dmPartnerId])}` : chatSub}
                      </div>
                    )
                  ) : (
                    chatSub && <div style={{ fontSize: 11.5, color: '#3D5A8A', marginTop: 1 }}>{chatSub}</div>
                  )}
                </div>
              </div>

              {/* Notification permission banner */}
              {notifPermission === 'default' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(48,108,236,0.12)', borderBottom: '1px solid rgba(48,108,236,0.18)', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#7EB3FF' }}>🔔 Enable notifications to get alerted for new messages</span>
                  <button onClick={() => Notification.requestPermission().then(p => setNotifPermission(p))} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 8, border: '1px solid rgba(48,108,236,0.40)', background: 'rgba(48,108,236,0.20)', color: '#7EB3FF', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Enable
                  </button>
                </div>
              )}

              {/* Messages area — WhatsApp wallpaper feel */}
              <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 8px',
                display: 'flex', flexDirection: 'column', gap: 0,
                background: '#000',
              }}>
                {messages.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(48,108,236,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {isDm ? '👋' : (groupCh?.icon || '💬')}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#4A6FA5', marginBottom: 5 }}>
                        {isDm ? `Start chatting with ${chatName}` : `Welcome to ${chatName}`}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#2A3F60' }}>
                        {isDm ? 'This is a private conversation.' : chatSub}
                      </div>
                    </div>
                  </div>
                ) : (
                  withDates.map((msg) => {
                    const isOwn = msg.userId === currentUserId;
                    const msgReactions = reactions[msg.id] || {};
                    const reactionEntries = Object.entries(msgReactions).filter(([, ids]) => ids.length > 0);
                    const rc = roleColor[msg.userRole] || '#5B9BFF';

                    return (
                      <div key={msg.id}>
                        {msg.showDate && (
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 8px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#4A6FA5', background: 'rgba(10,15,30,0.85)', border: '1px solid rgba(48,108,236,0.18)', padding: '3px 12px', borderRadius: 10 }}>{msg.dateLabel}</span>
                          </div>
                        )}

                        {/* Sender name for group chats (not DMs, not own) */}
                        {!isOwn && !msg.isContinuation && !isDm && (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: rc, marginLeft: 14, marginBottom: 2, marginTop: msg.showDate ? 0 : 6 }}>
                            {msg.userName || 'Unknown'}
                          </div>
                        )}

                        <div
                          onMouseEnter={() => setHoverMsgId(msg.id)}
                          onMouseLeave={() => { setHoverMsgId(h => (h === msg.id ? null : h)); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 2, marginTop: (!msg.isContinuation && (isOwn || isDm) && !msg.showDate) ? 6 : 1 }}
                        >
                          {/* Hover actions — left of own bubble */}
                          {isOwn && editingId !== msg.id && (
                            <div style={{ display: 'flex', gap: 3, opacity: hoverMsgId === msg.id ? 1 : 0, pointerEvents: hoverMsgId === msg.id ? 'auto' : 'none', transition: 'opacity .12s', flexShrink: 0 }}>
                              <button type="button" title="Edit" onClick={() => startEdit(msg)} style={ACT_BTN}><Pencil size={12} /></button>
                              <button type="button" title="Forward" onClick={() => { setReactOpen(null); setForwardSearch(''); setForwardMsg(msg); }} style={ACT_BTN}><Forward size={12} /></button>
                              <button type="button" title="Delete" onClick={() => setConfirmDeleteId(msg.id)} style={ACT_BTN}><Trash2 size={12} /></button>
                            </div>
                          )}

                          <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>

                            {editingId === msg.id ? (
                              /* Edit box */
                              <div style={{ width: 380, maxWidth: '100%', minWidth: 260, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(48,108,236,0.45)', borderRadius: 14, padding: '8px 10px' }}>
                                <textarea
                                  ref={editRef}
                                  value={editText}
                                  onChange={(e) => { setEditText(e.target.value); autosizeEdit(e.target); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg); } if (e.key === 'Escape') cancelEdit(); }}
                                  style={{ width: '100%', minHeight: 40, maxHeight: 320, overflowY: 'auto', background: 'transparent', border: 'none', outline: 'none', color: '#E8F2FF', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                                  <button type="button" onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#9DB8DD', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><X size={12} /> Cancel</button>
                                  <button type="button" onClick={() => saveEdit(msg)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><Check size={12} /> Save</button>
                                </div>
                              </div>
                            ) : (
                              /* Bubble */
                              <div
                                data-react="true"
                                onClick={(e) => {
                                  if (reactOpen === msg.id) { setReactOpen(null); return; }
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setReactPos({ top: rect.top - 50, left: isOwn ? rect.right - 230 : rect.left });
                                  setReactOpen(msg.id);
                                }}
                                style={{
                                  padding: '7px 11px 5px',
                                  borderRadius: isOwn
                                    ? (msg.isContinuation ? '16px 4px 16px 16px' : '16px 4px 16px 16px')
                                    : (msg.isContinuation ? '4px 16px 16px 16px' : '4px 16px 16px 16px'),
                                  background: isOwn
                                    ? 'linear-gradient(135deg, #1a45a8, #2960d8)'
                                    : 'rgba(255,255,255,0.07)',
                                  border: isOwn ? 'none' : '1px solid rgba(255,255,255,0.09)',
                                  color: isOwn ? '#fff' : '#D0E4FF',
                                  fontSize: 13.5, lineHeight: 1.5,
                                  wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                                  cursor: 'pointer',
                                  boxShadow: isOwn ? '0 1px 8px rgba(48,108,236,0.30)' : '0 1px 4px rgba(0,0,0,0.30)',
                                  position: 'relative',
                                }}
                              >
                                {renderMessageText(msg.message, isOwn)}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                                  {msg.edited && <span style={{ fontSize: 9.5, fontStyle: 'italic', color: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(160,190,240,0.42)', lineHeight: 1 }}>edited</span>}
                                  <span style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.55)' : 'rgba(160,190,240,0.45)', lineHeight: 1 }}>
                                    {formatMsgTime(msg.createdAt)}
                                  </span>
                                  {isOwn && renderOwnTicks(msg)}
                                </div>
                              </div>
                            )}

                            {/* Delete confirmation */}
                            {confirmDeleteId === msg.id && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, background: 'rgba(224,72,90,0.10)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, padding: '5px 8px' }}>
                                <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600 }}>Delete this message?</span>
                                <button type="button" onClick={() => deleteMsg(msg)} style={{ padding: '3px 10px', borderRadius: 7, border: 'none', background: '#E0485A', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                                <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ padding: '3px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#9DB8DD', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                              </div>
                            )}

                            {/* Reactions */}
                            {reactionEntries.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                                {reactionEntries.map(([emoji, ids]) => {
                                  const iReacted = ids.includes(currentUserId);
                                  return (
                                    <button key={emoji} type="button" onClick={() => toggleReaction(msg.id, emoji)} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99,
                                      background: iReacted ? 'rgba(48,108,236,0.22)' : 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${iReacted ? 'rgba(48,108,236,0.5)' : 'rgba(255,255,255,0.10)'}`,
                                      cursor: 'pointer', fontSize: 12, color: iReacted ? '#7EB3FF' : '#B8D0F0', fontFamily: 'inherit',
                                    }}>
                                      {emoji} <span style={{ fontSize: 10, fontWeight: 700 }}>{ids.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Hover action — right of another member's bubble (forward; delete for moderators) */}
                          {!isOwn && editingId !== msg.id && (
                            <div style={{ display: 'flex', gap: 3, opacity: hoverMsgId === msg.id ? 1 : 0, pointerEvents: hoverMsgId === msg.id ? 'auto' : 'none', transition: 'opacity .12s', flexShrink: 0 }}>
                              <button type="button" title="Forward" onClick={() => { setReactOpen(null); setForwardSearch(''); setForwardMsg(msg); }} style={ACT_BTN}><Forward size={12} /></button>
                              {canDeleteMsg(msg) && <button type="button" title="Delete" onClick={() => setConfirmDeleteId(msg.id)} style={ACT_BTN}><Trash2 size={12} /></button>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reaction picker */}
              {reactOpen && (
                <div data-react="true" style={{ position: 'fixed', top: reactPos.top, left: reactPos.left, background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.28)', borderRadius: 30, padding: '6px 10px', zIndex: 9999, boxShadow: '0 6px 28px rgba(0,0,0,0.9)', display: 'flex', gap: 2 }}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji} type="button" data-react="true" onClick={() => toggleReaction(reactOpen, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '4px 5px', borderRadius: '50%', lineHeight: 1, transition: '.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'scale(1.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Forward picker */}
              {forwardMsg && (
                <div onClick={() => { setForwardMsg(null); setForwardSearch(''); }}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ width: 'min(420px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'rgba(8,14,34,0.98)', border: '1px solid rgba(48,108,236,0.28)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(48,108,236,0.15)' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#E2EEFF', display: 'flex', alignItems: 'center', gap: 8 }}><Forward size={16} /> Forward to…</span>
                      <button type="button" onClick={() => { setForwardMsg(null); setForwardSearch(''); }} style={{ background: 'none', border: 'none', color: '#9DB8DD', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
                    </div>

                    {/* Message preview */}
                    <div style={{ margin: '12px 16px 8px', padding: '9px 11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12.5, color: '#B8D0F0', maxHeight: 84, overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <span style={{ color: '#3D5A8A', fontWeight: 600 }}>{forwardMsg.userName}: </span>{forwardMsg.message}
                    </div>

                    {/* Search */}
                    <div style={{ margin: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(48,108,236,0.18)', borderRadius: 20, padding: '7px 11px' }}>
                      <Search size={13} style={{ color: '#3D5A8A', flexShrink: 0 }} />
                      <input value={forwardSearch} onChange={e => setForwardSearch(e.target.value)} placeholder="Search conversations…" autoFocus
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12.5, color: '#D8E8FF', fontFamily: 'inherit' }} />
                    </div>

                    {/* Conversation list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px' }}>
                      {forwardTargets.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#3D5A8A', fontSize: 12.5 }}>No conversations found.</div>
                      ) : forwardTargets.map(conv => {
                        const rc = roleColor[conv.role] || '#5B9BFF';
                        const initial = (conv.name || '?').charAt(0).toUpperCase();
                        return (
                          <button key={conv.id} type="button" onClick={() => doForward(conv.id, conv.name)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10, textAlign: 'left', transition: 'background .12s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(48,108,236,0.14)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: conv.isGroup ? 'rgba(48,108,236,0.15)' : `${rc}22`, border: conv.isGroup ? 'none' : `2px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: conv.isGroup ? 16 : 13, fontWeight: 700, color: rc, overflow: 'hidden' }}>
                              {conv.isGroup ? conv.icon : (conv.avatar ? <img src={conv.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial)}
                            </div>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#D8E8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</span>
                            <Send size={13} style={{ color: '#3D5A8A', flexShrink: 0 }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Forward confirmation toast */}
              {forwardToast && (
                <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(48,108,236,0.95)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 99, zIndex: 10001, boxShadow: '0 6px 24px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Check size={14} /> {forwardToast}
                </div>
              )}

              {/* Input bar */}
              {canPost ? (
                <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 14px', background: '#000', borderTop: '1px solid rgba(48,108,236,0.12)', flexShrink: 0 }}>
                  <div ref={emojiRef} style={{ position: 'relative', flexShrink: 0 }}>
                    <button type="button" onClick={() => setEmojiOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 7, color: '#3D5A8A', display: 'flex', borderRadius: '50%', transition: '.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#7EB3FF'}
                      onMouseLeave={e => e.currentTarget.style.color = '#3D5A8A'}>
                      <Smile size={20} />
                    </button>
                    {emojiOpen && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: 'rgba(8,14,30,0.97)', backdropFilter: 'blur(24px)', border: '1px solid rgba(48,108,236,0.22)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.8)', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, width: 210 }}>
                        {EMOJIS.map(emoji => (
                          <button key={emoji} type="button" onClick={() => { setInputText(p => p + emoji); setEmojiOpen(false); inputRef.current?.focus(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 5, borderRadius: 8, lineHeight: 1, transition: '.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(48,108,236,0.20)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    {mentionOpen && mentionCandidates.length > 0 && (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, background: 'rgba(8,14,30,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(48,108,236,0.28)', borderRadius: 14, boxShadow: '0 10px 36px rgba(0,0,0,0.7)', padding: 6, zIndex: 60, maxHeight: 244, overflowY: 'auto' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px 6px' }}>Mention someone</div>
                        {mentionCandidates.map((m, i) => {
                          const active = i === (mentionIdx % mentionCandidates.length);
                          const nm = m.__all ? m.label : (m.full_name || m.email || 'Unknown');
                          const initial = nm.charAt(0).toUpperCase();
                          return (
                            <button key={m.id} type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => insertMention(m)}
                              onMouseEnter={() => setMentionIdx(i)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: active ? 'rgba(48,108,236,0.20)' : 'transparent', border: 'none', borderRadius: 10, padding: '7px 8px', cursor: 'pointer', transition: 'background .1s' }}>
                              <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: m.__all ? 'linear-gradient(135deg,#16A36B,#22C55E)' : 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {m.__all ? <AtSign size={15} /> : initial}
                              </span>
                              <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#E2EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.__all ? 'Everyone' : nm}<span style={{ color: '#6C82A3', fontWeight: 500 }}>{m.__all ? '  @all' : ''}</span></span>
                                {m.role && <span style={{ display: 'block', fontSize: 10.5, color: '#6C82A3', textTransform: m.__all ? 'none' : 'capitalize' }}>{m.role}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={inputText}
                      onChange={onInputChange}
                      onKeyDown={e => {
                        if (mentionOpen && mentionCandidates.length > 0) {
                          if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionCandidates.length); return; }
                          if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
                          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionCandidates[mentionIdx % mentionCandidates.length]); return; }
                          if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return; }
                        }
                        if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); handleSend(); }
                      }}
                      placeholder={isDm ? `Message ${chatName}…` : `Message in ${chatName}…`}
                      disabled={sending}
                      style={{ width: '100%', resize: 'none', maxHeight: 120, overflowY: 'auto', lineHeight: 1.4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(48,108,236,0.18)', borderRadius: 20, padding: '9px 16px', fontSize: 13.5, color: '#D8E8FF', outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(48,108,236,0.50)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(48,108,236,0.18)'}
                    />
                  </div>

                  <button type="submit" disabled={sending || !inputText.trim()} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0, background: inputText.trim() ? 'linear-gradient(135deg,#1E4FB8,#306CEC)' : 'rgba(255,255,255,0.06)', color: inputText.trim() ? '#fff' : 'rgba(255,255,255,0.20)', cursor: inputText.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: inputText.trim() ? '0 2px 12px rgba(48,108,236,0.40)' : 'none', transition: 'all .15s' }}>
                    <Send size={16} style={{ marginLeft: 2 }} />
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#000', borderTop: '1px solid rgba(48,108,236,0.12)', fontSize: 12.5, color: '#3D5A8A', flexShrink: 0 }}>
                  <Lock size={13} /> Only managers can post in Weekly Tasks
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D5A8A', fontSize: 13, gap: 8 }}>
            <MessageSquare size={18} /> Loading chat…
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatClient() {
  return (
    <ToastProvider>
      <ChatContent />
    </ToastProvider>
  );
}
