'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageSquare } from 'lucide-react';
import styles from '@/styles/layout.module.css';
import chatStyles from '@/styles/chat.module.css';

function ChatContent() {
  const {
    workspace,
    fetchUserProfile,
    loadWorkspace,
    initDemoWorkspace,
    userProfile,
    isDemo,
  } = useWorkspaceStore();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize workspace and user profile
  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      if (profile) {
        await loadWorkspace();
      } else {
        initDemoWorkspace();
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fetch initial messages and set up Realtime
  useEffect(() => {
    if (!workspaceId) return;

    if (isDemo) {
      // Load demo messages from localStorage or default ones
      const stored = localStorage.getItem(`demo-chat-${workspaceId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        const defaults = getDemoMessages();
        setMessages(defaults);
        localStorage.setItem(`demo-chat-${workspaceId}`, JSON.stringify(defaults));
      }
      return;
    }

    // Load actual messages from database
    async function fetchMessages() {
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setMessages(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch chat messages:', err);
      }
    }
    fetchMessages();

    // Set up Supabase Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          // Fetch the message detailed info including profiles join
          const { data } = await supabase
            .from('chat_messages')
            .select(`
              id,
              message,
              created_at,
              user_id,
              profiles:user_id (
                full_name,
                email,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const formatted = {
              id: data.id,
              message: data.message,
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, isDemo, getDemoMessages]);

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
      // Simulate sending in Demo Mode
      const newMsg = {
        id: crypto.randomUUID(),
        message: currentMsg,
        createdAt: new Date().toISOString(),
        userId: userProfile?.id || 'demo-current-user',
        userName: userProfile?.full_name || 'Demo User',
        userRole: userProfile?.role || 'manager',
      };
      setMessages((prev) => {
        const next = [...prev, newMsg];
        localStorage.setItem(`demo-chat-${workspaceId}`, JSON.stringify(next));
        return next;
      });
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`/os/api/workspaces/${workspaceId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentMsg }),
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
      case 'superadmin': return 'Super Admin';
      case 'manager': return 'Manager';
      default: return 'Member';
    }
  };

  const getRolePillColor = (role) => {
    switch (role) {
      case 'superadmin': return { background: 'var(--color-success-bg)', color: 'var(--color-success)' };
      case 'manager': return { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' };
      default: return { background: 'var(--color-info-bg)', color: 'var(--color-info)' };
    }
  };

  return (
    <div className={styles.workspaceShell} style={{ background: 'linear-gradient(135deg,#000000 0%,#010408 50%,#000000 100%)' }}>
      <Sidebar />

      <div className={styles.mainContent} style={{ position: 'relative', background: '#000' }}>
        {/* Blue ambient glow — top right */}
        <div style={{
          position: 'absolute', width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(48,108,236,0.18) 0%, transparent 60%)',
          top: -250, right: -150, pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Blue ambient glow — bottom left */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,79,184,0.12) 0%, transparent 65%)',
          bottom: -100, left: -100, pointerEvents: 'none', zIndex: 0,
        }} />

        <Topbar />

        <div className={styles.pageContent} style={{
          position: 'relative', zIndex: 1,
          backgroundImage: `
            linear-gradient(rgba(48,108,236,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(48,108,236,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - var(--topbar-height))',
        }}>
          {workspaceId ? (
            <div className={chatStyles.chatContainer}>
              {/* Header */}
              <div className={chatStyles.chatHeader}>
                <div>
                  <div className={chatStyles.chatTitle}>
                    <MessageSquare size={24} style={{ color: 'var(--color-accent-primary)' }} />
                    <span>Team Chat Room</span>
                  </div>
                  <div className={chatStyles.chatSubTitle}>
                    Discuss ideas, ask questions, and share daily task updates in {workspace?.name || 'Workspace'}
                  </div>
                </div>
              </div>

              {/* Messages list */}
              <div className={chatStyles.messagesList}>
                {messages.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flex: 1, color: 'var(--color-text-muted)', gap: '10px'
                  }}>
                    <MessageSquare size={36} style={{ strokeWidth: 1.5, opacity: 0.4 }} />
                    <span style={{ fontSize: '13px' }}>No messages yet. Start the conversation!</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMyMessage = msg.userId === currentUserId;
                    const pillColor = getRolePillColor(msg.userRole);
                    return (
                      <div key={msg.id} className={chatStyles.messageRow} style={{
                        flexDirection: isMyMessage ? 'row-reverse' : 'row'
                      }}>
                        {/* Avatar */}
                        <div className={chatStyles.userAvatar}>
                          {msg.userName.slice(0, 2)}
                        </div>

                        {/* Message body */}
                        <div className={chatStyles.messageContentWrapper} style={{
                          alignItems: isMyMessage ? 'flex-end' : 'flex-start'
                        }}>
                          <div className={chatStyles.messageMeta} style={{
                            flexDirection: isMyMessage ? 'row-reverse' : 'row'
                          }}>
                            <span className={chatStyles.senderName}>{msg.userName}</span>
                            <span className="ig-pill" style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              ...pillColor
                            }}>
                              {getRoleLabel(msg.userRole)}
                            </span>
                            <span className={chatStyles.timestamp}>
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>

                          <div className={`${chatStyles.messageBubble} ${isMyMessage ? chatStyles.myMessageBubble : ''}`}>
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className={chatStyles.chatInputWrapper}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={chatStyles.chatInput}
                  placeholder={`Send a message in #chat-room...`}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className={chatStyles.sendButton}
                  disabled={sending || !inputText.trim()}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flex: 1, color: 'var(--color-text-muted)', gap: '10px'
            }}>
              <span style={{ fontSize: '13px' }}>Loading workspace chat...</span>
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
