'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, MessageSquare, Settings, ChevronRight, ArrowRight,
  FileText, Database, CalendarDays, Users, Video, Clock,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Next upcoming occurrence of a meeting (handles weekly recurrence).
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

export default function HomeDashboard() {
  const router = useRouter();
  const {
    userProfile, workspace, pages, activeAgencyId, isDemo,
    setCurrentPage, addPage, toggleSearch, setCurrentView,
  } = useWorkspaceStore();

  const [now] = useState(() => new Date());
  const nowTs = now.getTime();

  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [memberCount, setMemberCount] = useState(null);

  const uid = userProfile?.id;
  const noteKey = `ig-${uid || 'guest'}-home-note`;
  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;

  // Quick note — load once, then debounce-save (deferred setState keeps effects clean).
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

  // Upcoming meetings for the widget + KPI.
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

  // Team size for the KPI.
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

  const name = userProfile?.full_name?.split(' ')[0] || userProfile?.email?.split('@')[0] || 'there';
  const wsName = (workspace?.name || '').replace(/\s*workspace\s*$/i, '') || 'My Space';

  const handleNewPage = async () => {
    const page = await addPage({ title: 'Untitled', icon: '📄' });
    if (page) setCurrentPage(page);
  };
  const openMeetings = () => setCurrentView('meetings');
  const openChat = () => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`);

  const stats = [
    { label: 'Pages', value: visiblePages.length, Icon: FileText, tint: '#5B9BFF', onClick: null },
    { label: 'Databases', value: dbCount, Icon: Database, tint: '#4ECDC4', onClick: null },
    { label: 'Upcoming meetings', value: upcoming.length, Icon: CalendarDays, tint: '#9B8CFF', onClick: openMeetings },
    { label: 'Team members', value: memberCount == null ? '—' : memberCount, Icon: Users, tint: '#F5A623', onClick: openChat },
  ];

  const quickActions = [
    { icon: <Search size={15} />, label: 'Search', action: toggleSearch },
    { icon: <Plus size={15} />, label: 'New page', action: handleNewPage },
    { icon: <CalendarDays size={15} />, label: 'Meetings', action: openMeetings },
    { icon: <MessageSquare size={15} />, label: 'Chat', action: openChat },
    { icon: <Settings size={15} />, label: 'Customize', action: () => router.push('/customize') },
  ];

  const cardStyle = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 16 };
  const sectionLbl = { fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

  return (
    <div style={{ minHeight: 'calc(100dvh - var(--topbar-height, 54px))', padding: '40px 40px 80px', maxWidth: 1120, margin: '0 auto', position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>{wsName}</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em', lineHeight: 1.15, margin: 0 }}>
            {greetingFor(now.getHours())}, {name} 👋
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-tertiary)', marginTop: 8, marginBottom: 0 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={handleNewPage} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(48,108,236,0.35)' }}>
          <Plus size={16} /> New page
        </button>
      </div>

      {/* ── KPI stat row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
        {stats.map(({ label, value, Icon, tint, onClick }) => (
          <button key={label} onClick={onClick || undefined}
            style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'border-color .12s, transform .12s' }}
            onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = 'var(--color-border-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${tint}22`, border: `1px solid ${tint}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint }}>
              <Icon size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
        {quickActions.map(({ icon, label, action }) => (
          <button key={label} onClick={action}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text-link)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Content grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          {/* Recent pages */}
          <div>
            <div style={sectionLbl}><span>Recent pages</span></div>
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              {recentPages.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  No pages yet.{' '}
                  <span onClick={handleNewPage} style={{ color: 'var(--color-text-link)', cursor: 'pointer', fontWeight: 600 }}>Create one →</span>
                </div>
              ) : recentPages.map((page, i) => (
                <div key={page.id} onClick={() => setCurrentPage(page)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: i < recentPages.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', cursor: 'pointer', transition: 'background .12s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 17, flexShrink: 0, width: 24, textAlign: 'center' }}>{page.icon || (page.isDatabase ? '📊' : '📄')}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title || 'Untitled'}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>{page.isDatabase ? 'DB' : 'Page'}</span>
                  <ChevronRight size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick note */}
          <div>
            <div style={sectionLbl}><span>Quick note</span>{note.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--color-text-muted)' }}>{note.split(/\s+/).filter(Boolean).length} words · auto-saved</span>}</div>
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jot down ideas, tasks, reminders…"
                style={{ width: '100%', minHeight: 150, background: 'transparent', border: 'none', outline: 'none', padding: '16px 18px', resize: 'vertical', fontFamily: 'var(--font-sans, system-ui)', fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Right column — Upcoming meetings */}
        <div>
          <div style={sectionLbl}>
            <span>Upcoming meetings</span>
            <span onClick={openMeetings} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--color-text-link)', cursor: 'pointer' }}>View all <ArrowRight size={11} /></span>
          </div>
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            {isDemo ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5 }}>Sign in to see agency meetings.</div>
            ) : upcoming.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
                <CalendarDays size={26} style={{ opacity: 0.5, marginBottom: 8 }} /><br />
                No upcoming meetings.<br />
                <span onClick={openMeetings} style={{ color: 'var(--color-text-link)', cursor: 'pointer', fontWeight: 600 }}>Schedule one →</span>
              </div>
            ) : upcoming.slice(0, 4).map(({ m, startMs, endMs }, i) => (
              <div key={m.id} onClick={openMeetings}
                style={{ display: 'flex', gap: 11, padding: '12px 15px', borderBottom: i < Math.min(upcoming.length, 4) - 1 ? '1px solid var(--color-border-subtle)' : 'none', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-link)', textTransform: 'uppercase' }}>{fmtDay(startMs, nowTs)}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtTime(startMs)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, borderLeft: '2px solid rgba(48,108,236,0.4)', paddingLeft: 11 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {fmtTime(startMs)}–{fmtTime(endMs)}</span>
                    {m.meet_link && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#4ECDC4', fontWeight: 600 }}><Video size={10} /> Meet</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
