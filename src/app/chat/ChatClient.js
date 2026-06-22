'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageSquare, Users, Lock, Trash2, Smile } from 'lucide-react';
import styles from '@/styles/layout.module.css';
import chatStyles from '@/styles/chat.module.css';

function ChatContent() {
  const searchParams = useSearchParams();
  const targetWorkspaceId = searchParams.get('workspaceId');

  const {
    workspace,
    fetchUserProfile,
    loadWorkspace,
    initDemoWorkspace,
    userProfile,
    isDemo,
    activeAgencyId,
  } = useWorkspaceStore();

  const urlChannel = searchParams.get('channel') || 'daily_tasks';
  const [activeChannel, setActiveChannel] = useState(urlChannel);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactions, setReactions] = useState({});
  const [agencyMembers, setAgencyMembers] = useState([]);
  const [reactPickerOpen, setReactPickerOpen] = useState(null);
  const [reactPickerPos, setReactPickerPos] = useState({ top: 0, left: 0, right: 'auto', alignRight: false });
  const [reactMoreOpen, setReactMoreOpen] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);

  const CHANNELS = [
    { id: 'daily_tasks',  label: 'Daily Tasks',   icon: '📋', desc: 'Everyone can post',  managerOnly: false },
    { id: 'weekly_tasks', label: 'Weekly Tasks',  icon: '📅', desc: 'Managers only',       managerOnly: true  },
    { id: 'random',       label: 'Random',         icon: '💬', desc: 'Everyone can post',  managerOnly: false },
  ];

  const canPost = !CHANNELS.find(c => c.id === activeChannel)?.managerOnly
    || ['manager', 'superadmin'].includes(userProfile?.role);

  // Initialize workspace and user profile
  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      if (profile) {
        await loadWorkspace(targetWorkspaceId || undefined);
      } else {
        initDemoWorkspace();
      }
    }
    init();
  }, [targetWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync channel when URL param changes (clicking from sidebar)
  useEffect(() => { setActiveChannel(urlChannel); }, [urlChannel]);

  // Fetch agency members to resolve partner info for DMs
  useEffect(() => {
    const mockMembers = [
      { id: 'admin-1', full_name: 'System Administrator', role: 'superadmin', email: 'admin@example.com' },
      { id: 'manager-1', full_name: 'John Doe', role: 'manager', email: 'john@example.com' },
      { id: 'member-1', full_name: 'Alice Smith', role: 'member', email: 'alice@example.com' },
    ];

    if (isDemo) {
      setAgencyMembers(mockMembers);
      return;
    }
    const agencyIdToUse = workspace?.agency_id || activeAgencyId;
    if (!agencyIdToUse || !userProfile) return;

    async function loadMembers() {
      const sb = createClient();
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('agency_id', agencyIdToUse)
        .eq('approved', true);
      if (!error && data) {
        setAgencyMembers(data);
      }
    }
    loadMembers();
  }, [workspace?.agency_id, activeAgencyId, userProfile, isDemo]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactPickerOpen) return;
    const handler = (e) => { if (!e.target.closest('[data-reaction]')) setReactPickerOpen(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [reactPickerOpen]);

  const workspaceId = workspace?.id;

  // Mock messages for Demo Mode
  const getDemoMessages = useCallback(() => {
    return [
      {
        id: '1',
        message: 'Welcome to the Team Chat Room! Let\'s use this channel to discuss our daily tasks and updates.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        userId: 'admin-1',
        userName: 'System Administrator',
        userRole: 'superadmin',
      },
      {
        id: '2',
        message: 'Hi team! Just completed the event budget table. Please check the "Welcome" document and review my updates.',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        userId: 'manager-1',
        userName: 'John Doe',
        userRole: 'manager',
      },
      {
        id: '3',
        message: 'Looks great John! I am currently working on updating the client contacts database. Will submit my task in a bit.',
        createdAt: new Date(Date.now() - 600000).toISOString(),
        userId: 'member-1',
        userName: 'Alice Smith',
        userRole: 'member',
      }
    ];
  }, []);

  // Fetch messages + realtime whenever workspace or channel changes
  useEffect(() => {
    if (!workspaceId) return;
    setMessages([]);
    setConfirmClear(false);

    if (isDemo) {
      const stored = localStorage.getItem(`demo-chat-${workspaceId}-${activeChannel}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        const defaults = activeChannel === 'daily_tasks' ? getDemoMessages() : [];
        setMessages(defaults);
        localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(defaults));
      }
      return;
    }

    async function fetchMessages() {
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) setMessages(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch chat messages:', err);
      }
    }
    fetchMessages();

    const supabase = createClient();
    const realtimeChannel = supabase
      .channel(`chat:${workspaceId}:${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          if (payload.new.channel !== activeChannel) return;
          // Fetch via API so the server-side admin client can join profiles without RLS issues
          try {
            const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${payload.new.id}`);
            if (res.ok) {
              const json = await res.json();
              const msg = json.data?.[0];
              if (msg) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
              }
            }
          } catch (_) {}
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(realtimeChannel); };
  }, [workspaceId, activeChannel, isDemo, getDemoMessages]);

  const loadReactions = useCallback(async (msgIds) => {
    if (!msgIds?.length || isDemo) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('chat_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', msgIds);
    if (!data) return;
    const grouped = {};
    data.forEach((r) => {
      if (!grouped[r.message_id]) grouped[r.message_id] = {};
      if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = [];
      grouped[r.message_id][r.emoji].push(r.user_id);
    });
    setReactions(grouped);
  }, [isDemo]);

  // Load reactions whenever messages change
  useEffect(() => {
    if (messages.length > 0) loadReactions(messages.map((m) => m.id));
    else setReactions({});
  }, [messages, loadReactions]);

  // Realtime subscription for reaction changes
  useEffect(() => {
    if (!workspaceId || isDemo) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`reactions:${workspaceId}:${activeChannel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' },
        () => { loadReactions(messages.map((m) => m.id)); }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [workspaceId, activeChannel, isDemo, messages, loadReactions]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !workspaceId) return;

    const currentMsg = inputText.trim();
    setInputText('');
    setSending(true);

    if (isDemo) {
      const newMsg = {
        id: crypto.randomUUID(),
        message: currentMsg,
        channel: activeChannel,
        createdAt: new Date().toISOString(),
        userId: userProfile?.id || 'demo-current-user',
        userName: userProfile?.full_name || 'Demo User',
        userRole: userProfile?.role || 'manager',
      };
      setMessages((prev) => {
        const next = [...prev, newMsg];
        localStorage.setItem(`demo-chat-${workspaceId}-${activeChannel}`, JSON.stringify(next));
        return next;
      });
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`/os/api/workspaces/${workspaceId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentMsg, channel: activeChannel }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const json = await res.json();
      if (json.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === json.data.id)) return prev;
          return [...prev, json.data];
        });
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!workspaceId) return;
    setConfirmClear(false);
    const previous = messages;
    setMessages([]);
    if (isDemo) {
      localStorage.removeItem(`demo-chat-${workspaceId}-${activeChannel}`);
      return;
    }
    try {
      const res = await fetch(`/os/api/workspaces/${workspaceId}/chat?channel=${activeChannel}`, { method: 'DELETE' });
      if (!res.ok) setMessages(previous);
    } catch {
      setMessages(previous);
    }
  };

  const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😅','🙏','👍','👏','🔥','❤️','✅','🎉','💡','📌','⚡','🚀','💪','😢','😤','🤝','👀','💯','🎯','📋','✍️','🗓️','💬','📢'];
  const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','😍','🔥','👏','✅','🎉'];
  const ALL_REACTION_EMOJIS = [
    '👍','👎','❤️','🧡','💛','💚','💙','💜','🖤','🤍',
    '😀','😂','😍','🥰','😎','🤔','😅','🙏','😢','😤',
    '🤝','👀','💯','🎯','🔥','⚡','🚀','💡','✅','❌',
    '🎉','🎊','🏆','🌟','⭐','💎','🙌','👌','✌️','🤞',
    '😮','😱','🤯','😭','🥳','😇','🤗','😬','🤭','😃',
    '💪','🦾','🫶','🫡','🫠','🤌','👋','🙋','🤦','🤷',
  ];

  const handleEmojiClick = (emoji) => {
    setInputText((prev) => prev + emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const toggleReaction = async (messageId, emoji) => {
    if (!currentUserId || isDemo) return;
    setReactPickerOpen(null);
    setReactMoreOpen(null);
    const hasReacted = (reactions[messageId]?.[emoji] || []).includes(currentUserId);
    // Optimistic update
    setReactions((prev) => {
      const msg = { ...(prev[messageId] || {}) };
      if (hasReacted) {
        const filtered = (msg[emoji] || []).filter((id) => id !== currentUserId);
        if (filtered.length === 0) delete msg[emoji]; else msg[emoji] = filtered;
      } else {
        msg[emoji] = [...(msg[emoji] || []), currentUserId];
      }
      return { ...prev, [messageId]: msg };
    });
    const supabase = createClient();
    if (hasReacted) {
      await supabase.from('chat_reactions').delete()
        .eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
    } else {
      await supabase.from('chat_reactions').upsert(
        { message_id: messageId, user_id: currentUserId, emoji },
        { onConflict: 'message_id,user_id,emoji' }
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin': return 'Admin';
      case 'manager': return 'Manager';
      default: return 'Member';
    }
  };

  const getRolePillStyle = (role) => {
    switch (role) {
      case 'superadmin': return { background: 'rgba(245,166,35,0.18)', color: '#F5A623' };
      case 'manager': return { background: 'rgba(91,155,255,0.18)', color: '#5B9BFF' };
      default: return { background: 'rgba(255,255,255,0.10)', color: 'rgba(200,220,255,0.60)' };
    }
  };

  const getChannelHeaderInfo = () => {
    const channelObj = CHANNELS.find((c) => c.id === activeChannel);
    if (channelObj) return { title: channelObj.label, desc: channelObj.desc, icon: channelObj.icon };

    if (activeChannel?.startsWith('dm:')) {
      const parts = activeChannel.split(':');
      const partnerId = parts[1] === userProfile?.id ? parts[2] : parts[1];
      const partner = agencyMembers.find((m) => m.id === partnerId);
      const displayName = partner?.full_name || partner?.email || 'Direct Message';
      return {
        title: displayName,
        desc: `Private conversation with ${displayName}`,
        icon: partner?.avatar_url ? (
          <img src={partner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          '👤'
        ),
      };
    }

    return { title: 'Chat Room', desc: 'Team communication', icon: '💬' };
  };

  const headerInfo = getChannelHeaderInfo();

  // Group messages by date for separators
  let lastDate = null;

  return (
    <div className={styles.workspaceShell} style={{ background: 'linear-gradient(135deg,#000000 0%,#010408 50%,#000000 100%)' }}>
      <Sidebar />

      <div className={styles.mainContent} style={{ background: '#000', position: 'relative' }}>
        {/* ambient glows — pointer-events:none so they don't affect layout */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(48,108,236,0.18) 0%, transparent 60%)', top: -250, right: -150 }} />
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,79,184,0.12) 0%, transparent 65%)', bottom: -100, left: -100 }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar />

        {workspaceId ? (
          <div className={chatStyles.chatShell}>
          <div className={chatStyles.chatContainer}>
            {/* Header */}
            <div className={chatStyles.chatHeader}>
              <div className={chatStyles.chatHeaderAvatar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {headerInfo.icon}
              </div>
              <div className={chatStyles.chatHeaderInfo}>
                <div className={chatStyles.chatTitle}>{headerInfo.title}</div>
                <div className={chatStyles.chatSubTitle}>{headerInfo.desc}</div>
              </div>
              {['manager', 'superadmin'].includes(userProfile?.role) && !activeChannel.startsWith('dm:') && (
                confirmClear ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>Clear channel?</span>
                    <button
                      onClick={handleClearChat}
                      disabled={clearing}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: 'none', background: '#e05a5a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {clearing ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #3D5A8A', background: 'none', color: '#aaa', cursor: 'pointer' }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    disabled={messages.length === 0}
                    title="Clear chat"
                    style={{
                      background: 'none', border: 'none', cursor: messages.length === 0 ? 'default' : 'pointer',
                      padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
                      color: messages.length === 0 ? '#2a3a55' : '#3D5A8A', transition: '.15s',
                    }}
                    onMouseEnter={(e) => { if (messages.length > 0) e.currentTarget.style.color = '#e05a5a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = messages.length === 0 ? '#2a3a55' : '#3D5A8A'; }}
                  >
                    <Trash2 size={16} />
                  </button>
                )
              )}
              <Users size={18} style={{ color: '#3D5A8A', flexShrink: 0 }} />
            </div>

            {/* Messages */}
            <div className={chatStyles.messagesList}>
              {messages.length === 0 ? (
                <div className={chatStyles.emptyState}>
                  <MessageSquare size={40} style={{ opacity: 0.3, strokeWidth: 1.5 }} />
                  <span>No messages yet. Say something!</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.userId === currentUserId;
                  const msgDate = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : null;
                  const showSeparator = msgDate && msgDate !== lastDate;
                  if (showSeparator) lastDate = msgDate;
                  const msgReactions = reactions[msg.id] || {};
                  const reactionEntries = Object.entries(msgReactions).filter(([, ids]) => ids.length > 0);

                  return (
                    <div key={msg.id}>
                      {showSeparator && (
                        <div className={chatStyles.dateSeparator}>
                          <span className={chatStyles.dateSeparatorLabel}>{msgDate}</span>
                        </div>
                      )}
                      <div className={isOwn ? chatStyles.sentRow : chatStyles.receivedRow}>
                        {!isOwn && (
                          <div className={chatStyles.avatar}>
                            {(msg.userName || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                          <div
                            data-reaction="true"
                            className={isOwn ? chatStyles.sentBubble : chatStyles.receivedBubble}
                            style={{ position: 'relative', maxWidth: '100%', cursor: 'pointer' }}
                            onClick={(e) => {
                              if (reactPickerOpen === msg.id) {
                                setReactPickerOpen(null);
                                setReactMoreOpen(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pickerH = 70;
                              const top = rect.top > pickerH + 16 ? rect.top - pickerH - 8 : rect.bottom + 8;
                              setReactPickerPos({
                                top,
                                left: isOwn ? 'auto' : rect.left,
                                right: isOwn ? window.innerWidth - rect.right : 'auto',
                                alignRight: isOwn,
                              });
                              setReactPickerOpen(msg.id);
                            }}
                          >
                            {!isOwn && (
                              <div className={chatStyles.senderName}>
                                {msg.userName || 'Unknown'}
                                <span className={chatStyles.rolePill} style={getRolePillStyle(msg.userRole)}>
                                  {getRoleLabel(msg.userRole)}
                                </span>
                              </div>
                            )}
                            <div className={chatStyles.messageText}>{msg.message}</div>
                            <div className={chatStyles.messageFooter}>
                              <span className={chatStyles.timestamp}>{formatMessageTime(msg.createdAt)}</span>
                            </div>

                          </div>

                          {/* Reaction pills */}
                          {reactionEntries.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {reactionEntries.map(([emoji, ids]) => {
                                const iReacted = ids.includes(currentUserId);
                                return (
                                  <button key={emoji} type="button"
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      background: iReacted ? 'rgba(48,108,236,0.18)' : 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${iReacted ? 'rgba(48,108,236,0.45)' : 'rgba(255,255,255,0.10)'}`,
                                      borderRadius: 99, padding: '2px 8px',
                                      cursor: 'pointer', fontSize: 13, color: iReacted ? '#7EB3FF' : '#C8DEFF',
                                      fontFamily: 'inherit', transition: '.15s',
                                    }}
                                  >
                                    <span>{emoji}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700 }}>{ids.length}</span>
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

            {/* Reaction picker — fixed so it's never clipped by scroll overflow */}
            {reactPickerOpen && (() => {
              const openReactions = reactions[reactPickerOpen] || {};
              return (
                <div data-reaction="true" style={{
                  position: 'fixed',
                  top: reactPickerPos.top,
                  left: reactPickerPos.left,
                  right: reactPickerPos.right,
                  background: 'rgba(6,12,28,0.97)',
                  border: '1px solid rgba(48,108,236,0.32)',
                  borderRadius: 14, padding: '10px 12px',
                  zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
                  minWidth: 'max-content',
                }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {REACTION_EMOJIS.map((emoji, i) => {
                      const iReacted = openReactions[emoji]?.includes(currentUserId);
                      return (
                        <button key={`q-${i}`} type="button"
                          onClick={() => toggleReaction(reactPickerOpen, emoji)}
                          style={{
                            background: iReacted ? 'rgba(48,108,236,0.30)' : 'none',
                            border: 'none', cursor: 'pointer', fontSize: 24,
                            padding: '4px 6px', borderRadius: 8, lineHeight: 1, transition: '.1s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = iReacted ? 'rgba(48,108,236,0.30)' : 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                    <button type="button" data-reaction="true"
                      onClick={(e) => { e.stopPropagation(); setReactMoreOpen((v) => v === reactPickerOpen ? null : reactPickerOpen); }}
                      style={{
                        background: reactMoreOpen ? 'rgba(48,108,236,0.25)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(48,108,236,0.25)',
                        borderRadius: 8, cursor: 'pointer',
                        fontSize: 16, padding: '4px 8px', color: '#7EB3FF',
                        fontWeight: 700, lineHeight: 1, marginLeft: 4,
                      }}
                    >
                      +
                    </button>
                  </div>
                  {reactMoreOpen && (
                    <div style={{
                      marginTop: 10, borderTop: '1px solid rgba(48,108,236,0.18)', paddingTop: 10,
                      display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2,
                    }}>
                      {ALL_REACTION_EMOJIS.map((emoji, i) => (
                        <button key={`a-${i}`} type="button"
                          onClick={() => toggleReaction(reactPickerOpen, emoji)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '4px', borderRadius: 6, lineHeight: 1, transition: '.1s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Input bar */}
            {canPost ? (
              <form onSubmit={handleSendMessage} className={chatStyles.chatInputBar} style={{ position: 'relative' }}>
                <div ref={emojiRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#3D5A8A', display: 'flex', alignItems: 'center', borderRadius: 6, transition: '.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#7EB3FF'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#3D5A8A'}
                  >
                    <Smile size={18} />
                  </button>
                  {emojiOpen && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                      background: 'rgba(8,15,35,0.96)', backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(48,108,236,0.25)', borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: 10,
                      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, width: 220,
                    }}>
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4, borderRadius: 6, transition: '.1s', lineHeight: 1 }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(48,108,236,0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
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
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={chatStyles.chatInput}
                  placeholder={`Message #${CHANNELS.find(c => c.id === activeChannel)?.label}…`}
                  disabled={sending}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className={chatStyles.sendButton}
                  disabled={sending || !inputText.trim()}
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <div className={chatStyles.readOnlyNotice}>
                <Lock size={13} />
                Only managers can post in Weekly Tasks
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className={chatStyles.loadingState}>
            <span>Loading chat…</span>
          </div>
        )}
        </div>
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
