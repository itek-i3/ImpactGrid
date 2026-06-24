'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageSquare, Lock, Smile, Search, Check } from 'lucide-react';
import styles from '@/styles/layout.module.css';

function ChatContent() {
  const searchParams = useSearchParams();
  const targetWorkspaceId = searchParams.get('workspaceId');

  const { workspace, fetchUserProfile, loadWorkspace, initDemoWorkspace, userProfile, isDemo, activeAgencyId } = useWorkspaceStore();

  const urlChannel = searchParams.get('channel') || 'daily_tasks';
  const [activeChannel, setActiveChannel] = useState(urlChannel);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [agencyMembers, setAgencyMembers] = useState([]);
  const [reactions, setReactions] = useState({});
  const [reactOpen, setReactOpen] = useState(null);
  const [reactPos, setReactPos] = useState({ top: 0, left: 0 });
  const [panelSearch, setPanelSearch] = useState('');
  const [lastMessages, setLastMessages] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);

  const GROUP_CHANNELS = [
    { id: 'daily_tasks',  name: 'Daily Tasks',  icon: '📋', desc: 'Daily team updates',   managerOnly: false },
    { id: 'weekly_tasks', name: 'Weekly Tasks', icon: '📅', desc: 'Weekly planning',       managerOnly: false, postManagerOnly: true },
    { id: 'random',       name: 'Random',        icon: '💬', desc: 'Off-topic chat',        managerOnly: false },
  ];

  const isDm = activeChannel.startsWith('dm:');
  const canPost = isDm
    || !GROUP_CHANNELS.find(c => c.id === activeChannel)?.postManagerOnly
    || ['manager', 'superadmin'].includes(userProfile?.role);

  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      if (profile) await loadWorkspace(targetWorkspaceId || undefined);
      else initDemoWorkspace();
    }
    init();
  }, [targetWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActiveChannel(urlChannel); }, [urlChannel]);

  useEffect(() => {
    const mockMembers = [
      { id: 'admin-1', full_name: 'System Administrator', role: 'superadmin', email: 'admin@example.com' },
      { id: 'manager-1', full_name: 'John Doe', role: 'manager', email: 'john@example.com' },
      { id: 'member-1', full_name: 'Alice Smith', role: 'member', email: 'alice@example.com' },
    ];
    if (isDemo) { setAgencyMembers(mockMembers); return; }
    const agencyIdToUse = activeAgencyId || workspace?.agency_id;
    if (!agencyIdToUse || !userProfile) return;
    setAgencyMembers([]);
    async function loadMembers() {
      try {
        const res = await fetch(`/os/api/agencies/${agencyIdToUse}/chat-members`);
        if (res.ok) {
          const j = await res.json();
          if (j.data?.length) { setAgencyMembers(j.data); return; }
        }
      } catch (_) {}
    }
    loadMembers();
  }, [activeAgencyId, workspace?.agency_id, userProfile, isDemo]);

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

  const workspaceId = workspace?.id;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const getDmId = (otherId) => `dm:${[currentUserId, otherId].sort().join(':')}`;
  const otherMembers = agencyMembers.filter(m => m.id !== currentUserId);
  const [notifPermission, setNotifPermission] = useState('default');

  // Request notification permission
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotifPermission(Notification.permission);
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  // Global subscription — notifies for ALL channels, not just the active one
  useEffect(() => {
    if (!workspaceId || !currentUserId || isDemo) return;
    const sb = createClient();
    const notifCh = sb.channel(`notif:${workspaceId}:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        const row = payload.new;
        if (row.user_id === currentUserId) return;
        if (row.channel === activeChannel && document.visibilityState === 'visible') return;
        if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
        const sender = agencyMembers.find(m => m.id === row.user_id);
        const senderName = sender?.full_name || sender?.email || 'Someone';
        const isDmCh = row.channel?.startsWith('dm:');
        const chObj = GROUP_CHANNELS.find(c => c.id === row.channel);
        const title = isDmCh ? senderName : `${senderName} · #${chObj?.name || row.channel}`;
        const notif = new Notification(title, {
          body: row.message,
          icon: '/favicon.ico',
          tag: row.channel,
          renotify: true,
        });
        notif.onclick = () => { window.focus(); setActiveChannel(row.channel); notif.close(); };
      })
      .subscribe();
    return () => sb.removeChannel(notifCh);
  }, [workspaceId, currentUserId, isDemo, agencyMembers, activeChannel]);

  const getDemoMessages = useCallback(() => ([
    { id: '1', message: 'Welcome to the team chat! Use this channel to share your daily updates.', createdAt: new Date(Date.now() - 7200000).toISOString(), userId: 'admin-1', userName: 'System Administrator', userRole: 'superadmin' },
    { id: '2', message: 'Hi team! Just completed the event budget table. Please review in the Welcome doc.', createdAt: new Date(Date.now() - 3600000).toISOString(), userId: 'manager-1', userName: 'John Doe', userRole: 'manager' },
    { id: '3', message: 'Looks great John! Working on the client contacts database now.', createdAt: new Date(Date.now() - 600000).toISOString(), userId: 'member-1', userName: 'Alice Smith', userRole: 'member' },
  ]), []);

  useEffect(() => {
    if (!workspaceId) return;
    setMessages([]);
    if (isDemo) {
      const stored = localStorage.getItem(`demo-chat-${workspaceId}-${activeChannel}`);
      const msgs = stored ? JSON.parse(stored) : (activeChannel === 'daily_tasks' ? getDemoMessages() : []);
      setMessages(msgs);
      if (!stored) localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(msgs));
      if (msgs.length > 0) setLastMessages(p => ({ ...p, [activeChannel]: msgs[msgs.length - 1] }));
      return;
    }
    async function fetchMsgs() {
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}`);
        if (res.ok) {
          const j = await res.json();
          if (j.data) {
            setMessages(j.data);
            if (j.data.length > 0) setLastMessages(p => ({ ...p, [activeChannel]: j.data[j.data.length - 1] }));
          }
        }
      } catch (err) { console.error(err); }
    }
    fetchMsgs();
    const sb = createClient();
    const ch = sb.channel(`chat:${workspaceId}:${activeChannel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `workspace_id=eq.${workspaceId}` }, async (payload) => {
        if (payload.new.channel !== activeChannel) return;
        try {
          const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${payload.new.id}`);
          if (res.ok) {
            const j = await res.json();
            const msg = j.data?.[0];
            if (msg) {
              setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
              setLastMessages(p => ({ ...p, [activeChannel]: msg }));
            }
          }
        } catch (_) {}
      }).subscribe();
    return () => sb.removeChannel(ch);
  }, [workspaceId, activeChannel, isDemo, getDemoMessages]);

  const loadReactions = useCallback(async (msgIds) => {
    if (!msgIds?.length || isDemo) return;
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

  useEffect(() => { if (messages.length > 0) loadReactions(messages.map(m => m.id)); else setReactions({}); }, [messages, loadReactions]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !workspaceId) return;
    const text = inputText.trim();
    setInputText('');
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
      if (res.ok) { const j = await res.json(); if (j.data) { setMessages(prev => prev.some(m => m.id === j.data.id) ? prev : [...prev, j.data]); setLastMessages(p => ({ ...p, [activeChannel]: j.data })); } }
    } catch (err) { console.error(err); }
    finally { setSending(false); }
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

  // Resolve selected chat info
  const groupCh = GROUP_CHANNELS.find(c => c.id === activeChannel);
  let chatName = groupCh?.name || 'Chat';
  let chatSub = groupCh?.desc || '';
  let dmPartner = null;
  if (isDm) {
    const partnerId = activeChannel.split(':').find(p => p !== 'dm' && p !== currentUserId);
    dmPartner = agencyMembers.find(m => m.id === partnerId);
    chatName = dmPartner?.full_name || dmPartner?.email || 'Direct Message';
    chatSub = dmPartner ? (dmPartner.role === 'superadmin' ? 'Admin' : dmPartner.role === 'manager' ? 'Manager' : 'Member') : '';
  }

  // Build conversation list for left panel
  const visibleGroupChannels = GROUP_CHANNELS;

  const allConversations = [
    ...visibleGroupChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      icon: ch.icon,
      isGroup: true,
      lastMsg: lastMessages[ch.id],
    })),
    ...otherMembers.map(m => ({
      id: getDmId(m.id),
      name: m.full_name || m.email,
      avatar: m.avatar_url,
      role: m.role,
      isGroup: false,
      lastMsg: lastMessages[getDmId(m.id)],
    })),
  ].filter(c => !panelSearch || c.name.toLowerCase().includes(panelSearch.toLowerCase()));

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
              width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
              background: '#000', borderRight: '1px solid rgba(48,108,236,0.15)',
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
                    <button key={conv.id} onClick={() => setActiveChannel(conv.id)} style={{
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
                        <div style={{ fontSize: 11, color: '#3D5A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                          {conv.lastMsg ? `${conv.lastMsg.userName?.split(' ')[0] || ''}: ${conv.lastMsg.message}` : 'No messages yet'}
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
                    <button key={conv.id} onClick={() => setActiveChannel(conv.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'rgba(48,108,236,0.18)' : 'none', transition: '.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none'; }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${rc}22`, border: `2px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc, overflow: 'hidden' }}>
                        {conv.avatar ? <img src={conv.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#E2EEFF' : '#B8D0F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.name}</span>
                          {conv.lastMsg && <span style={{ fontSize: 9.5, color: '#2A3F60', flexShrink: 0 }}>{formatPanelTime(conv.lastMsg.createdAt)}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#3D5A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                          {conv.lastMsg ? conv.lastMsg.message : `${chatSub || 'Say hello!'}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Chat area ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

              {/* Chat header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', height: 60, flexShrink: 0, background: '#000', borderBottom: '1px solid rgba(48,108,236,0.15)' }}>
                {isDm && dmPartner ? (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: `${roleColor[dmPartner.role] || '#5B9BFF'}22`, border: `2px solid ${roleColor[dmPartner.role] || '#5B9BFF'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: roleColor[dmPartner.role] || '#5B9BFF', overflow: 'hidden' }}>
                    {dmPartner.avatar_url ? <img src={dmPartner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : chatName.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(48,108,236,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {groupCh?.icon || '💬'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#E2EEFF', lineHeight: 1.2 }}>{chatName}</div>
                  {chatSub && <div style={{ fontSize: 11.5, color: '#3D5A8A', marginTop: 1 }}>{chatSub}</div>}
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

                        <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 2, marginTop: (!msg.isContinuation && (isOwn || isDm) && !msg.showDate) ? 6 : 1 }}>
                          <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>

                            {/* Bubble */}
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
                              {msg.message}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                                <span style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.55)' : 'rgba(160,190,240,0.45)', lineHeight: 1 }}>
                                  {formatMsgTime(msg.createdAt)}
                                </span>
                                {isOwn && <Check size={11} style={{ color: 'rgba(255,255,255,0.55)' }} />}
                              </div>
                            </div>

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

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={isDm ? `Message ${chatName}…` : `Message in ${chatName}…`}
                    disabled={sending}
                    autoComplete="off"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(48,108,236,0.18)', borderRadius: 22, padding: '10px 16px', fontSize: 13.5, color: '#D8E8FF', outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(48,108,236,0.50)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(48,108,236,0.18)'}
                  />

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
