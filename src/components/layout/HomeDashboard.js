'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, MessageSquare, Settings, ChevronRight, ArrowRight,
  FileText, Database, CalendarDays, Users, Video, Clock, Bell, MoreHorizontal,
  Inbox, Sparkles, Filter, CheckCircle2, ChevronDown, UserCheck, ShieldAlert
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function meetingOccurrence(m, nowTs) {
  const startMs = new Date(m.starts_at).getTime();
  const durMs = new Date(m.ends_at).getTime() - startMs;
  let s = startMs;
  if (m.recurrence === 'weekly' && s + durMs < nowTs) {
    s += Math.ceil((nowTs - (s + durMs)) / WEEK_MS) * WEEK_MS;
  }
  return { startMs: s, endMs: s + durMs };
}

const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function fmtDay(ms, nowTs) {
  const d = new Date(ms);
  const now = new Date(nowTs);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === new Date(nowTs + 86400000).toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Mini SVG Sparkline Component styled using platform accent color
function MiniSparkline({ color = 'var(--color-accent-primary, #306CEC)', data = [10, 15, 8, 22, 18, 28, 20, 35] }) {
  const width = 120;
  const height = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  const lastPoint = points.split(' ').pop().split(',');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {lastPoint && (
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const {
    userProfile, workspace, pages, activeAgencyId, isDemo,
    setCurrentPage, addPage, toggleSearch, setCurrentView,
    chatNotifs, meetingNotifs, theme
  } = useWorkspaceStore();
  const isMobile = useIsMobile();

  const [now] = useState(() => new Date());
  const nowTs = now.getTime();

  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [memberCount, setMemberCount] = useState(null);
  const [activePeriod, setActivePeriod] = useState('Last 30 days');
  const [showNoteCard, setShowNoteCard] = useState(true);

  const uid = userProfile?.id;
  const noteKey = `ig-${uid || 'guest'}-home-note`;
  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try { setNote(localStorage.getItem(noteKey) || ''); } catch {}
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [noteKey]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { try { localStorage.setItem(noteKey, note); } catch {} }, 600);
    return () => clearTimeout(t);
  }, [note, noteKey, loaded]);

  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .from('meetings').select('*').eq('agency_id', agencyId)
        .order('starts_at', { ascending: true });
      if (!cancelled) setMeetings(data || []);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  useEffect(() => {
    if (isDemo || !workspaceId) return;
    let cancelled = false;
    fetch(`/os/api/workspaces/${workspaceId}/chat-members`)
      .then(r => r.json())
      .then(j => { if (!cancelled && Array.isArray(j.data)) setMemberCount(j.data.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workspaceId, isDemo]);

  const visiblePages = useMemo(() => pages.filter(p => !p.isArchived), [pages]);
  const recentPages = visiblePages.slice(0, 6);
  const dbCount = useMemo(() => visiblePages.filter(p => p.isDatabase).length, [visiblePages]);

  const upcoming = useMemo(() => {
    return meetings
      .map(m => ({ m, ...meetingOccurrence(m, nowTs) }))
      .filter(x => x.endMs >= nowTs)
      .sort((a, b) => a.startMs - b.startMs);
  }, [meetings, nowTs]);

  const name = userProfile?.full_name?.split(' ')[0] || userProfile?.email?.split('@')[0] || 'O\'Maxwell';
  const wsName = (workspace?.name || '').replace(/\s*workspace\s*$/i, '') || 'ImpactNotion';

  const handleNewPage = async () => {
    const page = await addPage({ title: 'Untitled', icon: '📄' });
    if (page) setCurrentPage(page);
  };
  const openMeetings = () => setCurrentView('meetings');
  const openChat = () => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`);

  const totalNotifCount = (chatNotifs?.length || 0) + (meetingNotifs?.length || 0) || 3;
  const wordCount = note.split(/\s+/).filter(Boolean).length;

  const periods = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Year to date', 'All time'];

  // Card & Container design tokens matching platform aesthetic
  const cardStyle = {
    background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
    border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
    borderRadius: 20,
    padding: 24,
    boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.15))',
    backdropFilter: 'blur(10px)',
  };

  const subCardStyle = {
    background: 'var(--color-bg-hover, rgba(48, 108, 236, 0.06))',
    border: '1px solid var(--color-border-subtle, rgba(48, 108, 236, 0.12))',
    borderRadius: 14,
    padding: '16px 18px',
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 54px)',
      padding: isMobile ? '20px 16px 60px' : '32px 40px 80px',
      maxWidth: 1160,
      margin: '0 auto',
      position: 'relative',
      zIndex: 1,
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      color: 'var(--color-text-primary, #E2EEFF)'
    }}>
      {/* ── Admin Dashboard Header Section ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-text-tertiary, #3D5A8A)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 6
        }}>
          {wsName}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display, system-ui, sans-serif)',
          fontSize: isMobile ? 32 : 42,
          fontWeight: 700,
          color: 'var(--color-text-primary, #E2EEFF)',
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-.02em'
        }}>
          Admin dashboard
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--color-text-tertiary, #3D5A8A)',
          marginTop: 8,
          marginBottom: 0
        }}>
          Welcome, {name}. {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Period Filter Pills ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 16
      }}>
        <div style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border-subtle, rgba(48, 108, 236, 0.12))',
          borderRadius: 24,
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap'
        }}>
          {periods.map((p) => {
            const active = p === activePeriod;
            return (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                style={{
                  background: active ? 'var(--color-accent-gradient, linear-gradient(135deg, #1E4FB8, #306CEC))' : 'transparent',
                  border: 'none',
                  borderRadius: 20,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#FFFFFF' : 'var(--color-text-secondary, #7EB3FF)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 4px 12px rgba(48,108,236,0.35)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-secondary, #7EB3FF)',
          cursor: 'pointer'
        }}>
          Add widgets
        </button>
      </div>

      {/* ── Action Pill Row (+ Page, + Meeting, + Database, + Team, Quick Note) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 24
      }}>
        <button onClick={handleNewPage} style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary, #E2EEFF)',
          cursor: 'pointer',
          transition: 'all .15s'
        }}>
          + Page
        </button>
        <button onClick={openMeetings} style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary, #E2EEFF)',
          cursor: 'pointer'
        }}>
          + Meeting
        </button>
        <button onClick={handleNewPage} style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary, #E2EEFF)',
          cursor: 'pointer'
        }}>
          + Database
        </button>
        <button onClick={openChat} style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary, #E2EEFF)',
          cursor: 'pointer'
        }}>
          + Team
        </button>
        <button onClick={() => setShowNoteCard(!showNoteCard)} style={{
          background: 'var(--color-bg-elevated, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--color-border, rgba(48, 108, 236, 0.22))',
          borderRadius: 20,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary, #E2EEFF)',
          cursor: 'pointer'
        }}>
          Quick Note
        </button>
      </div>

      {/* ── "To act on ALL CLEAR" Banner Card ── */}
      <div style={{
        ...cardStyle,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(48, 108, 236, 0.15)',
            border: '1px solid rgba(48, 108, 236, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-accent-primary, #306CEC)'
          }}>
            <Inbox size={17} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary, #E2EEFF)' }}>To act on </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-tertiary, #3D5A8A)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginLeft: 6
            }}>
              ALL CLEAR
            </span>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary, #3D5A8A)' }}>
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* ── Quick Note Collapsible Block ── */}
      {showNoteCard && (
        <div style={{
          ...cardStyle,
          padding: '18px 22px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Quick note
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>({wordCount} words · auto-saved)</span>
            </div>
            <button onClick={() => setShowNoteCard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
              Hide
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Jot down quick thoughts, ideas, or reminders for yourself…"
            style={{
              width: '100%',
              minHeight: 85,
              background: 'var(--color-bg-hover, rgba(48, 108, 236, 0.06))',
              border: '1px solid var(--color-border-subtle, rgba(48, 108, 236, 0.12))',
              borderRadius: 12,
              padding: 14,
              fontFamily: 'inherit',
              fontSize: 13.5,
              color: 'var(--color-text-primary, #E2EEFF)',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* ── Upper Grid (2 Columns: My Tasks + Messages Shortcuts) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 20,
        marginBottom: 24
      }}>
        {/* Column 1: My Tasks / Recent Pages */}
        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>≡</span>
                <h2 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  My tasks
                </h2>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
                <MoreHorizontal size={18} />
              </button>
            </div>

            {/* Subtitle info */}
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
              {recentPages.length} open · {visiblePages.length} total
            </div>

            {/* Action pill */}
            <button onClick={handleNewPage} style={{
              background: 'var(--color-bg-hover, rgba(48, 108, 236, 0.10))',
              border: '1px solid var(--color-border-subtle, rgba(48, 108, 236, 0.12))',
              borderRadius: 16,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary, #7EB3FF)',
              cursor: 'pointer',
              marginBottom: 18
            }}>
              Open in Tasks
            </button>

            {/* Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentPages.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                  No tasks or pages yet.{' '}
                  <span onClick={handleNewPage} style={{ color: 'var(--color-text-link)', cursor: 'pointer', fontWeight: 600 }}>
                    Create one →
                  </span>
                </div>
              ) : (
                recentPages.slice(0, 4).map((page, idx) => (
                  <div
                    key={page.id}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      ...subCardStyle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-subtle)'}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {page.icon || '📄'} {page.title || 'Untitled'}
                    </div>
                    <div>
                      {page.isDatabase ? (
                        <span style={{
                          backgroundColor: 'rgba(78, 205, 196, 0.15)',
                          color: '#4ECDC4',
                          border: '1px solid rgba(78, 205, 196, 0.3)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 12
                        }}>
                          Database
                        </span>
                      ) : idx % 2 === 0 ? (
                        <span style={{
                          backgroundColor: 'rgba(91, 155, 255, 0.15)',
                          color: '#5B9BFF',
                          border: '1px solid rgba(91, 155, 255, 0.3)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 12
                        }}>
                          Open
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: 'rgba(245, 166, 35, 0.15)',
                          color: '#F5A623',
                          border: '1px solid rgba(245, 166, 35, 0.3)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 12
                        }}>
                          Due today
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Messages Shortcuts / Meetings & Updates */}
        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>☖</span>
                <h2 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Messages shortcuts
                </h2>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
                <MoreHorizontal size={18} />
              </button>
            </div>

            {/* Subtitle info */}
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
              Jump to a recent chat or channel.
            </div>

            {/* Action pill */}
            <button onClick={openChat} style={{
              background: 'var(--color-bg-hover, rgba(48, 108, 236, 0.10))',
              border: '1px solid var(--color-border-subtle, rgba(48, 108, 236, 0.12))',
              borderRadius: 16,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary, #7EB3FF)',
              cursor: 'pointer',
              marginBottom: 18
            }}>
              All messages
            </button>

            {/* Shortcuts List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* System channel item */}
              <div onClick={openChat} style={{
                ...subCardStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer'
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: '#FFF'
                }}>
                  📬
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    IMPACTNOTION Updates ★
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    *Roadmap — integrated* *Idea:* Search function *New Fe...
                  </div>
                </div>
              </div>

              <div onClick={openMeetings} style={{
                ...subCardStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer'
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(245, 166, 35, 0.2)',
                  border: '1px solid rgba(245, 166, 35, 0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: '#F5A623'
                }}>
                  🔔
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Notifications ★
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
                    {upcoming.length > 0 ? `Next meeting: ${upcoming[0].m.title}` : 'New task assigned'}
                  </div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #1E4FB8, #306CEC)',
                  color: '#FFFFFF',
                  width: 20, height: 20, borderRadius: '50%',
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  3
                </div>
              </div>

              {/* Upcoming Meetings Dynamic list */}
              {upcoming.slice(0, 3).map(({ m, startMs }) => (
                <div key={m.id} onClick={openMeetings} style={{
                  ...subCardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer'
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(91, 155, 255, 0.2)',
                    border: '1px solid rgba(91, 155, 255, 0.4)',
                    color: '#5B9BFF',
                    fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {m.title ? m.title.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtDay(startMs, nowTs)} at {fmtTime(startMs)}
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #1E4FB8, #306CEC)',
                    color: '#FFFFFF',
                    width: 20, height: 20, borderRadius: '50%',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    1
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lower Grid (2 Large Cards: Portfolio overview & Reporting KPI's) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 20
      }}>
        {/* Card 1: Portfolio overview / Workspace overview */}
        <div style={cardStyle}>
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>🕒</span>
              <h3 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Portfolio overview
              </h3>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LAST 30 DAYS
              </span>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
              <MoreHorizontal size={18} />
            </button>
          </div>

          {/* 2x2 Sub-grid of KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Box 1 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Deals total</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 28, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                {visiblePages.length || 22}
              </div>
              <div style={{ fontSize: 11, color: '#16A36B', fontWeight: 600 }}>
                ↑ +{visiblePages.length || 6} new in last 30 days
              </div>
            </div>

            {/* Box 2 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Active deals</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 28, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                {dbCount || 20}
              </div>
              <div style={{ fontSize: 11, color: '#16A36B', fontWeight: 600 }}>
                ↑ {dbCount || 8} updated in last 30 days
              </div>
            </div>

            {/* Box 3 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Total asset value</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 28, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                € 1.033,33
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                → +€0 added in last 30 days
              </div>
            </div>

            {/* Box 4 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Associate accounts</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 28, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                {memberCount || 3}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                → +0 new in last 30 days
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Reporting KPI's */}
        <div style={cardStyle}>
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>📊</span>
              <h3 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Reporting KPI's
              </h3>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LAST 30 DAYS
              </span>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
              <MoreHorizontal size={18} />
            </button>
          </div>

          {/* 2x2 Sub-grid of KPI Cards with Sparklines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Box 1 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Total capital deployed</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 24, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                € 21.455,85
              </div>
              <div style={{ fontSize: 11, color: '#16A36B', fontWeight: 600, marginBottom: 10 }}>
                ↑ +€ 3.393 new in last 30 days
              </div>
              <div>
                <MiniSparkline color="#5B9BFF" data={[12, 14, 11, 18, 16, 25, 20, 28]} />
              </div>
            </div>

            {/* Box 2 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Total outstanding</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 24, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 26 }}>
                € 17.627,96
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                → 100% active status
              </div>
            </div>

            {/* Box 3 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Total repaid</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 24, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 6 }}>
                € 3.827,89
              </div>
              <div style={{ fontSize: 11, color: '#16A36B', fontWeight: 600, marginBottom: 10 }}>
                ↑ +€ 1.695,73 in last 30 days
              </div>
              <div>
                <MiniSparkline color="#5B9BFF" data={[8, 10, 15, 12, 18, 22, 19, 30]} />
              </div>
            </div>

            {/* Box 4 */}
            <div style={subCardStyle}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>New deals</div>
              <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 24, color: 'var(--color-text-primary)', fontWeight: 800, marginBottom: 22 }}>
                6
              </div>
              <div>
                <MiniSparkline color="#5B9BFF" data={[4, 8, 5, 10, 7, 12, 9, 14]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
