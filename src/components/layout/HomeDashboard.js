'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil, Plus, X, Check, Flag, Rocket, Compass, Target,
  ListChecks, Square, CheckSquare, TrendingUp, TrendingDown, Sigma, BarChart3,
  Users, Trophy, ArrowRight, MessageSquare,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import ImgOrFallback from '@/components/ui/ImgOrFallback';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const STAGES = ['Launching', 'Growing', 'Scaling', 'Optimizing'];
const STAGE_TINT = { Launching: '#EC4899', Growing: '#22C55E', Scaling: '#5B9BFF', Optimizing: '#F5A623' };
const DEFAULT_VISION = 'We are not building agencies. We are building an interconnected African innovation ecosystem where every company strengthens the others and creates lasting economic impact.';

const emptyForm = () => ({ purpose: '', lead_name: '', stage: 'Growing', vision: '', mission: '', objectives_year: String(new Date().getFullYear()), objectives: [''], monthly_goals: [''], metrics: [{ label: '', value: '' }] });

export default function HomeDashboard() {
  const { userProfile, workspace, agencies, activeAgencyId, isDemo, setCurrentView, unreadChatChannels, chatNotifs, clearChatNotifications } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const router = useRouter();

  const [now] = useState(() => new Date());
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const agency = agencies?.find((a) => a.id === activeAgencyId) || null;
  const canEdit = isDemo || ['manager', 'superadmin'].includes(userProfile?.role);
  const name = userProfile?.full_name?.split(' ')[0] || 'there';

  const [strategy, setStrategy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [financeRows, setFinanceRows] = useState([]);
  const [myMission, setMyMission] = useState(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [members, setMembers] = useState([]);
  const [teamMissions, setTeamMissions] = useState([]);

  // Strategy content for this agency.
  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient().from('agency_strategy').select('*').eq('agency_id', agencyId).maybeSingle();
      if (!cancelled) setStrategy(data || null);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  // Every finance entry ever logged for this agency — powers both the current
  // month's Financial Dashboard tiles and the multi-year Annual Growth Tracker.
  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient().from('daily_finance').select('entry_date, revenue, expenses').eq('agency_id', agencyId);
      if (!cancelled) setFinanceRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  // My mission record (for "My Impact This Week") + realtime, so a task posted
  // from the Daily Tasks chat channel appears here without a reload.
  useEffect(() => {
    if (isDemo || !agencyId || !userProfile?.id) return;
    let cancelled = false;
    async function load() {
      const { data } = await createClient().from('member_missions').select('*').eq('agency_id', agencyId).eq('user_id', userProfile.id).maybeSingle();
      if (!cancelled) setMyMission(data || null);
    }
    load();
    const sb = createClient();
    const ch = sb.channel(`mymission:${agencyId}:${userProfile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_missions', filter: `user_id=eq.${userProfile.id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, userProfile?.id]);

  // Team Member Focus Board — every teammate's mission, right on the homepage.
  useEffect(() => {
    if (isDemo || !workspace?.id) return;
    let cancelled = false;
    fetch(`/os/api/workspaces/${workspace.id}/chat-members`).then((r) => r.json())
      .then((j) => { if (!cancelled && Array.isArray(j.data)) setMembers(j.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [workspace?.id, isDemo]);

  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient().from('member_missions').select('*').eq('agency_id', agencyId);
      if (!cancelled) setTeamMissions(data || []);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  const missionByUser = useMemo(() => {
    const map = new Map();
    teamMissions.forEach((m) => map.set(m.user_id, m));
    return map;
  }, [teamMissions]);

  const objectives = Array.isArray(strategy?.objectives) ? strategy.objectives.filter(Boolean) : [];
  const monthlyGoals = Array.isArray(strategy?.monthly_goals) ? strategy.monthly_goals.filter(Boolean) : [];
  const scoreMetrics = Array.isArray(strategy?.metrics) ? strategy.metrics.filter((m) => m?.label) : [];

  // Current month's Revenue / Expenses / Profit — the Financial Dashboard.
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fin = useMemo(() => {
    let revenue = 0, expenses = 0;
    financeRows.forEach((r) => {
      if (!(r.entry_date || '').startsWith(ym)) return;
      revenue += Number(r.revenue) || 0;
      expenses += Number(r.expenses) || 0;
    });
    return { revenue, expenses, profit: revenue - expenses };
  }, [financeRows, ym]);

  // Every year with entries, oldest first — the Annual Growth Tracker. Growth
  // is year-over-year revenue growth vs. the prior year in the list.
  const finByYear = useMemo(() => {
    const map = new Map();
    financeRows.forEach((r) => {
      const year = (r.entry_date || '').slice(0, 4);
      if (!year) return;
      if (!map.has(year)) map.set(year, { year, revenue: 0, expenses: 0 });
      const e = map.get(year);
      e.revenue += Number(r.revenue) || 0;
      e.expenses += Number(r.expenses) || 0;
    });
    const years = [...map.values()].sort((a, b) => a.year.localeCompare(b.year));
    return years.map((y, i) => {
      const profit = y.revenue - y.expenses;
      const prevRevenue = i > 0 ? years[i - 1].revenue : null;
      const growth = prevRevenue != null && prevRevenue > 0 ? Math.round(((y.revenue - prevRevenue) / prevRevenue) * 100) : null;
      return { ...y, profit, growth };
    });
  }, [financeRows]);

  // My Impact This Week — Tasks Assigned (autosaving checklist) + Expected
  // Outcomes (read-only here; edited on the Team tab, where the rest of the
  // mission — priorities, KPIs, department — lives).
  const myTasks = Array.isArray(myMission?.tasks) ? myMission.tasks : [];
  const myOutcomes = Array.isArray(myMission?.outcomes) ? myMission.outcomes.filter(Boolean) : [];
  const persistMyTasks = async (nextTasks) => {
    setMyMission((m) => ({ ...(m || {}), tasks: nextTasks }));
    if (isDemo || !agencyId || !userProfile?.id) return;
    try {
      await createClient().from('member_missions').upsert({
        agency_id: agencyId, user_id: userProfile.id,
        department: myMission?.department ?? null, mission: myMission?.mission ?? null,
        priorities: myMission?.priorities ?? [], outcomes: myMission?.outcomes ?? [],
        weekly_objectives: myMission?.weekly_objectives ?? [], kpis: myMission?.kpis ?? [],
        tasks: nextTasks, updated_at: new Date().toISOString(),
      }, { onConflict: 'agency_id,user_id' });
    } catch (err) { console.error('[home] task save failed', err); }
  };
  const toggleMyTask = (i) => persistMyTasks(myTasks.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)));
  const removeMyTask = (i) => persistMyTasks(myTasks.filter((_, idx) => idx !== i));
  const addMyTask = () => {
    const text = taskDraft.trim();
    if (!text) return;
    persistMyTasks([...myTasks, { text, done: false }]);
    setTaskDraft('');
  };

  const startEdit = () => {
    setForm({
      purpose: strategy?.purpose || '',
      lead_name: strategy?.lead_name || '',
      stage: strategy?.stage || 'Growing',
      vision: strategy?.vision || '',
      mission: strategy?.mission || '',
      objectives_year: strategy?.objectives_year || String(now.getFullYear()),
      objectives: objectives.length ? [...objectives] : [''],
      monthly_goals: monthlyGoals.length ? [...monthlyGoals] : [''],
      metrics: scoreMetrics.length ? scoreMetrics.map((m) => ({ label: m.label || '', value: m.value ?? '' })) : [{ label: '', value: '' }],
    });
    setEditing(true);
  };

  const save = async () => {
    const clean = {
      agency_id: agencyId,
      purpose: form.purpose.trim() || null,
      lead_name: form.lead_name.trim() || null,
      stage: form.stage || null,
      vision: form.vision.trim() || null,
      mission: form.mission.trim() || null,
      objectives_year: form.objectives_year.trim() || null,
      objectives: form.objectives.map((o) => o.trim()).filter(Boolean),
      monthly_goals: form.monthly_goals.map((o) => o.trim()).filter(Boolean),
      metrics: form.metrics.map((m) => ({ label: (m.label || '').trim(), value: (m.value || '').toString().trim() })).filter((m) => m.label),
    };
    setSaving(true);
    if (!isDemo && agencyId) {
      try { await createClient().from('agency_strategy').upsert({ ...clean, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' }); }
      catch (err) { console.error('[strategy] save failed', err); }
    }
    setStrategy((s) => ({ ...(s || {}), ...clean }));
    setSaving(false);
    setEditing(false);
  };

  // ── tokens ──
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  // Card-based dashboard, matching the reference: rounded, softly-tinted,
  // bordered panels in a two-column layout (content stream + widget rail).
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };
  const stage = strategy?.stage || null;
  const stageTint = STAGE_TINT[stage] || '#5B9BFF';

  const cardHeader = (Icon, tint, title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></div>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>{title}</h2>
      </div>
      {right}
    </div>
  );

  const myDone = myTasks.filter((t) => t.done).length;
  const myProgress = myTasks.length ? Math.round((myDone / myTasks.length) * 100) : 0;

  // Bigger type for a short mandate, scaling down as the word count grows, so a
  // one-line phrase can be bold and dramatic while a longer sentence still fits
  // cleanly without overflowing the column.
  const mandateFontSize = (text) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length || 12;
    if (isMobile) return words <= 10 ? 20 : words <= 20 ? 17 : words <= 35 ? 15 : 14;
    return words <= 10 ? 28 : words <= 20 ? 22 : words <= 35 ? 18 : 15.5;
  };
  const mandatePlaceholder = 'Add this agency’s core mandate via "Edit strategy".';

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 36px 80px', color: tKey }}>
      {/* Edit strategy — top-right, above the two-column hero */}
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', border: 'none', flexShrink: 0 }}>
            <Pencil size={13} /> Edit strategy
          </button>
        </div>
      )}

      {/* Hero — identity + greeting (left), Vision & Mission (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 32, marginBottom: isMobile ? 20 : 24, alignItems: 'stretch' }}>
        {/* LEFT — identity + greeting, top-aligned */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div style={{ width: isMobile ? 56 : 68, height: isMobile ? 56 : 68, borderRadius: 16, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: isMobile ? 22 : 27, fontWeight: 800, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
              <ImgOrFallback src={agency?.logo_url} fallback={(agency?.name || 'A').charAt(0).toUpperCase()} />
            </div>
            <span style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, color: tKey }}>{agency?.name || 'Your agency'}</span>
            {stage ? (
              <span style={{ fontSize: 11, fontWeight: 800, color: stageTint, background: `${stageTint}20`, border: `1px solid ${stageTint}44`, padding: '3px 10px', borderRadius: 999 }}>{stage}</span>
            ) : canEdit ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: tSub, border: '1px dashed var(--color-border-subtle, rgba(48,108,236,0.3))', padding: '3px 10px', borderRadius: 999, fontStyle: 'italic' }}>Add phase</span>
            ) : null}
          </div>
          <div style={{ fontSize: isMobile ? 20 : 25, fontWeight: 800, color: tKey, letterSpacing: '-.01em', marginTop: 12 }}>{greeting}, {name}</div>
          <div style={{ fontSize: 13, color: tSub, fontWeight: 500, marginTop: 4 }}>{dateLabel}</div>
          {strategy?.purpose ? (
            <p style={{ fontSize: mandateFontSize(strategy.purpose), color: tKey, fontWeight: 700, marginTop: 20, lineHeight: 1.4, letterSpacing: '-.01em' }}>
              {strategy.purpose}
            </p>
          ) : canEdit ? (
            <p style={{ fontSize: mandateFontSize(mandatePlaceholder), color: tSub, fontWeight: 500, marginTop: 20, lineHeight: 1.4, fontStyle: 'italic' }}>
              {mandatePlaceholder}
            </p>
          ) : null}
          {strategy?.lead_name && (
            <div style={{ fontSize: 12.5, color: tSub, fontWeight: 600, marginTop: 12 }}>Lead: {strategy.lead_name}</div>
          )}

          {/* This Month — Revenue / Expenses / Profit, as individual cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 12, marginTop: 24 }}>
            {[
              { label: 'Revenue', value: fin.revenue, Icon: TrendingUp, tint: '#22C55E' },
              { label: 'Expenses', value: fin.expenses, Icon: TrendingDown, tint: '#E0485A' },
              { label: 'Profit', value: fin.profit, Icon: Sigma, tint: fin.profit >= 0 ? '#22C55E' : '#E0485A' },
            ].map((t) => (
              <div key={t.label} className="dash-card" style={{ ...card, padding: isMobile ? 12 : 16 }}>
                <t.Icon size={26} style={{ color: t.tint }} />
                <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>{money(t.value)}</div>
                <div style={{ fontSize: 11, color: tSub, marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Vision & Mission flashcards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="dash-card" style={card}>
            {cardHeader(Compass, '#5B9BFF', 'Vision')}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5B9BFF', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Where are we going?</div>
            <p style={{ margin: 0, fontSize: isMobile ? 15 : 17, lineHeight: 1.4, fontWeight: 700, fontStyle: 'italic', color: strategy?.vision ? tKey : tSub }}>
              “{strategy?.vision || (canEdit ? 'Set the long-term vision this agency is working toward, via "Edit strategy".' : DEFAULT_VISION)}”
            </p>
          </div>

          <div className="dash-card" style={{ ...card, minHeight: isMobile ? undefined : 150 }}>
            {cardHeader(Target, '#22C55E', 'Mission')}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Why do we exist?</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: strategy?.mission ? tKey : tSub, fontStyle: strategy?.mission ? 'normal' : 'italic' }}>
              {strategy?.mission || (canEdit ? 'Define how this agency delivers on the vision, via "Edit strategy".' : 'How this agency delivers on the vision.')}
            </p>
          </div>
        </div>
      </div>

      {/* Second hero row — Tasks (left) and Messages (right) share this grid row so their tops align exactly */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: isMobile ? 20 : 32, marginBottom: 28, alignItems: 'stretch' }}>
        {/* My Tasks This Week */}
        <div className="dash-card" style={{ ...card, minWidth: 0, minHeight: isMobile ? undefined : 280 }}>
          {cardHeader(ListChecks, '#EC4899', 'My Tasks This Week',
            <button onClick={() => setCurrentView('team')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#EC4899', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
              Full mission <ArrowRight size={11} />
            </button>
          )}
          {myTasks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: tSub, marginBottom: 6 }}><span>Progress</span><span style={{ fontWeight: 800, color: tKey }}>{myProgress}%</span></div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${myProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#DB2777,#EC4899)', transition: 'width .3s' }} /></div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {myTasks.length === 0 && <div style={{ fontSize: 13, color: tSub, fontStyle: 'italic', marginBottom: 4 }}>No tasks yet.</div>}
            {myTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => toggleMyTask(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.done ? '#22C55E' : tSub, display: 'flex', padding: 0, flexShrink: 0 }}>{t.done ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.done ? tSub : tKey, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button onClick={() => removeMyTask(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, display: 'flex', padding: 0, flexShrink: 0 }}><X size={13} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
              <input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMyTask(); } }} placeholder="Add a task…"
                style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.16))', borderRadius: 9, padding: '7px 10px', fontSize: 12.5, color: tKey, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={addMyTask} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 9, border: '1px dashed var(--color-border-subtle, rgba(48,108,236,0.3))', background: 'transparent', color: '#EC4899', cursor: 'pointer' }}><Plus size={13} /></button>
            </div>
          </div>
          {myOutcomes.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 9 }}>Expected outcome</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {myOutcomes.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckSquare size={15} style={{ color: '#22C55E', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages — unread conversations */}
        <div className="dash-card" style={{ ...card, minWidth: 0, minHeight: isMobile ? undefined : 280 }}>
          {cardHeader(MessageSquare, '#5B9BFF', 'Messages',
            <button onClick={() => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#5B9BFF', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
              Open <ArrowRight size={11} />
            </button>
          )}
          {!unreadChatChannels || unreadChatChannels.length === 0 ? (
            <div style={{ fontSize: 13, color: tSub, fontStyle: 'italic' }}>No new messages.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unreadChatChannels.slice(0, 6).map((ch) => {
                const n = chatNotifs?.[ch] || {};
                const who = n.senderName || 'Someone';
                const preview = n.message || (n.count > 1 ? `${n.count} new messages` : 'New message');
                return (
                  <button key={ch} onClick={() => { clearChatNotifications(ch); router.push(`/chat?${workspace?.id ? `workspaceId=${workspace.id}&` : ''}channel=${encodeURIComponent(ch)}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', padding: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 }}>
                      {who.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
                        {n.count > 1 && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#5B9BFF', background: 'rgba(48,108,236,0.16)', borderRadius: 999, padding: '0 5px', marginLeft: 'auto', flexShrink: 0 }}>{n.count}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: tSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two-column dashboard: content stream (left) + widget rail (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* LEFT — content stream */}
        <div className="card-col" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Team Member Focus Board */}
          <div className="dash-card" style={card}>
            {cardHeader(Users, '#5B9BFF', 'Team Member Focus Board')}
            {members.length === 0 ? (
              <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No team members loaded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {members.map((m, i) => {
                  const mm = missionByUser.get(m.id) || {};
                  const priorities = Array.isArray(mm.priorities) ? mm.priorities.filter(Boolean) : [];
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 12, paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                        <ImgOrFallback src={m.avatar_url} fallback={(m.full_name || m.email || '?').charAt(0).toUpperCase()} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: tKey }}>{m.full_name || m.email}</span>
                          <span style={{ fontSize: 11, color: tSub, textTransform: 'capitalize' }}>{m.role}{mm.department ? ` · ${mm.department}` : ''}</span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.5, color: mm.mission ? tSub : tSub, fontStyle: mm.mission ? 'normal' : 'italic' }}>{mm.mission || 'No mission set yet.'}</p>
                        {priorities.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                            {priorities.map((p, j) => (
                              <span key={j} style={{ fontSize: 11, fontWeight: 600, color: '#7EB3FF', background: 'rgba(48,108,236,0.14)', borderRadius: 999, padding: '3px 9px' }}>{p}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — widget rail */}
        <div className="card-col" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Annual Growth Tracker */}
          {finByYear.length > 0 && (
            <div className="dash-card" style={card}>
              {cardHeader(BarChart3, '#5B9BFF', 'Annual Growth')}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14, minHeight: 60 }}>
                {(() => {
                  const maxRev = Math.max(...finByYear.map((y) => y.revenue), 1);
                  return finByYear.map((y) => (
                    <div key={y.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                      <div style={{ width: '100%', height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(8, (y.revenue / maxRev) * 100)}%`, borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg,#7EB3FF,#1E4FB8)' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tSub }}>{y.year}</span>
                    </div>
                  ));
                })()}
              </div>
              {(() => {
                const latest = finByYear[finByYear.length - 1];
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(latest.revenue)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: latest.growth == null ? tSub : latest.growth < 0 ? '#E0485A' : '#22C55E' }}>{latest.growth == null ? '—' : `${latest.growth > 0 ? '+' : ''}${latest.growth}%`}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Agency Scoreboard */}
          {(scoreMetrics.length > 0 || canEdit) && (
            <div className="dash-card" style={card}>
              {cardHeader(Trophy, '#F5C542', 'Scoreboard')}
              {scoreMetrics.length === 0 ? (
                <div style={{ fontSize: 13, color: tSub, fontStyle: 'italic' }}>Add metrics via &quot;Edit strategy&quot;.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {scoreMetrics.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, color: tSub, fontWeight: 600 }}>{m.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{m.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Strategic Direction */}
          <div className="dash-card" style={card}>
            {cardHeader(Flag, '#F5A623', `Our ${strategy?.objectives_year || now.getFullYear()} Objective`)}
            {objectives.length === 0 ? (
              <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No objectives set yet.{canEdit ? ' Add them via "Edit strategy".' : ''}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {objectives.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: 'rgba(245,166,35,0.16)', color: '#F5A623', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{o}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Goals */}
          <div className="dash-card" style={card}>
            {cardHeader(Rocket, '#14B8A6', 'Monthly Goals')}
            {monthlyGoals.length === 0 ? (
              <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No goals set for this month yet.{canEdit ? ' Add them via "Edit strategy".' : ''}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {monthlyGoals.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: 'rgba(20,184,166,0.16)', color: '#14B8A6', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{g}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit strategy modal */}
      {editing && (
        <div onClick={() => setEditing(false)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(2,5,12,0.82)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)', margin: '20px 0', background: '#0b1120', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Edit agency strategy</span>
              <button onClick={() => setEditing(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#D8E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 160px', gap: 12 }}>
                <Field label="Agency lead"><input className="strat-in" value={form.lead_name} onChange={(e) => setForm((f) => ({ ...f, lead_name: e.target.value }))} placeholder="e.g. Angela Odongo" /></Field>
                <Field label="Growth stage">
                  <select className="strat-in" value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Core mandate"><textarea className="strat-in" rows={2} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="What this agency exists to do and the value it creates" /></Field>
              <Field label="Our Vision"><textarea className="strat-in" rows={2} value={form.vision} onChange={(e) => setForm((f) => ({ ...f, vision: e.target.value }))} placeholder="The long-term vision" /></Field>
              <Field label="Our Mission"><textarea className="strat-in" rows={2} value={form.mission} onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))} placeholder="How the agency delivers on the vision" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: 12, alignItems: 'start' }}>
                <Field label="Objectives year"><input className="strat-in" value={form.objectives_year} onChange={(e) => setForm((f) => ({ ...f, objectives_year: e.target.value }))} placeholder="2026" /></Field>
                <Field label="Strategic objectives">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {form.objectives.map((o, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7 }}>
                        <input className="strat-in" value={o} onChange={(e) => setForm((f) => ({ ...f, objectives: f.objectives.map((x, j) => j === i ? e.target.value : x) }))} placeholder={`Objective ${i + 1}`} />
                        <button onClick={() => setForm((f) => ({ ...f, objectives: f.objectives.length > 1 ? f.objectives.filter((_, j) => j !== i) : [''] }))} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
                      </div>
                    ))}
                    <button onClick={() => setForm((f) => ({ ...f, objectives: [...f.objectives, ''] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add objective</button>
                  </div>
                </Field>
              </div>
              <Field label="Monthly goals">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {form.monthly_goals.map((g, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7 }}>
                      <input className="strat-in" value={g} onChange={(e) => setForm((f) => ({ ...f, monthly_goals: f.monthly_goals.map((x, j) => j === i ? e.target.value : x) }))} placeholder={`Goal ${i + 1}`} />
                      <button onClick={() => setForm((f) => ({ ...f, monthly_goals: f.monthly_goals.length > 1 ? f.monthly_goals.filter((_, j) => j !== i) : [''] }))} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm((f) => ({ ...f, monthly_goals: [...f.monthly_goals, ''] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add goal</button>
                </div>
              </Field>
              <Field label="Agency scoreboard metrics">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {form.metrics.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 30px', gap: 7 }}>
                      <input className="strat-in" value={m.label} onChange={(e) => setForm((f) => ({ ...f, metrics: f.metrics.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} placeholder="e.g. Clients acquired" />
                      <input className="strat-in" value={m.value} onChange={(e) => setForm((f) => ({ ...f, metrics: f.metrics.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value" />
                      <button onClick={() => setForm((f) => ({ ...f, metrics: f.metrics.length > 1 ? f.metrics.filter((_, j) => j !== i) : [{ label: '', value: '' }] }))} style={{ width: 30, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm((f) => ({ ...f, metrics: [...f.metrics, { label: '', value: '' }] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add metric</button>
                </div>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: '#9DB8DD', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={15} /> Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .strat-in {
          width: 100%; box-sizing: border-box; background: var(--color-bg-tertiary, rgba(255,255,255,0.04));
          border: 1px solid var(--color-border-subtle, rgba(48,108,236,0.16)); border-radius: 10px;
          padding: 9px 12px; font-size: 13.5px; color: var(--color-text-primary, #E2EEFF); font-family: inherit;
          outline: none; resize: vertical; line-height: 1.5;
        }
        .strat-in:focus { border-color: rgba(48,108,236,0.55); }

        .dash-card {
          animation: cardIn 0.6s cubic-bezier(.34,1.56,.64,1) both;
          transition: transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease, border-color .3s ease;
        }
        .dash-card:hover {
          transform: translateY(-6px) scale(1.015);
          box-shadow: 0 16px 40px rgba(0,0,0,0.32), 0 0 0 1px rgba(91,155,255,0.12), 0 0 24px rgba(91,155,255,0.14);
          border-color: rgba(91,155,255,0.45);
        }
        .dash-card:active {
          transform: translateY(-3px) scale(0.99);
        }
        .card-icon-badge {
          transition: transform .35s cubic-bezier(.34,1.56,.64,1);
        }
        .dash-card:hover .card-icon-badge {
          transform: scale(1.18) rotate(-8deg);
        }
        .card-col > .dash-card:nth-child(1) { animation-delay: .05s; }
        .card-col > .dash-card:nth-child(2) { animation-delay: .15s; }
        .card-col > .dash-card:nth-child(3) { animation-delay: .25s; }
        .card-col > .dash-card:nth-child(4) { animation-delay: .35s; }
        .card-col > .dash-card:nth-child(5) { animation-delay: .45s; }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dash-card, .dash-card:hover, .dash-card:active, .card-icon-badge, .dash-card:hover .card-icon-badge {
            animation: none; transition: none; transform: none;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
