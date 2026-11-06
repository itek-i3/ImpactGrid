'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil, Plus, X, Check, Rocket, Compass, Target,
  ListChecks, Square, CheckSquare, TrendingUp, TrendingDown, Sigma, BarChart3,
  Users, Trophy, ArrowRight, MessageSquare, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { focusFirstError } from '@/lib/utils/formErrors';
import { useToast } from '@/components/ui/Toast';
import ImgOrFallback from '@/components/ui/ImgOrFallback';
import RoadmapCard from '@/components/layout/RoadmapCard';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const STAGES = ['Launching', 'Growing', 'Scaling', 'Optimizing'];
const STAGE_TINT = { Launching: '#EC4899', Growing: '#22C55E', Scaling: '#5B9BFF', Optimizing: '#F5A623' };
const DEFAULT_VISION = 'We are not building agencies. We are building an interconnected African innovation ecosystem where every company strengthens the others and creates lasting economic impact.';

const emptyForm = () => ({ purpose: '', lead_name: '', stage: 'Growing', vision: '', mission: '', monthly_goals: [''], metrics: [{ label: '', value: '' }] });

export default function HomeDashboard() {
  const { userProfile, workspace, agencies, activeAgencyId, isDemo, setCurrentView, unreadChatChannels, chatNotifs, clearChatNotifications } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const router = useRouter();
  const toast = useToast();

  const [now] = useState(() => new Date());
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const agency = agencies?.find((a) => a.id === activeAgencyId) || null;
  // Every other agency I belong to (a superadmin is a member of all of them), so
  // a mission can be set in each in one go. Nothing to write to in demo mode.
  const otherAgencies = isDemo ? [] : (agencies || []).filter((a) => a?.id && a.id !== agencyId);
  const canEdit = isDemo || ['manager', 'superadmin'].includes(userProfile?.role);
  const name = userProfile?.full_name?.split(' ')[0] || 'there';

  const [strategy, setStrategy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [financeRows, setFinanceRows] = useState([]);
  const [myMission, setMyMission] = useState(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [outcomeDraft, setOutcomeDraft] = useState('');
  // The task being completed right now (the task object itself, not an index —
  // see persistMyTasks below for why object identity is how updates are matched).
  // null = modal closed.
  const [completingTask, setCompletingTask] = useState(null);
  const [completionType, setCompletionType] = useState(''); // 'achieved' | 'challenge'
  const [completionNote, setCompletionNote] = useState('');
  const [completionError, setCompletionError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [members, setMembers] = useState([]);
  const [teamMissions, setTeamMissions] = useState([]);
  const [missionOpen, setMissionOpen] = useState(false);
  const [missionForm, setMissionForm] = useState({ department: '', mission: '', priorities: [''] });
  const [missionSaving, setMissionSaving] = useState(false);
  const [missionError, setMissionError] = useState(false);
  const [missionSaveError, setMissionSaveError] = useState('');
  const [missionApplyAll, setMissionApplyAll] = useState(false);

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
  // Also pulls in any agency linked to one of this agency's business rows
  // (e.g. ACR's "itek" business linked to itek's own agency) so the total
  // reflects every portfolio business and agency together, not just the
  // ones logged directly under this agency_id — except businesses flipped to
  // "not managed" (e.g. ACR's BiteBack), which drop out of the total the
  // same way they drop out of the Businesses tab.
  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: biz } = await sb.from('businesses').select('id, linked_agency_id, managed').eq('agency_id', agencyId);
      const linkedAgencyIds = [...new Set((biz || []).map((b) => b.linked_agency_id).filter(Boolean))];
      const unmanagedIds = new Set((biz || []).filter((b) => b.managed === false).map((b) => b.id));
      const { data } = await sb.from('daily_finance').select('entry_date, revenue, expenses, business_id').in('agency_id', [agencyId, ...linkedAgencyIds]);
      const rows = (data || []).filter((r) => !r.business_id || !unmanagedIds.has(r.business_id));
      if (!cancelled) setFinanceRows(rows);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  // My mission record (department/mission/priorities/outcomes/kpis — NOT
  // tasks, which moved to user_daily_focus below) + realtime.
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

  // My Today's Focus tasks — ONE global list per user, not scoped to agencyId
  // at all, so it's identical on every agency's Home page. Realtime filter is
  // on user_id only, so a task bridged in from Daily Tasks chat (postable
  // from any of the 9 agencies now) appears here live without a reload.
  const [myFocus, setMyFocus] = useState(null);
  useEffect(() => {
    if (isDemo || !userProfile?.id) return;
    let cancelled = false;
    async function load() {
      const { data } = await createClient().from('user_daily_focus').select('*').eq('user_id', userProfile.id).maybeSingle();
      if (!cancelled) setMyFocus(data || null);
    }
    load();
    const sb = createClient();
    const ch = sb.channel(`myfocus:${userProfile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_daily_focus', filter: `user_id=eq.${userProfile.id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [isDemo, userProfile?.id]);

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

  const monthlyGoals = Array.isArray(strategy?.monthly_goals) ? strategy.monthly_goals.filter(Boolean) : [];
  const scoreMetrics = Array.isArray(strategy?.metrics) ? strategy.metrics.filter((m) => m?.label) : [];

  // Today's local date (YYYY-MM-DD) — scopes "Today's Focus" to just today's
  // tasks, same local-time convention as `ym` below rather than UTC, so the
  // day boundary matches what the person actually sees on their clock.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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

  // Today's Focus — a global (not per-agency, not date-windowed) checklist,
  // stored in user_daily_focus (one JSONB array per USER, not per agency —
  // see the realtime effect above). Each item carries its own `date`
  // (metadata only — when it was first logged, not a display filter),
  // `expectedOutcome`, and once acted on, a required
  // `result: { type: 'achieved'|'challenge', note }`.
  //
  // Carry-forward: a task stays visible — today, tomorrow, however many days
  // it takes — until it's marked Achieved. Logging a Challenge does NOT close
  // it out; `done` stays false, so it keeps showing (with the note visible)
  // and stays clickable to retry. `fullTasks` is the complete array — always
  // what gets persisted, so other (already-achieved) entries are never
  // dropped; `myTasks` is just the still-open subset shown on the card.
  const fullTasks = Array.isArray(myFocus?.tasks) ? myFocus.tasks : [];
  const myTasks = fullTasks.filter((t) => !t.done);
  const fullName = userProfile?.full_name || userProfile?.email || 'Someone';

  // The full member_missions row for me with `patch` applied — every column is
  // sent so an upsert from here never blanks fields edited on the Team tab.
  // No `tasks` key — that column no longer exists on member_missions; tasks
  // live in user_daily_focus now (see persistMyTasks below).
  const myMissionRow = (patch) => ({
    agency_id: agencyId, user_id: userProfile.id,
    department: myMission?.department ?? null, mission: myMission?.mission ?? null,
    priorities: myMission?.priorities ?? [], outcomes: myMission?.outcomes ?? [],
    weekly_objectives: myMission?.weekly_objectives ?? [], kpis: myMission?.kpis ?? [],
    ...patch, updated_at: new Date().toISOString(),
  });
  // Global: writes to user_daily_focus (keyed by user_id alone), which every
  // agency's Home page for this user reads — always takes the FULL array so
  // other (already-achieved) entries are never dropped.
  const persistMyTasks = async (nextTasks) => {
    setMyFocus((f) => ({ ...(f || {}), tasks: nextTasks }));
    if (isDemo || !userProfile?.id) return;
    try {
      await createClient().from('user_daily_focus').upsert(
        { user_id: userProfile.id, tasks: nextTasks, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    } catch (err) { console.error('[home] task save failed', err); }
  };

  // Best-effort post to the Daily Tasks chat channel. skipTaskBridge tells the
  // API not to re-parse this automated message into ANOTHER task — the task
  // this message is about already exists, this is just reporting on it.
  const postToDailyTasks = async (text) => {
    if (isDemo || !workspace?.id) return;
    try {
      await fetch(`/os/api/workspaces/${workspace.id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, channel: 'daily_tasks', skipTaskBridge: true }),
      });
    } catch (err) { console.error('[home] daily tasks post failed', err); }
  };
  // Posted once via "Post to Daily Tasks" — name, then the task list, then
  // the expected outcomes, exactly the 3-line shape asked for.
  const buildFocusSummary = (tasks) => [
    fullName,
    `Tasks: ${tasks.map((t) => t.text).join('; ')}`,
    `Expected outcomes: ${tasks.map((t) => t.expectedOutcome).join('; ')}`,
  ].join('\n');
  // Posted once per task, the moment it's completed.
  const buildCompletionReport = (task, result) => {
    const achieved = result.type === 'achieved';
    return `${fullName} completed: "${task.text}"\n${achieved ? '✅ Achieved' : '⚠️ Challenge'}: ${result.note}`;
  };

  // Set / edit my own mission from the Focus Board. A mission is editable only
  // by the member it belongs to — managers and superadmins included — which the
  // member_missions_write policy enforces; the button is only offered for me.
  const canSetMission = !!userProfile?.id && (isDemo || !!agencyId);
  const openMissionEditor = () => {
    const priorities = Array.isArray(myMission?.priorities) ? myMission.priorities.filter(Boolean) : [];
    setMissionForm({ department: myMission?.department || '', mission: myMission?.mission || '', priorities: priorities.length ? priorities : [''] });
    setMissionError(false);
    setMissionSaveError('');
    setMissionApplyAll(false);
    setMissionOpen(true);
  };
  const saveMyMission = async () => {
    const mission = missionForm.mission.trim();
    if (!mission) { setMissionError(true); focusFirstError(); return; }
    const patch = {
      department: missionForm.department.trim() || null,
      mission,
      priorities: missionForm.priorities.map((s) => s.trim()).filter(Boolean),
    };
    const row = myMissionRow(patch);
    setMissionSaving(true);
    setMissionSaveError('');
    if (!isDemo && agencyId) {
      // supabase-js reports failures (e.g. an RLS rejection) in `error` rather
      // than throwing, so check it and keep the modal open instead of silently
      // showing a mission that never saved.
      const { error } = await createClient().from('member_missions').upsert(row, { onConflict: 'agency_id,user_id' });
      if (error) {
        console.error('[home] mission save failed', error);
        setMissionSaveError('Could not save your mission. Please try again.');
        setMissionSaving(false);
        return;
      }
    }
    setMyMission((m) => ({ ...(m || {}), ...patch }));
    setTeamMissions((list) => [...list.filter((r) => r.user_id !== userProfile.id), { ...(list.find((r) => r.user_id === userProfile.id) || {}), ...row }]);

    // Optionally set the same mission in every other agency I belong to. Only
    // department / mission / priorities are sent, so the upsert merges into an
    // existing row (outcomes, KPIs, tasks there are untouched) and a missing row
    // gets the column defaults. One request, so it's all-or-nothing.
    if (missionApplyAll && otherAgencies.length > 0) {
      const { error } = await createClient().from('member_missions').upsert(
        otherAgencies.map((a) => ({ agency_id: a.id, user_id: userProfile.id, ...patch, updated_at: row.updated_at })),
        { onConflict: 'agency_id,user_id' },
      );
      if (error) {
        console.error('[home] mission save to other agencies failed', error);
        setMissionSaveError('Saved here, but could not update your other agencies. Please try again.');
        setMissionSaving(false);
        return;
      }
      toast.success('Mission saved', `Set in ${otherAgencies.length + 1} of your agencies.`);
    }
    setMissionSaving(false);
    setMissionOpen(false);
  };
  // Un-marking a done task is immediate (no chat message, no modal) — only
  // marking one DONE requires recording a result, see openCompletion below.
  // Matched by object identity rather than index: `task` is a reference taken
  // straight from myTasks, which is a filter() of fullTasks (filter never
  // clones elements), so `t === task` finds the right item in the full array
  // without needing to translate a "today-filtered" index back into one.
  const uncompleteTask = (task) => persistMyTasks(fullTasks.map((t) => (t === task ? { ...t, done: false, result: null } : t)));
  const removeMyTask = (task) => persistMyTasks(fullTasks.filter((t) => t !== task));
  const addMyTask = () => {
    const text = taskDraft.trim();
    const expectedOutcome = outcomeDraft.trim();
    if (!text || !expectedOutcome) return;
    persistMyTasks([...fullTasks, { text, expectedOutcome, done: false, date: todayStr, result: null }]);
    setTaskDraft('');
    setOutcomeDraft('');
  };

  // ── Completing a task: required Achieved/Challenge + note, then posts a
  // completion report to Daily Tasks chat ──────────────────────────────────
  const openCompletion = (task) => {
    setCompletingTask(task);
    setCompletionType('');
    setCompletionNote('');
    setCompletionError(false);
  };
  const submitCompletion = async () => {
    if (!completionType || !completionNote.trim()) { setCompletionError(true); return; }
    const result = { type: completionType, note: completionNote.trim() };
    const task = completingTask;
    // Only Achieved closes the task out. Challenge logs the note but leaves
    // `done: false` — that's the whole carry-forward mechanism: `myTasks`
    // filters on `!done`, so a challenged task keeps showing every day until
    // it's eventually marked Achieved.
    const done = result.type === 'achieved';
    setPosting(true);
    await persistMyTasks(fullTasks.map((t) => (t === task ? { ...t, done, result } : t)));
    await postToDailyTasks(buildCompletionReport(task, result));
    setPosting(false);
    setCompletingTask(null);
  };
  const postFocusSummary = async () => {
    if (!myTasks.length) return;
    setPosting(true);
    await postToDailyTasks(buildFocusSummary(myTasks));
    setPosting(false);
    toast.success('Posted to Daily Tasks', `${myTasks.length} task${myTasks.length > 1 ? 's' : ''} shared with the team.`);
  };

  const startEdit = () => {
    setForm({
      purpose: strategy?.purpose || '',
      lead_name: strategy?.lead_name || '',
      stage: strategy?.stage || 'Growing',
      vision: strategy?.vision || '',
      mission: strategy?.mission || '',
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
  // Light mode swaps the bright dark-theme tints for text-safe shades (the var falls back to the tint in dark).
  const INK = {
    '#22C55E': 'var(--color-success-text, #22C55E)', '#EC4899': 'var(--color-pink-text, #EC4899)', '#F5A623': 'var(--color-warning-text, #F5A623)', '#F5C542': 'var(--color-warning-text, #F5A623)',
    '#14B8A6': 'var(--color-teal-text, #14B8A6)', '#E0485A': 'var(--color-error-text, #E0485A)', '#5B9BFF': 'var(--color-accent-text, #5B9BFF)',
  };
  const ink = (tint) => INK[tint] || tint;

  const cardHeader = (Icon, tint, title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${tint}22`, color: ink(tint), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></div>
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
              <span style={{ fontSize: 11, fontWeight: 800, color: ink(stageTint), background: `${stageTint}20`, border: `1px solid ${stageTint}44`, padding: '3px 10px', borderRadius: 999 }}>{stage}</span>
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
                <t.Icon size={26} style={{ color: ink(t.tint) }} />
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
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--color-accent-text, #5B9BFF)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Where are we going?</div>
            <p style={{ margin: 0, fontSize: isMobile ? 15 : 17, lineHeight: 1.4, fontWeight: 700, fontStyle: 'italic', color: strategy?.vision ? tKey : tSub }}>
              “{strategy?.vision || (canEdit ? 'Set the long-term vision this agency is working toward, via "Edit strategy".' : DEFAULT_VISION)}”
            </p>
          </div>

          <div className="dash-card" style={{ ...card, minHeight: isMobile ? undefined : 150 }}>
            {cardHeader(Target, '#22C55E', 'Mission')}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Why do we exist?</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: strategy?.mission ? tKey : tSub, fontStyle: strategy?.mission ? 'normal' : 'italic' }}>
              {strategy?.mission || (canEdit ? 'Define how this agency delivers on the vision, via "Edit strategy".' : 'How this agency delivers on the vision.')}
            </p>
          </div>
        </div>
      </div>

      {/* Second hero row — Tasks (left) and Messages (right) share this grid row so their tops align exactly; both stay their own natural (short) height instead of stretching to fill it */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: isMobile ? 20 : 32, marginBottom: 28, alignItems: 'start' }}>
        <div className="dash-card" style={{ ...card, minHeight: isMobile ? undefined : 280 }}>
          {cardHeader(ListChecks, '#EC4899', "Today's Focus",
            <button onClick={() => setCurrentView('team')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-pink-text, #EC4899)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
              Full mission <ArrowRight size={11} />
            </button>
          )}
          {myTasks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: tSub, marginBottom: 6 }}><span>Progress</span><span style={{ fontWeight: 800, color: tKey }}>{myProgress}%</span></div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--color-track, rgba(255,255,255,0.06))', overflow: 'hidden' }}><div style={{ width: `${myProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#DB2777,#EC4899)', transition: 'width .3s' }} /></div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myTasks.length === 0 && <div style={{ fontSize: 13, color: tSub, fontStyle: 'italic', marginBottom: 4 }}>No tasks for today yet.</div>}
            {myTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <button onClick={() => (t.done ? uncompleteTask(t) : openCompletion(t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.done ? 'var(--color-success-text, #22C55E)' : tSub, display: 'flex', padding: 0, flexShrink: 0, marginTop: 1 }}>{t.done ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: t.done ? tSub : tKey, textDecoration: t.done ? 'line-through' : 'none', display: 'block' }}>{t.text}</span>
                  {!t.result && t.expectedOutcome && (
                    <span style={{ fontSize: 11.5, color: tSub, fontStyle: 'italic', display: 'block', marginTop: 2 }}>Expecting: {t.expectedOutcome}</span>
                  )}
                  {/* Keyed off `result` existing, not `done` — a Challenge logs a
                      result but stays open (done:false) so it carries forward,
                      and still needs its note visible as context each day. */}
                  {t.result && (
                    <span style={{ fontSize: 11.5, color: t.result.type === 'achieved' ? 'var(--color-success-text, #22C55E)' : 'var(--color-warning-text, #F5A623)', display: 'block', marginTop: 2 }}>
                      {t.result.type === 'achieved' ? '✅ Achieved' : '⚠️ Challenge'}: {t.result.note}
                    </span>
                  )}
                </div>
                <button onClick={() => removeMyTask(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, display: 'flex', padding: 0, flexShrink: 0, marginTop: 1 }}><X size={13} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 3 }}>
              <input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Today's task…"
                style={{ boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.16))', borderRadius: 9, padding: '7px 10px', fontSize: 12.5, color: tKey, fontFamily: 'inherit', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={outcomeDraft} onChange={(e) => setOutcomeDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMyTask(); } }} placeholder="Expected outcome…"
                  style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.16))', borderRadius: 9, padding: '7px 10px', fontSize: 12.5, color: tKey, fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={addMyTask} disabled={!taskDraft.trim() || !outcomeDraft.trim()} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 9, border: '1px dashed var(--color-border-subtle, rgba(48,108,236,0.3))', background: 'transparent', color: 'var(--color-pink-text, #EC4899)', cursor: 'pointer', opacity: (!taskDraft.trim() || !outcomeDraft.trim()) ? 0.5 : 1 }}><Plus size={13} /></button>
              </div>
            </div>
          </div>
          {myTasks.length > 0 && (
            <button onClick={postFocusSummary} disabled={posting} style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, border: '1px solid rgba(236,72,153,0.35)', background: 'rgba(236,72,153,0.10)', color: 'var(--color-pink-text, #EC4899)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: posting ? 0.6 : 1 }}>
              <MessageSquare size={13} /> Post to Daily Tasks
            </button>
          )}
        </div>

        {/* Messages — unread conversations */}
        <div className="dash-card" style={{ ...card, minWidth: 0, minHeight: isMobile ? undefined : 280 }}>
          {cardHeader(MessageSquare, '#5B9BFF', 'Messages',
            <button onClick={() => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #5B9BFF)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
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
                        {n.count > 1 && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-accent-text, #5B9BFF)', background: 'rgba(48,108,236,0.16)', borderRadius: 999, padding: '0 5px', marginLeft: 'auto', flexShrink: 0 }}>{n.count}</span>}
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

      {/* Forward Roadmap — full width, so the timeline has room to breathe */}
      <div style={{ marginBottom: 28 }}>
        <RoadmapCard />
      </div>

      {/* Two-column dashboard: content stream (left) + widget rail (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* LEFT — content stream */}
        <div className="card-col" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Team Member Focus Board */}
          <div className="dash-card" style={card}>
            {cardHeader(Users, '#5B9BFF', 'Team Member Focus Board', canSetMission && (
              <button onClick={openMissionEditor} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--color-accent-text, #7EB3FF)', background: 'rgba(48,108,236,0.12)', border: '1px solid rgba(48,108,236,0.35)', flexShrink: 0 }}>
                {myMission?.mission ? <Pencil size={12} /> : <Plus size={13} />} {myMission?.mission ? 'Edit my mission' : 'Set my mission'}
              </button>
            ))}
            {members.length === 0 ? (
              <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No team members loaded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {members.map((m, i) => {
                  const mm = missionByUser.get(m.id) || {};
                  const priorities = Array.isArray(mm.priorities) ? mm.priorities.filter(Boolean) : [];
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 12, paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? 'none' : '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
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
                              <span key={j} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent-text, #7EB3FF)', background: 'rgba(48,108,236,0.14)', borderRadius: 999, padding: '3px 9px' }}>{p}</span>
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
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: latest.growth == null ? tSub : latest.growth < 0 ? 'var(--color-error-text, #E0485A)' : 'var(--color-success-text, #22C55E)' }}>{latest.growth == null ? '—' : `${latest.growth > 0 ? '+' : ''}${latest.growth}%`}</span>
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

          {/* Monthly Goals */}
          <div className="dash-card" style={card}>
            {cardHeader(Rocket, '#14B8A6', 'Monthly Goals')}
            {monthlyGoals.length === 0 ? (
              <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No goals set for this month yet.{canEdit ? ' Add them via "Edit strategy".' : ''}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {monthlyGoals.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: 'rgba(20,184,166,0.16)', color: 'var(--color-teal-text, #14B8A6)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
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
        <div className="ig-scrim" onClick={() => setEditing(false)} style={{ position: 'fixed', inset: 0, zIndex: 10050, backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div className="ig-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)', margin: '20px 0', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Edit agency strategy</span>
              <button className="ig-dialog-close" onClick={() => setEditing(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
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
              <Field label="Monthly goals">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {form.monthly_goals.map((g, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7 }}>
                      <input className="strat-in" value={g} onChange={(e) => setForm((f) => ({ ...f, monthly_goals: f.monthly_goals.map((x, j) => j === i ? e.target.value : x) }))} placeholder={`Goal ${i + 1}`} />
                      <button onClick={() => setForm((f) => ({ ...f, monthly_goals: f.monthly_goals.length > 1 ? f.monthly_goals.filter((_, j) => j !== i) : [''] }))} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #8FB4E8)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm((f) => ({ ...f, monthly_goals: [...f.monthly_goals, ''] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add goal</button>
                </div>
              </Field>
              <Field label="Agency scoreboard metrics">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {form.metrics.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 30px', gap: 7 }}>
                      <input className="strat-in" value={m.label} onChange={(e) => setForm((f) => ({ ...f, metrics: f.metrics.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} placeholder="e.g. Clients acquired" />
                      <input className="strat-in" value={m.value} onChange={(e) => setForm((f) => ({ ...f, metrics: f.metrics.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value" />
                      <button onClick={() => setForm((f) => ({ ...f, metrics: f.metrics.length > 1 ? f.metrics.filter((_, j) => j !== i) : [{ label: '', value: '' }] }))} style={{ width: 30, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #8FB4E8)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm((f) => ({ ...f, metrics: [...f.metrics, { label: '', value: '' }] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add metric</button>
                </div>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #9DB8DD)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={15} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* My mission modal (opened from the Team Member Focus Board) */}
      {missionOpen && (
        <div className="ig-scrim" onClick={() => setMissionOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10050, backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div className="ig-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', margin: '20px 0', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>My mission</span>
              <button className="ig-dialog-close" onClick={() => setMissionOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto' }}>
              <Field label="Department"><input className="strat-in" value={missionForm.department} onChange={(e) => setMissionForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Marketing" /></Field>
              <Field label="Mission">
                <textarea
                  className={`strat-in${missionError ? ' error' : ''}`} rows={3} autoFocus
                  value={missionForm.mission}
                  onChange={(e) => { setMissionForm((f) => ({ ...f, mission: e.target.value })); if (missionError) setMissionError(false); }}
                  placeholder="The outcome you exist to create"
                  aria-required="true" aria-invalid={missionError}
                />
                {missionError && <div className="strat-error">Mission is required.</div>}
              </Field>
              <Field label="Monthly priorities">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {missionForm.priorities.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7 }}>
                      <input className="strat-in" value={p} onChange={(e) => setMissionForm((f) => ({ ...f, priorities: f.priorities.map((x, j) => (j === i ? e.target.value : x)) }))} placeholder={`Priority ${i + 1}`} />
                      <button onClick={() => setMissionForm((f) => ({ ...f, priorities: f.priorities.length > 1 ? f.priorities.filter((_, j) => j !== i) : [''] }))} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #8FB4E8)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setMissionForm((f) => ({ ...f, priorities: [...f.priorities, ''] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add priority</button>
                </div>
              </Field>
              {otherAgencies.length > 0 && (
                <label className="strat-apply">
                  <input type="checkbox" checked={missionApplyAll} onChange={(e) => setMissionApplyAll(e.target.checked)} />
                  <span>
                    <span className="strat-apply-title">Also set this in my other {otherAgencies.length === 1 ? 'agency' : `${otherAgencies.length} agencies`}</span>
                    <span className="strat-apply-sub">{otherAgencies.map((a) => a.name).filter(Boolean).join(', ')}. Replaces the mission, department and priorities you have there; your outcomes, KPIs and tasks are not touched.</span>
                  </span>
                </label>
              )}
              {missionSaveError && <div className="strat-error" style={{ marginTop: 0 }}>{missionSaveError}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setMissionOpen(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #9DB8DD)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveMyMission} disabled={missionSaving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: missionSaving ? 0.6 : 1 }}><Check size={15} /> {missionSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete-a-task modal — Achieved/Challenge + a required note, then
          posts the result to Daily Tasks chat on submit */}
      {completingTask && (
        <div className="ig-scrim" onClick={() => setCompletingTask(null)} style={{ position: 'fixed', inset: 0, zIndex: 10050, backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div className="ig-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', margin: '20px 0', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Log an update</span>
              <button className="ig-dialog-close" onClick={() => setCompletingTask(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: tKey }}>{completingTask.text}</div>
                {completingTask.expectedOutcome && (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic', marginTop: 3 }}>Expecting: {completingTask.expectedOutcome}</div>
                )}
              </div>
              <Field label="What happened?">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setCompletionType('achieved'); if (completionError) setCompletionError(false); }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, border: '1px solid', borderColor: completionType === 'achieved' ? 'var(--color-success-text, #22C55E)' : 'var(--color-border)', background: completionType === 'achieved' ? 'rgba(34,197,94,0.14)' : 'transparent', color: completionType === 'achieved' ? 'var(--color-success-text, #22C55E)' : tSub }}>
                    <CheckCircle size={14} /> Achieved it
                  </button>
                  <button
                    onClick={() => { setCompletionType('challenge'); if (completionError) setCompletionError(false); }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, border: '1px solid', borderColor: completionType === 'challenge' ? 'var(--color-warning-text, #F5A623)' : 'var(--color-border)', background: completionType === 'challenge' ? 'rgba(245,166,35,0.14)' : 'transparent', color: completionType === 'challenge' ? 'var(--color-warning-text, #F5A623)' : tSub }}>
                    <AlertTriangle size={14} /> Hit a challenge
                  </button>
                </div>
              </Field>
              <Field label={completionType === 'challenge' ? 'What got in the way?' : 'What did you achieve?'}>
                <textarea
                  className={`strat-in${completionError ? ' error' : ''}`} rows={3} autoFocus
                  value={completionNote}
                  onChange={(e) => { setCompletionNote(e.target.value); if (completionError) setCompletionError(false); }}
                  placeholder={completionType === 'challenge' ? 'e.g. Waiting on a reply from the client' : 'e.g. Sent the proposal and got a verbal yes'}
                />
                {completionError && <div className="strat-error">Pick Achieved or Challenge, and add a note.</div>}
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setCompletingTask(null)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #9DB8DD)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={submitCompletion} disabled={posting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: posting ? 0.6 : 1 }}><Check size={15} /> {posting ? 'Saving…' : 'Save & post'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .strat-in.error { border-color: var(--color-error); background: var(--color-error-bg); }
        .strat-in.error:focus { box-shadow: 0 0 0 3px var(--color-error-bg); }
        .strat-error { font-size: 11.5px; font-weight: 600; margin-top: 5px; color: var(--color-error-text, var(--color-error)); }
        .strat-apply { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; cursor: pointer; border: 1px solid var(--color-border-subtle, rgba(48,108,236,0.16)); background: var(--color-bg-tertiary, rgba(255,255,255,0.04)); }
        .strat-apply input { margin-top: 2px; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--color-accent-primary, #306CEC); cursor: pointer; }
        .strat-apply-title { display: block; font-size: 13px; font-weight: 700; color: var(--color-text-primary, #E2EEFF); }
        .strat-apply-sub { display: block; margin-top: 3px; font-size: 11.5px; line-height: 1.5; color: var(--color-text-tertiary, #6C82A3); }
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
