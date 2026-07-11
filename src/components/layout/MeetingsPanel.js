'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import {
  CalendarDays, Plus, Video, Clock, Users, Trash2, Pencil, X,
  ChevronLeft, ChevronRight, ExternalLink, Check, Link2, Repeat,
} from 'lucide-react';

// ── Date helpers (pure — safe to call during render) ─────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DURATIONS = [15, 30, 45, 60, 90, 120];

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isoDayKey = (iso) => dayKey(new Date(iso));
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The first occurrence of a meeting whose end is still upcoming (weekly repeats
// forward from the original start; one-time meetings just return themselves).
function nextOccurrence(m, nowTs) {
  const startMs = new Date(m.starts_at).getTime();
  const durMs = new Date(m.ends_at).getTime() - startMs;
  let s = startMs;
  if (m.recurrence === 'weekly' && s + durMs < nowTs) {
    s += Math.ceil((nowTs - (s + durMs)) / WEEK_MS) * WEEK_MS;
  }
  return { startMs: s, endMs: s + durMs };
}

// Build the day cells for a month, filling leading/trailing days from the
// adjacent months (marked `outside`) so the grid is always complete weeks.
function buildMonthCells(year, month) {
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: new Date(year, month, 1 - (startDow - i)), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }
  return cells;
}

// Google Calendar "template" URL — opens a pre-filled event the user can save;
// Google Meet is added there in one click (guests carried via `add`).
function gcalStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function buildGoogleCalendarUrl(m, attendeeEmails) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: m.title || 'Meeting',
    dates: `${gcalStamp(m.starts_at)}/${gcalStamp(m.ends_at)}`,
  });
  const details = [m.description, m.meet_link ? `Join Google Meet: ${m.meet_link}` : '']
    .filter(Boolean).join('\n\n');
  if (details) params.set('details', details);
  if (m.meet_link) params.set('location', m.meet_link);
  if (attendeeEmails?.length) params.set('add', attendeeEmails.join(','));
  if (m.recurrence === 'weekly') params.set('recur', 'RRULE:FREQ=WEEKLY');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const DEMO_MEMBERS = [
  { id: 'manager-1', full_name: 'John Doe', email: 'john@example.com', role: 'manager' },
  { id: 'member-1', full_name: 'Alice Smith', email: 'alice@example.com', role: 'member' },
];

export default function MeetingsPanel() {
  const { workspace, activeAgencyId, userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();

  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const canModerate = ['manager', 'superadmin'].includes(userProfile?.role);

  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar view month (initialised once from "now").
  const [viewYM, setViewYM] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [todayKey] = useState(() => dayKey(new Date()));
  const [nowTs] = useState(() => Date.now());

  // Schedule/edit modal + form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState(todayKey);
  const [fTime, setFTime] = useState('10:00');
  const [fDuration, setFDuration] = useState(30);
  const [fMeetLink, setFMeetLink] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fAttendees, setFAttendees] = useState([]);
  const [fRepeat, setFRepeat] = useState('none'); // 'none' | 'weekly'
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Google connection status for this user (auto Meet links when connected).
  const [google, setGoogle] = useState({ configured: false, connected: false, email: null });

  const demoKey = agencyId ? `demo-meetings-${agencyId}` : 'demo-meetings';

  // ── Google connection status ──
  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetch('/os/api/google/status')
      .then(r => r.json())
      .then(j => { if (!cancelled && j.data) setGoogle(j.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isDemo]);

  const disconnectGoogle = async () => {
    await fetch('/os/api/google/disconnect', { method: 'POST' }).catch(() => {});
    setGoogle(g => ({ ...g, connected: false, email: null }));
  };
  // Auto-create a Meet link for NEW meetings when the user has connected Google.
  const autoCreatesMeet = google.configured && google.connected;

  // ── Load agency members (for attendee names + calendar invites) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) { if (!cancelled) setMembers(DEMO_MEMBERS); return; }
      if (!workspaceId) return;
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat-members`);
        if (res.ok) {
          const j = await res.json();
          if (!cancelled && j.data) setMembers(j.data);
        }
      } catch (_) {}
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId, isDemo]);

  // ── Load meetings + subscribe to realtime changes ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(demoKey) : null;
        if (!cancelled) { setMeetings(raw ? JSON.parse(raw) : []); setLoading(false); }
        return;
      }
      if (!agencyId) return;
      const { data } = await createClient()
        .from('meetings').select('*')
        .eq('agency_id', agencyId)
        .order('starts_at', { ascending: true });
      if (!cancelled) { setMeetings(data || []); setLoading(false); }
    }
    load();

    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`meetings:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `agency_id=eq.${agencyId}` }, () => { load(); })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, demoKey]);

  const memberById = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const monthCells = useMemo(() => buildMonthCells(viewYM.year, viewYM.month), [viewYM]);

  // Placement on the calendar — weekly meetings appear on every matching weekday
  // shown in the grid (on/after their first date), including faded adjacent days.
  const meetingsByDay = useMemo(() => {
    const map = {};
    const push = (k, m) => { (map[k] ||= []).push(m); };
    meetings.forEach(m => {
      if (m.recurrence === 'weekly') {
        const start = new Date(m.starts_at);
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        monthCells.forEach(({ date }) => {
          if (date.getDay() === start.getDay() && date >= startMidnight) push(dayKey(date), m);
        });
      } else {
        push(isoDayKey(m.starts_at), m);
      }
    });
    return map;
  }, [meetings, monthCells]);

  const upcoming = useMemo(() => {
    return meetings
      .map(m => ({ m, ...nextOccurrence(m, nowTs) }))
      .filter(x => x.endMs >= nowTs)
      .sort((a, b) => a.startMs - b.startMs);
  }, [meetings, nowTs]);

  // ── Modal open/save/delete ──
  const openSchedule = (dateKey) => {
    setEditingId(null);
    setFTitle(''); setFDate(dateKey || todayKey); setFTime('10:00');
    setFDuration(30); setFMeetLink(''); setFDesc(''); setFAttendees([]); setFRepeat('none');
    setConfirmDeleteId(null);
    setModalOpen(true);
  };

  const openEdit = (m) => {
    const s = new Date(m.starts_at);
    const mins = Math.max(15, Math.round((new Date(m.ends_at) - s) / 60000));
    setEditingId(m.id);
    setFTitle(m.title || '');
    setFDate(dayKey(s));
    setFTime(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
    setFDuration(mins);
    setFMeetLink(m.meet_link || '');
    setFDesc(m.description || '');
    setFAttendees(m.attendee_ids || []);
    setFRepeat(m.recurrence === 'weekly' ? 'weekly' : 'none');
    setConfirmDeleteId(null);
    setModalOpen(true);
  };

  const toggleAttendee = (id) => {
    setFAttendees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const canSave = fTitle.trim() && fDate && fTime && !saving;

  const persistDemo = (next) => {
    setMeetings(next);
    try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {}
  };

  const saveMeeting = async () => {
    if (!canSave) return;
    setSaving(true);
    const starts = new Date(`${fDate}T${fTime}`);
    const ends = new Date(starts.getTime() + fDuration * 60000);

    let meetLink = fMeetLink.trim() || null;
    let googleEventId = editingId ? (meetings.find(m => m.id === editingId)?.google_event_id || null) : null;

    // Connected + new meeting → let Google create the Meet link and email invites.
    if (!isDemo && autoCreatesMeet && !editingId) {
      try {
        const res = await fetch('/os/api/meetings/google-event', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: fTitle.trim(), description: fDesc.trim(),
            startsAt: starts.toISOString(), endsAt: ends.toISOString(),
            attendeeEmails: fAttendees.map(id => memberById[id]?.email).filter(Boolean),
            recurrence: fRepeat,
          }),
        });
        if (res.ok) {
          const j = await res.json();
          if (j.data?.meetLink) meetLink = j.data.meetLink;
          if (j.data?.eventId) googleEventId = j.data.eventId;
        }
      } catch (_) { /* fall back to whatever link was typed */ }
    }

    const base = {
      agency_id: agencyId, created_by: currentUserId,
      title: fTitle.trim(), description: fDesc.trim() || null,
      meet_link: meetLink,
      recurrence: fRepeat,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      attendee_ids: fAttendees,
    };
    if (googleEventId) base.google_event_id = googleEventId;

    if (isDemo) {
      if (editingId) {
        persistDemo(meetings.map(m => m.id === editingId ? { ...m, ...base } : m));
      } else {
        persistDemo([...meetings, { ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      }
      setSaving(false); setModalOpen(false);
      return;
    }

    try {
      const sb = createClient();
      if (editingId) {
        const { data } = await sb.from('meetings').update(base).eq('id', editingId).select('*').maybeSingle();
        if (data) setMeetings(prev => prev.map(m => m.id === data.id ? data : m));
      } else {
        const { data } = await sb.from('meetings').insert(base).select('*').maybeSingle();
        if (data) setMeetings(prev => [...prev, data]);
      }
      setModalOpen(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const deleteMeeting = async (m) => {
    setConfirmDeleteId(null);
    if (isDemo) { persistDemo(meetings.filter(x => x.id !== m.id)); return; }
    setMeetings(prev => prev.filter(x => x.id !== m.id));
    // Best-effort: also cancel the Google Calendar event if we created one.
    if (m.google_event_id && autoCreatesMeet) {
      fetch(`/os/api/meetings/google-event?eventId=${encodeURIComponent(m.google_event_id)}`, { method: 'DELETE' }).catch(() => {});
    }
    try { await createClient().from('meetings').delete().eq('id', m.id); } catch (_) {}
  };

  const canEditMeeting = (m) => m.created_by === currentUserId || canModerate;
  const attendeeEmailsOf = (m) => (m.attendee_ids || []).map(id => memberById[id]?.email).filter(Boolean);

  const gotoMonth = (delta) => setViewYM(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Weekday name for the "Repeats every week on …s" hint (pure — derived from the picked date).
  const weekdayName = fDate ? new Date(`${fDate}T00:00:00`).toLocaleDateString([], { weekday: 'long' }) : '';

  const C = {
    card: { background: '#000', border: '1px solid var(--color-border)', borderRadius: 16 },
    accent: '#306CEC',
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
            <CalendarDays size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Meetings</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Schedule and join agency meetings over Google Meet</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!isDemo && google.configured && (
            google.connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#22C55E', fontWeight: 600 }} title={google.email || ''}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} /> Google connected
                </span>
                <button className="mtg-btn ghost sm" onClick={disconnectGoogle}>Disconnect</button>
              </div>
            ) : (
              <a className="mtg-btn ghost" href="/os/api/google/connect" title="Auto-create Meet links & email invites">
                <Video size={14} /> Connect Google
              </a>
            )
          )}
          <button className="mtg-btn mtg-btn-primary" onClick={() => openSchedule(todayKey)}>
            <Plus size={15} /> Schedule meeting
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
        {/* Calendar */}
        <div style={{ ...C.card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.01em' }}>
              {MONTHS[viewYM.month]} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{viewYM.year}</span>
            </div>
            <div className="mtg-navgroup">
              <button className="mtg-nav" onClick={() => gotoMonth(-1)} title="Previous month"><ChevronLeft size={16} /></button>
              <button className="mtg-nav mtg-nav-today" onClick={() => setViewYM(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; })} title="Jump to current month">Today</button>
              <button className="mtg-nav" onClick={() => gotoMonth(1)} title="Next month"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="mtg-cal">
            {WEEKDAYS.map(d => <div key={d} className="mtg-dow">{d}</div>)}
            {monthCells.map(({ date, outside }) => {
              const k = dayKey(date);
              const dayMeetings = meetingsByDay[k] || [];
              const isToday = k === todayKey;
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const cls = `mtg-day${outside ? ' outside' : ''}${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}`;
              return (
                <button key={k} className={cls} onClick={() => openSchedule(k)}>
                  <span className={`mtg-daynum${isToday ? ' today' : ''}`}>{date.getDate()}</span>
                  {dayMeetings.slice(0, 3).map(m => (
                    <span key={m.id} className="mtg-chip" onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                      title={`${fmtTime(m.starts_at)} · ${m.title}${m.recurrence === 'weekly' ? ' (weekly)' : ''}`}>
                      <b>{fmtTime(m.starts_at)}</b>
                      <span className="mtg-chip-t">{m.title}</span>
                      {m.recurrence === 'weekly' && <Repeat size={8} style={{ flexShrink: 0, opacity: 0.75 }} />}
                    </span>
                  ))}
                  {dayMeetings.length > 3 && <span className="mtg-more">+{dayMeetings.length - 3} more</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming list */}
        <div style={{ ...C.card, padding: 16, minHeight: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Clock size={14} style={{ color: C.accent }} /> Upcoming
          </div>

          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Loading…</div>
          ) : upcoming.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
              No upcoming meetings. Click a day or <strong style={{ color: 'var(--color-text-secondary)' }}>Schedule meeting</strong> to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map(({ m, startMs, endMs }) => {
                const emails = attendeeEmailsOf(m);
                return (
                  <div key={m.id} style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                        {m.recurrence === 'weekly' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#7EB3FF', background: 'rgba(48,108,236,0.18)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 99, padding: '1px 7px' }}>
                            <Repeat size={9} /> Weekly
                          </span>
                        )}
                      </div>
                      {canEditMeeting(m) && (
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button className="mtg-icon sm" title="Edit" onClick={() => openEdit(m)}><Pencil size={12} /></button>
                          <button className="mtg-icon sm" title="Delete" onClick={() => setConfirmDeleteId(m.id)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                      {fmtDayLabel(startMs)} · {fmtTime(startMs)}–{fmtTime(endMs)}
                    </div>
                    {(m.attendee_ids?.length > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        <Users size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                        {m.attendee_ids.map(id => memberById[id]?.full_name || memberById[id]?.email || 'Member').slice(0, 3).join(', ')}
                        {m.attendee_ids.length > 3 && ` +${m.attendee_ids.length - 3}`}
                      </div>
                    )}

                    {confirmDeleteId === m.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600 }}>Delete?</span>
                        <button className="mtg-btn danger sm" onClick={() => deleteMeeting(m)}>Delete</button>
                        <button className="mtg-btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                        {m.meet_link && (
                          <a className="mtg-btn primary sm" href={m.meet_link} target="_blank" rel="noreferrer">
                            <Video size={12} /> Join Meet
                          </a>
                        )}
                        <a className="mtg-btn ghost sm" href={buildGoogleCalendarUrl(m, emails)} target="_blank" rel="noreferrer">
                          <ExternalLink size={12} /> Add to Google Calendar
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Schedule / edit modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg-elevated, #0d1b38)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{editingId ? 'Edit meeting' : 'Schedule meeting'}</div>
              <button className="mtg-icon" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <label className="mtg-lbl">Title *</label>
            <input className="mtg-input" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Weekly team sync" autoFocus />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label className="mtg-lbl">Date</label>
                <input className="mtg-input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div>
                <label className="mtg-lbl">Time</label>
                <input className="mtg-input" type="time" value={fTime} onChange={e => setFTime(e.target.value)} />
              </div>
              <div>
                <label className="mtg-lbl">Duration</label>
                <select className="mtg-input" value={fDuration} onChange={e => setFDuration(Number(e.target.value))}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} hr${d >= 120 ? 's' : ''}`}</option>)}
                </select>
              </div>
            </div>

            <label className="mtg-lbl" style={{ marginTop: 12 }}>Repeat</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ v: 'none', l: 'Does not repeat' }, { v: 'weekly', l: 'Weekly' }].map(opt => {
                const on = fRepeat === opt.v;
                return (
                  <button key={opt.v} type="button" onClick={() => setFRepeat(opt.v)}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      height: 38, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                      background: on ? 'rgba(48,108,236,0.20)' : 'var(--color-bg-tertiary)',
                      border: `1px solid ${on ? 'rgba(48,108,236,0.5)' : 'var(--color-border)'}`,
                      color: on ? '#7EB3FF' : 'var(--color-text-secondary)',
                    }}>
                    {opt.v === 'weekly' && <Repeat size={13} />}{opt.l}
                  </button>
                );
              })}
            </div>
            {fRepeat === 'weekly' && (
              <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                Repeats every week on {weekdayName}s at {fTime}.
              </div>
            )}

            <label className="mtg-lbl" style={{ marginTop: 12 }}>Google Meet link</label>
            {autoCreatesMeet && !editingId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 10, padding: '9px 11px', fontSize: 11.5, color: '#8fe4ab' }}>
                <Video size={14} /> A Google Meet link will be created automatically and invites emailed to attendees.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="mtg-input" value={fMeetLink} onChange={e => setFMeetLink(e.target.value)} placeholder="https://meet.google.com/…" style={{ flex: 1 }} />
                  <a className="mtg-btn ghost" href="https://meet.google.com/new" target="_blank" rel="noreferrer" title="Create a new Google Meet, then paste the link here">
                    <Link2 size={13} /> New Meet
                  </a>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  Click “New Meet” to create a room, then paste its link so everyone joins the same call.
                </div>
              </>
            )}

            <label className="mtg-lbl" style={{ marginTop: 12 }}>Attendees</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {members.filter(mm => mm.id !== currentUserId).length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>No other agency members found.</span>
              )}
              {members.filter(mm => mm.id !== currentUserId).map(mm => {
                const on = fAttendees.includes(mm.id);
                return (
                  <button key={mm.id} type="button" onClick={() => toggleAttendee(mm.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                      background: on ? 'rgba(48,108,236,0.22)' : 'var(--color-bg-tertiary)',
                      border: `1px solid ${on ? 'rgba(48,108,236,0.5)' : 'var(--color-border)'}`,
                      color: on ? '#7EB3FF' : 'var(--color-text-secondary)', fontWeight: 600,
                    }}>
                    {on && <Check size={12} />}{mm.full_name || mm.email}
                  </button>
                );
              })}
            </div>

            <label className="mtg-lbl" style={{ marginTop: 12 }}>Agenda / notes</label>
            <textarea className="mtg-input" value={fDesc} onChange={e => setFDesc(e.target.value)} rows={3} placeholder="What's this meeting about?" style={{ resize: 'vertical', minHeight: 64, paddingTop: 8 }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="mtg-btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="mtg-btn primary" onClick={saveMeeting} disabled={!canSave}>
                <Check size={14} /> {editingId ? 'Save changes' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mtg-lbl { display:block; font-size:11px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:.05em; margin-bottom:5px; }
        .mtg-input {
          width:100%; background:var(--color-bg-tertiary); border:1px solid var(--color-border);
          border-radius:10px; height:40px; padding:0 12px; font-size:13px; color:var(--color-text-primary);
          font-family:inherit; outline:none; transition:.12s;
        }
        textarea.mtg-input { height:auto; }
        .mtg-input::placeholder { color:var(--color-text-tertiary); }
        .mtg-input:focus { border-color:var(--color-border-active); box-shadow:0 0 0 3px rgba(48,108,236,.15); }
        .mtg-btn {
          display:inline-flex; align-items:center; gap:6px; padding:0 14px; height:38px; border-radius:10px;
          font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; border:1px solid var(--color-border);
          background:var(--color-bg-tertiary); color:var(--color-text-primary); text-decoration:none; white-space:nowrap; transition:.12s;
        }
        .mtg-btn.sm { height:30px; padding:0 10px; font-size:11.5px; border-radius:8px; }
        .mtg-btn:hover { border-color:var(--color-border-active); }
        .mtg-btn.primary, .mtg-btn-primary { background:linear-gradient(135deg,#1E4FB8,#306CEC); border:none; color:#fff; }
        .mtg-btn.primary:disabled { opacity:.5; cursor:not-allowed; }
        .mtg-btn.ghost { background:transparent; }
        .mtg-btn.danger { background:#E0485A; border:none; color:#fff; }
        .mtg-icon {
          width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px;
          background:var(--color-bg-tertiary); border:1px solid var(--color-border); color:var(--color-text-secondary);
          cursor:pointer; transition:.12s;
        }
        .mtg-icon.sm { width:26px; height:26px; border-radius:6px; }
        .mtg-icon:hover { color:var(--color-text-primary); border-color:var(--color-border-active); }

        /* ── Calendar ── */
        .mtg-navgroup { display:flex; align-items:center; gap:2px; background:var(--color-bg-tertiary); border:1px solid var(--color-border); border-radius:10px; padding:2px; }
        .mtg-nav {
          height:28px; min-width:28px; padding:0 6px; display:inline-flex; align-items:center; justify-content:center;
          border:none; background:transparent; color:var(--color-text-secondary); border-radius:8px; cursor:pointer; transition:.12s;
          font-family:inherit; font-size:12px; font-weight:600;
        }
        .mtg-nav:hover { background:var(--color-bg-hover, rgba(255,255,255,0.06)); color:var(--color-text-primary); }
        .mtg-nav-today { padding:0 12px; }

        .mtg-cal { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
        .mtg-dow { text-align:center; font-size:10.5px; font-weight:700; color:#7EB3FF; text-transform:uppercase; letter-spacing:.07em; padding:0 0 8px; }
        .mtg-day {
          position:relative; text-align:left; min-height:98px; padding:6px 6px 5px; border-radius:12px; cursor:pointer;
          background:rgba(255,255,255,0.04); border:1px solid rgba(120,150,210,0.22);
          display:flex; flex-direction:column; gap:3px; overflow:hidden; font-family:inherit; transition:transform .12s, border-color .12s, background .12s;
        }
        .mtg-day:hover { background:rgba(48,108,236,0.14); border-color:rgba(48,108,236,0.6); transform:translateY(-1px); }
        .mtg-day.outside { background:rgba(255,255,255,0.015); border-color:rgba(120,150,210,0.10); }
        .mtg-day.outside:hover { background:rgba(48,108,236,0.10); border-color:rgba(48,108,236,0.4); }
        .mtg-day.today { border-color:#306CEC; background:rgba(48,108,236,0.16); box-shadow:0 0 0 1px rgba(48,108,236,0.5) inset; }
        .mtg-daynum {
          display:inline-flex; align-items:center; justify-content:center; align-self:flex-start;
          min-width:22px; height:22px; padding:0 4px; border-radius:11px;
          font-size:12px; font-weight:700; color:var(--color-text-primary); font-variant-numeric:tabular-nums;
        }
        .mtg-day.weekend .mtg-daynum { color:#8FB4E8; }
        .mtg-day.outside .mtg-daynum { color:var(--color-text-tertiary); opacity:.7; }
        .mtg-daynum.today { background:linear-gradient(135deg,#1E4FB8,#306CEC); color:#fff; box-shadow:0 2px 8px rgba(48,108,236,.5); }
        .mtg-chip {
          display:flex; align-items:center; gap:4px; font-size:10px; line-height:1.35; color:#EAF1FF;
          background:rgba(48,108,236,0.24); border-left:3px solid #5B9BFF; border-radius:4px 6px 6px 4px;
          padding:2px 5px; overflow:hidden; transition:background .1s;
        }
        .mtg-chip:hover { background:rgba(48,108,236,0.4); }
        .mtg-chip b { flex-shrink:0; color:#7EB3FF; font-weight:700; font-variant-numeric:tabular-nums; }
        .mtg-chip-t { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mtg-more { font-size:9.5px; color:var(--color-text-tertiary); font-weight:700; padding-left:4px; margin-top:1px; }

        @media (max-width: 768px) {
          .mtg-cal { gap:3px; }
          .mtg-day { min-height:58px; padding:3px; border-radius:8px; }
          .mtg-daynum { min-width:17px; height:17px; font-size:10.5px; }
          .mtg-chip { font-size:8px; padding:1px 3px; gap:2px; border-left-width:2px; }
          .mtg-dow { font-size:9px; padding-bottom:5px; }
        }
      `}</style>
    </div>
  );
}
