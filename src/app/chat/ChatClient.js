'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageSquare, Users, Lock, Trash2 } from 'lucide-react';
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
  } = useWorkspaceStore();

  const [activeChannel, setActiveChannel] = useState('daily_tasks');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesEndRef = useRef(null);

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
          const { data } = await supabase
            .from('chat_messages')
            .select(`
              id, message, channel, created_at, user_id,
              profiles:user_id ( full_name, email, role )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const formatted = {
              id: data.id,
              message: data.message,
              channel: data.channel,
              createdAt: data.created_at,
              userId: data.user_id,
              userName: data.profiles?.full_name || 'Anonymous Member',
              userEmail: data.profiles?.email || '',
              userRole: data.profiles?.role || 'member',
            };
            setMessages((prev) => {
              if (prev.some((m) => m.id === formatted.id)) return prev;
              return [...prev, formatted];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(realtimeChannel); };
  }, [workspaceId, activeChannel, isDemo, getDemoMessages]);

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

            {/* Channel list */}
            <div className={chatStyles.channelPanel}>
              <div className={chatStyles.channelPanelHeader}>
                <div className={chatStyles.channelPanelTitle}>{workspace?.name || 'Workspace'}</div>
                <div className={chatStyles.channelPanelSub}>Channels</div>
              </div>
              <div className={chatStyles.channelList}>
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    className={`${chatStyles.channelItem} ${activeChannel === ch.id ? chatStyles.channelItemActive : ''}`}
                    onClick={() => setActiveChannel(ch.id)}
                  >
                    <div className={chatStyles.channelIcon}>{ch.icon}</div>
                    <div className={chatStyles.channelInfo}>
                      <div className={chatStyles.channelName}>{ch.label}</div>
                      <div className={chatStyles.channelDesc}>{ch.desc}</div>
                    </div>
                    {ch.managerOnly && <Lock size={11} className={chatStyles.channelLock} />}
                  </button>
                ))}
              </div>
            </div>

          <div className={chatStyles.chatContainer}>
            {/* Header */}
            <div className={chatStyles.chatHeader}>
              <div className={chatStyles.chatHeaderAvatar}>
                {CHANNELS.find(c => c.id === activeChannel)?.icon || '💬'}
              </div>
              <div className={chatStyles.chatHeaderInfo}>
                <div className={chatStyles.chatTitle}>{CHANNELS.find(c => c.id === activeChannel)?.label}</div>
                <div className={chatStyles.chatSubTitle}>{CHANNELS.find(c => c.id === activeChannel)?.desc}</div>
              </div>
              {['manager', 'superadmin'].includes(userProfile?.role) && (
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
                        <div className={isOwn ? chatStyles.sentBubble : chatStyles.receivedBubble}>
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
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            {canPost ? (
              <form onSubmit={handleSendMessage} className={chatStyles.chatInputBar}>
                <input
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
