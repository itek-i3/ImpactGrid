'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Sigma, ChevronDown, ChevronRight, Lock, X, Check, Building2, BarChart2, CalendarDays, Eye, Pencil, Receipt, Coins, ArrowRight, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { RadialProgress, useCountUp } from '@/lib/personalFinance/shared';
import Dropdown from '@/components/ui/Dropdown';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const itemsTotal = (items) => (items || []).reduce((s, i) => s + num(i.amount), 0);
const cleanItems = (items) => (items || [])
  .filter(i => (i.what || '').trim() || num(i.amount))
  .map(i => ({ what: (i.what || '').trim(), amount: num(i.amount) }));

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const parseDay = (dateStr) => new Date(`${dateStr}T00:00:00`);
// Short axis label, e.g. "5 Jul"
const fmtChartDay = (dateStr) => { const d = parseDay(dateStr); return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`; };
// "Monday 5th July 2026"
const fmtNice = (dateStr) => {
  const d = parseDay(dateStr);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};
const monthKeyOf = (dateStr) => (dateStr || '').slice(0, 7);   // 'YYYY-MM'
const monthLabel = (key) => {
  const [y, m] = (key || '').split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const yearKeyOf = (dateStr) => (dateStr || '').slice(0, 4);    // 'YYYY'

// ── Week helpers (weeks run Monday → Sunday) ──
const pad2 = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (dateStr) => { const d = parseDay(dateStr); const dow = (d.getDay() + 6) % 7; return addDays(d, -dow); };
const weekKeyOf = (dateStr) => toDateStr(mondayOf(dateStr)); // the Monday's date, 'YYYY-MM-DD'
const weekDates = (mondayStr) => { const m = parseDay(mondayStr); return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(m, i))); };
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayOf = (dateStr) => WEEKDAY_NAMES[(parseDay(dateStr).getDay() + 6) % 7];
const weekLabel = (mondayStr) => {
  const m = parseDay(mondayStr); const s = addDays(m, 6);
  const sameMonth = m.getMonth() === s.getMonth();
  const mm = m.toLocaleDateString('en-GB', { month: 'short' });
  const sm = s.toLocaleDateString('en-GB', { month: 'short' });
  return sameMonth
    ? `${ordinal(m.getDate())} – ${ordinal(s.getDate())} ${sm}`
    : `${ordinal(m.getDate())} ${mm} – ${ordinal(s.getDate())} ${sm}`;
};

const EXPENSE_CATEGORIES = ['Rent', 'Water', 'Electricity', 'Salaries', 'Supplies', 'Stock / Inventory', 'Transport', 'Utilities', 'Internet / Airtime', 'Marketing', 'Equipment', 'Fees / Licenses', 'Miscellaneous'];
const EMPTY_ITEM = { what: '', amount: '' };

// Distinct hues for the weekly category breakdown. Colour is secondary here —
// every bar is labelled with its category name and amount.
const CATEGORY_PALETTE = ['#E0485A', '#F97316', '#F5A623', '#EAB308', '#84CC16', '#EC4899', '#5B9BFF', '#0EA5E9', '#14B8A6', '#F472B6'];

// Aggregate a week's expense line-items into per-category totals (what the money
// was actually spent on — Rent, Water, Salaries …), largest first. Case-insensitive
// so "Water"/"water" merge; any expense logged without line items → "Unlabelled".
const buildBreakdown = (week) => {
  const map = new Map();
  let labelled = 0, rowExpenses = 0;
  (week.rows || []).forEach((r) => {
    rowExpenses += num(r.expenses);
    (Array.isArray(r.expense_items) ? r.expense_items : []).forEach((it) => {
      const raw = (it.what || '').trim();
      const amt = num(it.amount);
      if (amt <= 0) return;
      const key = raw ? raw.toLowerCase() : '__unlabelled__';
      if (!map.has(key)) map.set(key, { label: raw || 'Unlabelled', amount: 0 });
      map.get(key).amount += amt;
      labelled += amt;
    });
  });
  const remainder = rowExpenses - labelled;   // expenses recorded without itemisation
  if (remainder > 0.5) {
    if (!map.has('__unlabelled__')) map.set('__unlabelled__', { label: 'Unlabelled', amount: 0 });
    map.get('__unlabelled__').amount += remainder;
  }
  const list = [...map.values()].filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = list.reduce((s, x) => s + x.amount, 0);
  return { list, total };
};
// Bold pill badge for a stat value (used in month/week/day headers instead of
// plain colored text — reads as a distinct "fact", not just more grey text).
const chip = (text, tint) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: `${tint}20`, color: tint, fontWeight: 800, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{text}</span>
);

const DEMO_MEMBERS = [
  { id: 'manager-1', full_name: 'John Doe', email: 'john@example.com' },
  { id: 'member-1', full_name: 'Alice Smith', email: 'alice@example.com' },
];

export default function FinancePanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const isAcr = isDemo || !!agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const currentAgencyName = agencies?.find(a => a.id === activeAgencyId)?.name || '';
  // ACR keeps the "Finance Log" name (it tracks several businesses day by
  // day, and now year by year too); every other agency sees its own name
  // instead — "itek Finance".
  const financeLabel = isAcr ? 'Finance Log' : (currentAgencyName ? `${currentAgencyName} Finance` : 'Finance');

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nDate, setNDate] = useState(today);
  const [nRevenue, setNRevenue] = useState('');
  const [nItems, setNItems] = useState([{ ...EMPTY_ITEM }]);
  const [nNote, setNNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);                    // the new-entry form is hidden until clicked
  const [monthToggles, setMonthToggles] = useState(() => new Set()); // months the user flipped from default
  const [weekToggles, setWeekToggles] = useState(() => new Set());   // weeks the user flipped from default
  const [openDay, setOpenDay] = useState(null);                     // the date (YYYY-MM-DD) whose slot is expanded for editing
  const [viewDay, setViewDay] = useState(null);                     // the date (YYYY-MM-DD) whose slot is expanded read-only
  const [draft, setDraft] = useState({ revenue: '', items: [{ ...EMPTY_ITEM }], note: '' }); // editor buffer for openDay
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(null);               // the business currently being viewed
  const [reportPeriod, setReportPeriod] = useState('daily');
  const [chartType, setChartType] = useState('bar');
  const [tab, setTab] = useState('log'); // 'log' | 'reports'

  // Finance Log itself is open to any agency's managers/admins now; the
  // multi-business layer (Businesses tab, the switcher below) stays an
  // ACR-only tool — every other agency just tracks its own figures directly.
  const canAccess = isDemo || ['manager', 'superadmin'].includes(userProfile?.role);
  const needsBusinessSelection = isAcr;

  // Keep a valid business selected (adjust during render — React's documented pattern).
  if (businesses.length && !businesses.some(b => b.id === businessId)) {
    setBusinessId(businesses[0].id);
  } else if (!businesses.length && businessId) {
    setBusinessId(null);
  }

  const activeBiz = needsBusinessSelection ? (businesses.find(b => b.id === businessId) || null) : null;
  // A business row can be linked to a real agency on this platform (e.g. ACR
  // tracks "itek" as a business, but itek also runs its own workspace here).
  // When linked, this panel reads/writes THAT agency's own top-level finance
  // rows instead of a separate business-scoped copy — same data, either side.
  const linkedAgencyId = activeBiz?.linked_agency_id || null;
  const linkedAgency = linkedAgencyId ? (agencies?.find(a => a.id === linkedAgencyId) || null) : null;
  const financeAgencyId = linkedAgencyId || agencyId;
  const financeBusinessId = (needsBusinessSelection && !linkedAgencyId) ? businessId : null;
  // Some businesses only ever know their figures at month granularity (e.g. a
  // real-estate holding) rather than day by day — this is a per-business
  // setting, not per-entry, so it switches the whole panel's UI rather than
  // just how one row is tagged. A plain (non-ACR) agency always tracks daily.
  const financePeriod = needsBusinessSelection ? (activeBiz?.finance_period || 'daily') : 'daily';
  const hasValidScope = !needsBusinessSelection || !!businessId;

  const demoKey = financeAgencyId ? `demo-finance-${financeAgencyId}-${financeBusinessId || 'none'}` : 'demo-finance';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) { if (!cancelled) setMembers(DEMO_MEMBERS); return; }
      if (!workspaceId) return;
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat-members`);
        if (res.ok) { const j = await res.json(); if (!cancelled && j.data) setMembers(j.data); }
      } catch (_) {}
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId, isDemo]);

  // Businesses in this agency (for the switcher) + realtime. Only ACR uses
  // the multi-business layer — every other agency tracks its own figures
  // directly, so there's nothing to load here for them.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(`demo-biz-${agencyId || 'x'}`); list = raw ? JSON.parse(raw) : [{ id: 'demo-biz-1', name: 'Sample Business' }]; } catch (_) {}
        if (!cancelled) setBusinesses(list);
        return;
      }
      if (!agencyId || !needsBusinessSelection) { if (!cancelled) setBusinesses([]); return; }
      const { data } = await createClient().from('businesses').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
      if (!cancelled) setBusinesses(data || []);
    }
    load();
    if (isDemo || !agencyId || !needsBusinessSelection) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`biz:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, needsBusinessSelection]);

  // Finance entries for the current scope + realtime. The scope is either:
  // an ACR business (agency_id=ACR, business_id=that business), a business
  // linked to another agency (agency_id=that agency, business_id=null — the
  // SAME rows that agency's own Finance Log reads/writes), or a plain
  // agency tracking itself directly (agency_id=itself, business_id=null).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(demoKey) : null;
        if (!cancelled) { setRows(raw ? JSON.parse(raw) : []); setLoading(false); }
        return;
      }
      if (!financeAgencyId || !hasValidScope) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      let q = createClient().from('daily_finance').select('*').eq('agency_id', financeAgencyId);
      q = financeBusinessId ? q.eq('business_id', financeBusinessId) : q.is('business_id', null);
      const { data } = await q.order('entry_date', { ascending: false }).order('created_at', { ascending: false });
      if (!cancelled) { setRows(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !financeAgencyId || !hasValidScope) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`finance:${financeAgencyId}:${financeBusinessId || 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_finance', filter: `agency_id=eq.${financeAgencyId}` }, () => {
        const el = typeof document !== 'undefined' ? document.activeElement : null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        load();
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [financeAgencyId, financeBusinessId, hasValidScope, isDemo, demoKey]);

  const memberName = (id) => {
    if (id === currentUserId) return 'You';
    const m = members.find(x => x.id === id);
    return m?.full_name?.split(' ')[0] || m?.email || '—';
  };

  const totals = useMemo(() => {
    let r = 0, e = 0;
    rows.forEach(x => { r += num(x.revenue); e += num(x.expenses); });
    return { revenue: r, expenses: e, net: r - e };
  }, [rows]);

  // Hero ring: how much of revenue got consumed by expenses (the finance-log
  // equivalent of the personal-finance "% of budget used" ring).
  const spendRatio = totals.revenue > 0 ? Math.round((totals.expenses / totals.revenue) * 100) : (totals.expenses > 0 ? 100 : 0);
  const ringColor = (totals.revenue === 0 && totals.expenses === 0) ? 'var(--color-text-tertiary)'
    : totals.expenses > totals.revenue ? '#E0485A'
    : spendRatio >= 80 ? '#F5A623'
    : '#5B9BFF';
  const revenueDisplay = useCountUp(totals.revenue);
  const expensesDisplay = useCountUp(totals.expenses);
  const netDisplay = useCountUp(totals.net);

  // Report-ready revenue vs expenses chart (daily, weekly, monthly, or
  // yearly). A monthly- or yearly-tracked business only ever has one row per
  // month/year, so its chart always groups at that granularity regardless of
  // the reportPeriod toggle (which is hidden for it anyway).
  const effectiveReportPeriod = financePeriod === 'monthly' ? 'monthly' : financePeriod === 'yearly' ? 'yearly' : reportPeriod;
  const chartData = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (!r.entry_date) return;
      let key = r.entry_date;
      let label = fmtChartDay(r.entry_date);
      if (effectiveReportPeriod === 'weekly') {
        key = weekKeyOf(r.entry_date);
        label = weekLabel(key);
      } else if (effectiveReportPeriod === 'monthly') {
        key = monthKeyOf(r.entry_date);
        label = monthLabel(key);
      } else if (effectiveReportPeriod === 'yearly') {
        key = yearKeyOf(r.entry_date);
        label = key;
      }
      if (!map.has(key)) map.set(key, { key, label, revenue: 0, expenses: 0 });
      const e = map.get(key);
      e.revenue += num(r.revenue);
      e.expenses += num(r.expenses);
    });
    return [...map.values()]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .slice(effectiveReportPeriod === 'daily' ? -45 : -12)
      .map(e => ({ label: e.label, Revenue: e.revenue, Expenses: e.expenses }));
  }, [rows, effectiveReportPeriod]);

  // Group entries by calendar month → week (Mon–Sun) → day, newest first.
  const months = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = monthKeyOf(r.entry_date);
      if (!map.has(key)) map.set(key, { key, rows: [] });
      map.get(key).rows.push(r);
    });
    const arr = [...map.values()];
    arr.forEach(mo => {
      mo.rows.sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0));
      let rev = 0, exp = 0;
      mo.rows.forEach(r => { rev += num(r.revenue); exp += num(r.expenses); });
      // Net profit is a MONTHLY figure: the month's total revenue minus total expenses.
      mo.totals = { revenue: rev, expenses: exp, net: rev - exp };
      mo.label = monthLabel(mo.key);

      // Split the month's entries into weeks. Each week keeps one entry per date
      // (byDate) so there is only ever a single Monday, Tuesday, … per week.
      const wmap = new Map();
      mo.rows.forEach(r => {
        const wk = weekKeyOf(r.entry_date);
        if (!wmap.has(wk)) wmap.set(wk, { key: wk, rows: [], byDate: new Map() });
        const w = wmap.get(wk);
        w.rows.push(r);
        w.byDate.set(r.entry_date, r);
      });
      const weeks = [...wmap.values()];
      weeks.forEach(w => {
        w.dates = weekDates(w.key);
        let wr = 0, we = 0;
        w.rows.forEach(r => { wr += num(r.revenue); we += num(r.expenses); });
        w.totals = { revenue: wr, expenses: we, net: wr - we };
        w.label = weekLabel(w.key);
        w.count = new Set(w.rows.map(r => r.entry_date)).size;
      });
      weeks.sort((a, b) => (a.key < b.key ? 1 : -1)); // newest week first
      mo.weeks = weeks;
    });
    arr.sort((a, b) => (a.key < b.key ? 1 : -1));   // newest month first
    return arr;
  }, [rows]);

  // Yearly-tracked business: one row per calendar year, newest first — the
  // same flat shape as the monthly list, just grouped a level coarser.
  const years = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = yearKeyOf(r.entry_date);
      if (!map.has(key)) map.set(key, { key, rows: [] });
      map.get(key).rows.push(r);
    });
    const arr = [...map.values()];
    arr.sort((a, b) => (a.key < b.key ? 1 : -1)); // newest year first
    return arr;
  }, [rows]);

  const latestMonthKey = months[0]?.key;
  const isMonthOpen = (key) => (key === latestMonthKey) !== monthToggles.has(key); // latest open by default
  const toggleMonth = (key) => setMonthToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const latestWeekKey = months[0]?.weeks?.[0]?.key;
  const isWeekOpen = (key) => (key === latestWeekKey) !== weekToggles.has(key); // latest week open by default
  const toggleWeek = (key) => setWeekToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const persistDemo = (next) => { setRows(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  // Create-or-update the single entry for a given date (never a second Monday).
  // `d` is an explicit editor value so callers avoid any stale-state reads.
  const saveDay = async (dateStr, d) => {
    const items = cleanItems(d.items);
    const expenses = itemsTotal(items);
    const revenue = num(d.revenue);
    const note = (d.note || '').trim() || null;
    const existing = rows.find(r => r.entry_date === dateStr);
    if (!existing && revenue === 0 && expenses === 0 && !note) return; // nothing to store
    if (!isDemo && (!financeAgencyId || !hasValidScope)) return;

    if (existing) {
      const patch = { revenue, expenses, expense_items: items, note };
      const next = rows.map(r => (r.id === existing.id ? { ...r, ...patch } : r));
      setRows(next);
      if (isDemo) { persistDemo(next); return; }
      try {
        const { error } = await createClient().from('daily_finance').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) console.error('[finance] update failed —', error.message, '| code:', error.code, '| details:', error.details);
      } catch (err) { console.error('[finance] update threw:', err); }
      return;
    }

    const base = {
      agency_id: financeAgencyId, business_id: financeBusinessId,
      created_by: isUuid(currentUserId) ? currentUserId : null,
      entry_date: dateStr, revenue, expenses, expense_items: items, note,
    };
    if (isDemo) { persistDemo([{ ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...rows]); return; }
    try {
      const { data, error } = await createClient().from('daily_finance').insert(base).select('*').maybeSingle();
      if (error) console.error('[finance] insert failed —', error.message, '| code:', error.code, '| details:', error.details);
      if (data) setRows(prev => (prev.some(r => r.id === data.id) ? prev : [data, ...prev]));
    } catch (err) { console.error('[finance] insert threw:', err); }
  };

  // Open a day's editor, seeding the buffer from its existing entry (if any).
  const openDayEditor = (dateStr) => {
    if (openDay === dateStr) { setOpenDay(null); return; }
    setViewDay(null);
    const entry = rows.find(r => r.entry_date === dateStr);
    setDraft({
      revenue: entry && entry.revenue != null ? String(entry.revenue) : '',
      items: (Array.isArray(entry?.expense_items) && entry.expense_items.length)
        ? entry.expense_items.map(i => ({ what: i.what || '', amount: i.amount != null ? String(i.amount) : '' }))
        : [{ ...EMPTY_ITEM }],
      note: entry?.note || '',
    });
    setOpenDay(dateStr);
  };

  // Toggles a day's read-only preview — closes the editor for that row first
  // so only one of view/edit is ever expanded at a time.
  const toggleView = (dateStr) => {
    if (viewDay === dateStr) { setViewDay(null); return; }
    setOpenDay(null);
    setViewDay(dateStr);
  };

  const addEntry = async () => {
    if (num(nRevenue) === 0 && itemsTotal(nItems) === 0 && !nNote.trim()) return;
    if (!isDemo && (!financeAgencyId || !hasValidScope)) return;
    setSaving(true);
    // Upsert by date so picking a date/month/year that already exists edits
    // it instead of creating a duplicate. Monthly businesses always anchor
    // to the 1st, yearly ones to Jan 1st, even if the user never touched
    // the picker.
    const dateStr = financePeriod === 'monthly' ? `${(nDate || today).slice(0, 7)}-01`
      : financePeriod === 'yearly' ? `${(nDate || today).slice(0, 4)}-01-01`
      : (nDate || today);
    await saveDay(dateStr, { revenue: nRevenue, items: nItems, note: nNote });
    setNRevenue(''); setNItems([{ ...EMPTY_ITEM }]); setNNote(''); setNDate(today); setSaving(false); setShowAdd(false);
  };

  const deleteRow = async (id) => {
    if (!id) return;
    setOpenDay(null);
    setViewDay(null);
    if (isDemo) { persistDemo(rows.filter(r => r.id !== id)); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      const { error } = await createClient().from('daily_finance').delete().eq('id', id);
      if (error) console.error('[finance] delete failed —', error.message, '| code:', error.code, '| details:', error.details);
    } catch (err) { console.error('[finance] delete threw:', err); }
  };

  const netColor = (n) => (n > 0 ? '#22C55E' : n < 0 ? '#E0485A' : 'var(--color-text-tertiary)');

  // `commit(nextItems)` persists with an explicit value so add/remove/blur never
  // read stale state (that was the bug where the item bin appeared to do nothing).
  // Its own card — icon + title + subtitle header, a running "Total Expenses"
  // chip, a column-header row, then one grid-aligned row per item.
  const itemsEditor = (items, setItems, commit, periodNoun = 'entry') => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    return (
      <div className="fin-expensecard">
        <div className="fin-expensecard-head">
          <span className="fin-sectionicon fin-sectionicon-expenses"><Wallet size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fin-expensecard-title">Expenses</div>
            <div className="fin-expensecard-sub">Add all expenses related to this {periodNoun}.</div>
          </div>
          <div className="fin-totalchip">
            <span className="fin-totalchip-icon"><Coins size={13} /></span>
            <div>
              <div className="fin-totalchip-label">Total Expenses</div>
              <div className="fin-totalchip-value">{money(itemsTotal(items))}</div>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="fin-itemrow2 fin-itemrow2-head">
            <span>Expense name</span>
            <span>Amount (KSh)</span>
            <span style={{ textAlign: 'center' }}>Actions</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
            return (
              <div key={i} className="fin-itemrow2">
                <div className="fin-itemrow2-name">
                  <span className="fin-itemicon" style={{ background: `${color}29`, color }}><Receipt size={14} /></span>
                  <input className="fin-input" list="fin-cats" type="text" placeholder="What was spent on (e.g. Rent)"
                    value={it.what} onChange={e => change(i, { what: e.target.value })} onBlur={() => commit?.(items)} />
                </div>
                <input className="fin-input" type="number" inputMode="decimal" placeholder="0"
                  value={it.amount} onChange={e => change(i, { amount: e.target.value })} onBlur={() => commit?.(items)} />
                <button className="fin-itemdel" title="Remove item"
                  onClick={() => { const next = items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_ITEM }]; setItems(next); commit?.(next); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <button className="fin-additem" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}><Plus size={14} /> Add another expense</button>
      </div>
    );
  };

  // Read-only preview of one logged entry — revenue/expenses as stat tiles,
  // the itemized breakdown as colored bars (same visual language as the
  // week/month "Where the money went" card), and the note as a quote block.
  // No input fields. Shared by the day/month/year "View" expansion.
  const renderEntryView = (entry, periodLabel) => {
    const items = (Array.isArray(entry.expense_items) ? entry.expense_items : []).filter(it => (it.what || '').trim() || num(it.amount));
    const sortedItems = [...items].sort((a, b) => num(b.amount) - num(a.amount));
    const maxItem = sortedItems.length ? num(sortedItems[0].amount) : 0;
    return (
      <div className="fin-entrypanel fin-entrypanel-view">
        <div className="fin-stattiles">
          <div className="fin-stattile">
            <div className="fin-stattile-icon" style={{ background: 'rgba(34,197,94,0.16)', color: '#22C55E' }}><TrendingUp size={15} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="fin-stattile-value" style={{ color: '#22C55E' }}>{money(entry.revenue)}</div>
              <div className="fin-stattile-label">Revenue</div>
            </div>
          </div>
          <div className="fin-stattile">
            <div className="fin-stattile-icon" style={{ background: 'rgba(224,72,90,0.16)', color: '#E0485A' }}><TrendingDown size={15} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="fin-stattile-value" style={{ color: '#E0485A' }}>{money(entry.expenses)}</div>
              <div className="fin-stattile-label">Expenses</div>
            </div>
          </div>
          <div className="fin-stattile" style={{ gridColumn: '1 / -1' }}>
            <div className="fin-stattile-icon" style={{ background: 'rgba(91,155,255,0.16)', color: 'var(--color-accent-text, #5B9BFF)' }}><Sigma size={15} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="fin-stattile-value" style={{ color: netColor(num(entry.revenue) - num(entry.expenses)) }}>{money(num(entry.revenue) - num(entry.expenses))}</div>
              <div className="fin-stattile-label">Net</div>
            </div>
          </div>
        </div>

        {sortedItems.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Where it went</label>
            <div className="fin-viewbreakdown">
              {sortedItems.map((it, i) => {
                const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
                const amt = num(it.amount);
                return (
                  <div key={i} className="fin-viewbreakdown-row" style={{ gridTemplateColumns: isMobile ? '84px 1fr' : '130px 1fr' }}>
                    <div className="fin-viewbreakdown-left">
                      <span className="fin-viewbreakdown-dot" style={{ background: color }} />
                      <span className="fin-viewbreakdown-label">{it.what || 'Unlabelled'}</span>
                    </div>
                    <div className="fin-viewbreakdown-right">
                      <div className="fin-viewbreakdown-track"><div className="fin-viewbreakdown-bar" style={{ width: `${maxItem > 0 ? Math.max(4, (amt / maxItem) * 100) : 0}%`, background: color }} /></div>
                      <span className="fin-viewbreakdown-amount">{money(amt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entry.note ? (
          <div className="fin-note"><span className="fin-note-mark">“</span><span>{entry.note}</span></div>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No note logged.</div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
          {periodLabel} · logged by {memberName(entry.created_by)}
        </div>
      </div>
    );
  };

  // Editable fields for one logged entry — revenue, itemized expenses, note.
  // Single-column flow with the amount as the one hero field (large, its own
  // row, currency-prefixed) rather than sharing a row with anything else —
  // the amount is the thing being edited, everything else is context for it.
  // Shared by the day/month/year "Edit" expansion (the standalone "New entry"
  // form below has its own date picker up top, but reuses the same item editor).
  const renderEntryForm = (ds, periodLabel, entry) => {
    const commit = () => saveDay(ds, draft);
    const net = num(draft.revenue) - itemsTotal(draft.items);
    return (
      <div className="fin-entrypanel fin-entrypanel-edit">
        <div className="fin-field" style={{ marginBottom: 4 }}>
          <label style={lblBig}>Revenue <span className="fin-req">*</span></label>
          <div className="fin-amountwrap">
            <span className="fin-amountcurrency">KSh</span>
            <input className="fin-input fin-input-hero" type="number" inputMode="decimal" placeholder="Enter amount" value={draft.revenue} onChange={e => setDraft(d => ({ ...d, revenue: e.target.value }))} onBlur={commit} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 18 }}>
          {periodLabel}{entry ? ` · logged by ${memberName(entry.created_by)}` : ''}
        </div>
        {itemsEditor(draft.items, (next) => setDraft(d => ({ ...d, items: next })), (nextItems) => saveDay(ds, { ...draft, items: nextItems }))}
        <div style={{ marginTop: 18 }}>
          <label style={lblBig}><FileText size={14} /> Note (optional)</label>
          <div className="fin-notewrap">
            <textarea className="fin-textarea" maxLength={255} placeholder="Optional note…" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} onBlur={commit} />
            <span className="fin-notecount">{draft.note.length}/255</span>
          </div>
        </div>
        <div className="fin-netstrip">
          <span>Net for this entry</span>
          <strong style={{ color: netColor(net) }}>{money(net)}</strong>
        </div>
      </div>
    );
  };

  // Category breakdown card — shared by the weekly and monthly views (same
  // shape: any container with a `.rows` array of daily_finance entries).
  const renderBreakdown = (container, periodLabel) => {
    const { list, total } = buildBreakdown(container);
    return (
      <div style={{ border: '1px solid rgba(224,72,90,0.18)', background: 'rgba(224,72,90,0.08)', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#E0485A' }}>Where the money went this {periodLabel}</div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>by category</div>
        </div>
        {total <= 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>No expenses logged this {periodLabel} yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {list.map((c, i) => {
              const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
              const max = list[0].amount;
              const pct = Math.round((c.amount / total) * 100);
              return (
                <div key={c.label} style={{ display: 'grid', gridTemplateColumns: isMobile ? '84px 1fr' : '130px 1fr', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{c.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 16, borderRadius: 6, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ width: `${Math.max(3, (c.amount / max) * 100)}%`, height: '100%', borderRadius: 6, background: color, opacity: 0.9 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, whiteSpace: 'nowrap' }}>{money(c.amount)}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', flexShrink: 0, width: 30, textAlign: 'right' }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 3, paddingTop: 9, borderTop: '1px solid rgba(224,72,90,0.15)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>Total spent this {periodLabel}</span>
              <strong style={{ color: '#E0485A', fontVariantNumeric: 'tabular-nums' }}>{money(total)}</strong>
            </div>
          </div>
        )}
      </div>
    );
  };

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };
  // Bigger, bolder label for the entry form's top-level fields (Amount, Date,
  // Note) — the small uppercase `lbl` above stays for table-style headers and
  // minor captions elsewhere.
  const lblBig = { fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 };
  const canAdd = num(nRevenue) !== 0 || itemsTotal(nItems) !== 0 || nNote.trim();

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>{financeLabel} is available to managers and admins only.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' }}>
      <datalist id="fin-cats">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>

      {/* Header */}
      <div className="fin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div className="fin-icon-badge" style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', flexShrink: 0 }}>
          <Wallet size={22} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>{financeLabel}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>
            {financePeriod === 'monthly' ? "Track this business's monthly revenue & expenses"
              : financePeriod === 'yearly' ? "Track this business's yearly revenue & expenses"
              : "Track daily revenue & expenses, and see exactly where each week's money goes"}
          </div>
        </div>
        {(!needsBusinessSelection || businessId) && (
          <button className="fin-save" style={isMobile ? { width: '100%', justifyContent: 'center' } : { marginLeft: 'auto', flexShrink: 0 }} onClick={() => { setTab('log'); setShowAdd(true); }}>
            <Plus size={15} /> {financePeriod === 'monthly' ? 'Add month entry' : financePeriod === 'yearly' ? 'Add year entry' : 'Add day entry'}
          </button>
        )}
      </div>

      {/* Business switcher — ACR's multi-business tool only; every other agency tracks itself directly */}
      {needsBusinessSelection && (
      <div className="fin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18, animationDelay: '40ms' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Business</span>
        <Dropdown
          trigger={
            <button className="fin-bizbtn">
              <span className="fin-bizavatar" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                {(activeBiz?.name || '?').charAt(0).toUpperCase()}
              </span>
              <span className="fin-bizname" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                {activeBiz?.name || 'Select business'}
              </span>
              <ChevronDown size={17} style={{ color: 'var(--color-text-control, #8FB4E8)', flexShrink: 0 }} />
            </button>
          }
        >
          <div style={{ minWidth: 280, maxHeight: 360, overflowY: 'auto' }}>
            {businesses.length === 0 && (
              <div style={{ padding: '16px 12px', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>No businesses yet.</div>
            )}
            {businesses.map(b => {
              const on = b.id === businessId;
              return (
                <button key={b.id} onClick={() => setBusinessId(b.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 9, border: 'none', background: on ? 'rgba(48,108,236,0.22)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'none'; }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.22)', color: '#8FC0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{(b.name || '?').charAt(0).toUpperCase()}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    {(b.domain || b.sector) && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{[b.domain, b.sector].filter(Boolean).join(' · ')}</span>}
                  </span>
                  {on && <Check size={16} style={{ color: 'var(--color-accent-text, #7EB3FF)', flexShrink: 0 }} />}
                </button>
              );
            })}
            <button onClick={() => setCurrentView('businesses')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px', marginTop: 4, border: 'none', borderTop: '1px solid var(--color-border-subtle)', background: 'none', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Building2 size={15} /> Manage businesses
            </button>
          </div>
        </Dropdown>
      </div>
      )}

      {/* Linked business — this business IS another agency on the platform, so its
          figures are that agency's own Finance tab, not a separate copy. */}
      {linkedAgencyId && (
        <div className="fin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(48,108,236,0.08)', border: '1px solid rgba(48,108,236,0.25)', color: 'var(--color-text-secondary)', fontSize: 12.5, marginBottom: 18, animationDelay: '60ms' }}>
          <Building2 size={14} style={{ color: 'var(--color-accent-text, #5B9BFF)', flexShrink: 0 }} />
          <span>Linked to <strong style={{ color: 'var(--color-text-primary)' }}>{linkedAgency?.name || 'another agency'}</strong> — figures here are {linkedAgency?.name ? `${linkedAgency.name} Finance` : "that agency's own Finance"}, kept in sync both ways.</span>
        </div>
      )}

      {(needsBusinessSelection && !businessId) ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>No business selected</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>Create a business in the Businesses tab to start tracking its finances.</div>
          <button className="fin-save" onClick={() => setCurrentView('businesses')} style={{ margin: '0 auto' }}><Building2 size={15} /> Go to Businesses</button>
        </div>
      ) : (
      <>

      {/* Hero: net position + spend-of-revenue ring */}
      <div className="fin-fadeup fin-hero" style={{ animationDelay: '80ms' }}>
        <div className="fin-hero-ringwrap">
          <RadialProgress pct={spendRatio} size={isMobile ? 74 : 92} stroke={isMobile ? 7 : 9} color={ringColor} track="rgba(255,255,255,0.08)" />
          <div className="fin-hero-ringlabel">
            <span className="fin-hero-ringpct">{(totals.revenue > 0 || totals.expenses > 0) ? `${Math.min(100, spendRatio)}%` : '—'}</span>
            <span className="fin-hero-ringsub">spent</span>
          </div>
        </div>
        <div className="fin-hero-main">
          <div className="fin-hero-eyebrow">Net overall</div>
          <div className="fin-hero-amount" style={{ color: netColor(totals.net) }}>{money(netDisplay)}</div>
          <div className="fin-hero-stats">
            <span><TrendingUp size={12} style={{ color: '#22C55E' }} /> {money(revenueDisplay)}</span>
            <span><TrendingDown size={12} style={{ color: '#E0485A' }} /> {money(expensesDisplay)}</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="fin-fadeup fin-tabs" style={{ animationDelay: '100ms' }}>
        <button className={`fin-tab ${tab === 'log' ? 'fin-tab-active' : ''}`} onClick={() => setTab('log')}>
          <CalendarDays size={14} /> Log
          {rows.length > 0 && <span className="fin-tab-count">{rows.length}</span>}
        </button>
        <button className={`fin-tab ${tab === 'reports' ? 'fin-tab-active' : ''}`} onClick={() => setTab('reports')}>
          <BarChart2 size={14} /> Reports
        </button>
      </div>

      {/* Revenue vs Expenses and Expenses-only charts */}
      {tab === 'reports' && chartData.length > 0 && (
        <div className="fin-fadeup" style={{ ...card, marginBottom: 18, animationDelay: '200ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: 'var(--color-accent-text, #5B9BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={16} /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Finance reports</span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{activeBiz?.name ? `${activeBiz.name} · ` : ''}{effectiveReportPeriod}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {financePeriod === 'daily' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['daily','weekly','monthly'].map(period => (
                  <button key={period} onClick={() => setReportPeriod(period)} style={{ border: '1px solid', borderColor: reportPeriod === period ? 'rgba(91,155,255,0.6)' : 'var(--color-border)', background: reportPeriod === period ? 'rgba(91,155,255,0.16)' : 'transparent', color: reportPeriod === period ? '#EAF1FF' : 'var(--color-text-secondary)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {period}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {['bar','line'].map(mode => (
                <button key={mode} onClick={() => setChartType(mode)} style={{ border: '1px solid', borderColor: chartType === mode ? 'rgba(34,197,94,0.6)' : 'var(--color-border)', background: chartType === mode ? 'rgba(34,197,94,0.14)' : 'transparent', color: chartType === mode ? '#EAF1FF' : 'var(--color-text-secondary)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 10, background: 'var(--color-bg-secondary)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8 }}>Revenue vs Expenses · {effectiveReportPeriod}</div>
              <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
                {chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ stroke: 'rgba(48,108,236,0.35)', strokeWidth: 1 }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="Revenue" stroke="#22C55E" strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Expenses" stroke="#E0485A" strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ fill: 'rgba(48,108,236,0.07)' }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Revenue" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="Expenses" fill="#E0485A" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      {tab === 'reports' && chartData.length === 0 && (
        <div className="fin-fadeup" style={{ ...card, padding: '30px 20px', textAlign: 'center', marginBottom: 18, animationDelay: '200ms' }}>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>No entries yet — log a day&apos;s figures to see reports here.</div>
        </div>
      )}

      {tab === 'log' && (<>

      {/* New entry — hidden behind a button so it doesn't take up space */}
      {showAdd ? (
        <div className="fin-pop" style={{ ...card, padding: isMobile ? 16 : 22, border: '1px solid var(--color-border)', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span className="fin-sectionicon fin-sectionicon-revenue"><TrendingUp size={21} /></span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.01em' }}>
                  {financePeriod === 'monthly' ? 'New month entry' : financePeriod === 'yearly' ? 'New year entry' : 'New day entry'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 }}>Log revenue and expenses to keep your figures current.</div>
              </div>
            </div>
            <button className="fin-del" title="Close" onClick={() => setShowAdd(false)}><X size={16} /></button>
          </div>

          <div className="fin-fieldgrid" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', marginBottom: 20 }}>
            <div className="fin-field">
              <label style={lblBig}>Revenue <span className="fin-req">*</span></label>
              <div className="fin-amountwrap">
                <span className="fin-amountcurrency">KSh</span>
                <input className="fin-input fin-input-hero" type="number" inputMode="decimal" placeholder="Enter amount" value={nRevenue} onChange={e => setNRevenue(e.target.value)} />
              </div>
            </div>
            <div className="fin-field">
              {financePeriod === 'monthly' ? (
                <>
                  <label style={lblBig}>Month <span className="fin-req">*</span></label>
                  <div className="fin-selectwrap">
                    <CalendarDays size={16} className="fin-selecticon" />
                    <input className="fin-input fin-input-select" type="month" value={nDate.slice(0, 7)} onChange={e => setNDate(`${e.target.value}-01`)} />
                  </div>
                  <div className="fin-field-caption">Select the month for this entry.</div>
                </>
              ) : financePeriod === 'yearly' ? (
                <>
                  <label style={lblBig}>Year <span className="fin-req">*</span></label>
                  <div className="fin-selectwrap">
                    <CalendarDays size={16} className="fin-selecticon" />
                    <input className="fin-input fin-input-select" type="number" inputMode="numeric" placeholder={String(new Date().getFullYear())} value={nDate.slice(0, 4)} onChange={e => setNDate(`${e.target.value}-01-01`)} />
                  </div>
                  <div className="fin-field-caption">Select the year for this entry.</div>
                </>
              ) : (
                <>
                  <label style={lblBig}>Date <span className="fin-req">*</span></label>
                  <div className="fin-selectwrap">
                    <CalendarDays size={16} className="fin-selecticon" />
                    <input className="fin-input fin-input-select" type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
                  </div>
                  <div className="fin-field-caption">{fmtNice(nDate)}</div>
                </>
              )}
            </div>
          </div>

          {itemsEditor(nItems, setNItems, null, financePeriod === 'monthly' ? 'month' : financePeriod === 'yearly' ? 'year' : 'day')}

          <div style={{ marginTop: 20 }}>
            <label style={lblBig}><FileText size={14} /> Note (optional)</label>
            <div className="fin-notewrap">
              <textarea className="fin-textarea" maxLength={255} placeholder={financePeriod === 'monthly' ? 'Anything to add about this month…' : financePeriod === 'yearly' ? 'Anything to add about this year…' : 'Anything to add about today…'} value={nNote} onChange={e => setNNote(e.target.value)} />
              <span className="fin-notecount">{nNote.length}/255</span>
            </div>
          </div>

          <div className="fin-netstrip">
            <span>Net for this entry</span>
            <strong style={{ color: netColor(num(nRevenue) - itemsTotal(nItems)) }}>{money(num(nRevenue) - itemsTotal(nItems))}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="fin-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="fin-save" onClick={addEntry} disabled={!canAdd || saving}>
              {financePeriod === 'monthly' ? 'Save month entry' : financePeriod === 'yearly' ? 'Save year entry' : 'Save entry'} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button className="fin-newbtn" onClick={() => setShowAdd(true)}><Plus size={16} /> {financePeriod === 'monthly' ? 'Add month entry' : financePeriod === 'yearly' ? 'Add year entry' : 'Add day entry'}</button>
      )}

      {/* Months */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 20 }}>Loading…</div>
      ) : months.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5, padding: '24px 20px' }}>
          {financePeriod === 'monthly' ? 'No entries yet — add this month’s figures above.'
            : financePeriod === 'yearly' ? 'No entries yet — add this year’s figures above.'
            : 'No entries yet — add today’s figures above.'}
        </div>
      ) : financePeriod === 'yearly' ? (
        /* Yearly-tracked business: a flat list of years, one figure each — no month/week/day drill-down. */
        <div className="fin-daylist">
          {years.map((year, i) => {
            // One entry per year is the whole point of yearly tracking — match by
            // year, not by exact date, so a row saved under any day of the year
            // (e.g. by an older daily-tracked save, or a non-Jan-1 anchor) still
            // surfaces here instead of silently hiding behind "No entry".
            const entry = year.rows[0] || null;
            const ds = entry ? entry.entry_date : `${year.key}-01-01`;
            const has = !!entry;
            const editOpen = openDay === ds;
            const viewOpen = has && viewDay === ds;
            const expanded = editOpen || viewOpen;
            return (
              <div key={year.key} className={`fin-dayrow${i < years.length - 1 ? ' fin-dayrow-div' : ''}`}
                style={{ background: expanded ? 'rgba(48,108,236,0.07)' : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                {/* Compact slot — year · revenue · expenses · view/edit/delete */}
                <div onClick={() => (has ? toggleView(ds) : openDayEditor(ds))}
                  style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto auto' : '18px 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                  {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: has ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{year.key}</span>
                  </span>
                  {has ? (
                    <>
                      {chip(money(entry.revenue), '#22C55E')}
                      {chip(`−${money(entry.expenses)}`, '#E0485A')}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="fin-del" title="View this year" onClick={(e) => { e.stopPropagation(); toggleView(ds); }}><Eye size={13} /></button>
                        <button className="fin-del" title="Edit this year" onClick={(e) => { e.stopPropagation(); openDayEditor(ds); }}><Pencil size={13} /></button>
                        <button className="fin-del" title="Delete this year" onClick={(e) => { e.stopPropagation(); deleteRow(entry.id); }}><Trash2 size={13} /></button>
                      </div>
                    </>
                  ) : (
                    <span style={{ gridColumn: '3 / -1', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'right' }}>No entry — tap to add</span>
                  )}
                </div>

                {/* Expanded editor / read-only preview (bound to the shared draft buffer) */}
                {editOpen && renderEntryForm(ds, year.key, entry)}
                {viewOpen && renderEntryView(entry, year.key)}
              </div>
            );
          })}
        </div>
      ) : financePeriod === 'monthly' ? (
        /* Monthly-tracked business: a flat list of months, one figure each — no week/day drill-down. */
        <div className="fin-daylist">
          {months.map((month, i) => {
            // Same fix as the yearly list below: match by month, not by exact
            // date, so a row saved under any day of the month still surfaces
            // instead of silently hiding behind "No entry".
            const entry = month.rows[0] || null;
            const ds = entry ? entry.entry_date : `${month.key}-01`;
            const has = !!entry;
            const editOpen = openDay === ds;
            const viewOpen = has && viewDay === ds;
            const expanded = editOpen || viewOpen;
            return (
              <div key={month.key} className={`fin-dayrow${i < months.length - 1 ? ' fin-dayrow-div' : ''}`}
                style={{ background: expanded ? 'rgba(48,108,236,0.07)' : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                {/* Compact slot — month · revenue · expenses · view/edit/delete */}
                <div onClick={() => (has ? toggleView(ds) : openDayEditor(ds))}
                  style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto auto' : '18px 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                  {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: has ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{month.label}</span>
                  </span>
                  {has ? (
                    <>
                      {chip(money(entry.revenue), '#22C55E')}
                      {chip(`−${money(entry.expenses)}`, '#E0485A')}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="fin-del" title="View this month" onClick={(e) => { e.stopPropagation(); toggleView(ds); }}><Eye size={13} /></button>
                        <button className="fin-del" title="Edit this month" onClick={(e) => { e.stopPropagation(); openDayEditor(ds); }}><Pencil size={13} /></button>
                        <button className="fin-del" title="Delete this month" onClick={(e) => { e.stopPropagation(); deleteRow(entry.id); }}><Trash2 size={13} /></button>
                      </div>
                    </>
                  ) : (
                    <span style={{ gridColumn: '3 / -1', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'right' }}>No entry — tap to add</span>
                  )}
                </div>

                {/* Expanded editor / read-only preview (bound to the shared draft buffer) */}
                {editOpen && renderEntryForm(ds, month.label, entry)}
                {viewOpen && renderEntryView(entry, month.label)}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {months.map(month => {
            const open = isMonthOpen(month.key);
            return (
              <div key={month.key}>
                {/* Month header — bold, elevated, blue accent stripe */}
                <button className="fin-month" onClick={() => toggleMonth(month.key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    <CalendarDays size={16} style={{ color: 'var(--color-accent-text, #5B9BFF)', flexShrink: 0 }} />
                    <span className="fin-month-title">{month.label}</span>
                    <span className="fin-month-sub">{month.rows.length} day{month.rows.length !== 1 ? 's' : ''} logged</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!isMobile && chip(money(month.totals.revenue), '#22C55E')}
                    {!isMobile && chip(`−${money(month.totals.expenses)}`, '#E0485A')}
                    {chip(`Net ${money(month.totals.net)}`, netColor(month.totals.net))}
                  </span>
                </button>

                {/* Weeks — nested under the month via a connecting guide line */}
                {open && (
                  <div className="fin-month-body">
                    {/* Monthly expense breakdown — the whole month's spend, by category */}
                    {renderBreakdown(month, 'month')}

                    {month.weeks.map(week => {
                      const wOpen = isWeekOpen(week.key);
                      return (
                        <div key={week.key}>
                          {/* Week header — carries the week's totals, amber accent stripe */}
                          <button className="fin-weekhead" onClick={() => toggleWeek(week.key)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              {wOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              <span className="fin-week-title">{week.label}</span>
                              <span className="fin-week-sub">{week.count} day{week.count !== 1 ? 's' : ''}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                              {!isMobile && chip(money(week.totals.revenue), '#22C55E')}
                              {!isMobile && chip(`−${money(week.totals.expenses)}`, '#E0485A')}
                              {chip(`Net ${money(week.totals.net)}`, netColor(week.totals.net))}
                            </span>
                          </button>

                          {/* Weekly expense breakdown + days — nested under the week via a guide line */}
                          {wOpen && (
                            <div className="fin-week-body">
                              {renderBreakdown(week, 'week')}

                              {/* The seven weekdays — one unified list, not seven separate boxes */}
                              <div className="fin-daylist">
                                {week.dates.map((ds, i) => {
                                  const entry = week.byDate.get(ds);
                                  const has = !!entry;
                                  const editOpen = openDay === ds;
                                  const viewOpen = has && viewDay === ds;
                                  const expanded = editOpen || viewOpen;
                                  return (
                                    <div key={ds} className={`fin-dayrow${i < 6 ? ' fin-dayrow-div' : ''}`}
                                      style={{ background: expanded ? 'rgba(48,108,236,0.07)' : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                      {/* Compact slot — weekday · revenue · expenses · view/edit/delete */}
                                      <div onClick={() => (has ? toggleView(ds) : openDayEditor(ds))}
                                        style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto auto' : '18px 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                                        {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontSize: 13, fontWeight: 800, color: has ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{weekdayOf(ds)}</span>
                                          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{ordinal(parseDay(ds).getDate())}</span>
                                        </span>
                                        {has ? (
                                          <>
                                            {chip(money(entry.revenue), '#22C55E')}
                                            {chip(`−${money(entry.expenses)}`, '#E0485A')}
                                            <div style={{ display: 'flex', gap: 2 }}>
                                              <button className="fin-del" title="View this day" onClick={(e) => { e.stopPropagation(); toggleView(ds); }}><Eye size={13} /></button>
                                              <button className="fin-del" title="Edit this day" onClick={(e) => { e.stopPropagation(); openDayEditor(ds); }}><Pencil size={13} /></button>
                                              <button className="fin-del" title="Delete this day" onClick={(e) => { e.stopPropagation(); deleteRow(entry.id); }}><Trash2 size={13} /></button>
                                            </div>
                                          </>
                                        ) : (
                                          <span style={{ gridColumn: '3 / -1', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'right' }}>No entry — tap to add</span>
                                        )}
                                      </div>

                                      {/* Expanded editor / read-only preview (bound to the shared draft buffer) */}
                                      {editOpen && renderEntryForm(ds, fmtNice(ds), entry)}
                                      {viewOpen && renderEntryView(entry, fmtNice(ds))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </>)}

      </>
      )}

      <style jsx global>{`
        .fin-input {
          width: 100%; height: 34px; padding: 0 10px; border-radius: 9px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
          font-variant-numeric: tabular-nums;
        }
        .fin-input::placeholder { color: var(--color-text-tertiary); }
        .fin-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .fin-save {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 18px; border-radius: 10px; border: none;
          background: linear-gradient(135deg,#16a34a,#22C55E); color: #fff; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
        }
        .fin-save:disabled { opacity: .5; cursor: not-allowed; }
        .fin-bizbtn {
          display: flex; align-items: center; gap: 10px; min-width: 230px; max-width: 340px; height: 48px;
          padding: 0 14px; border-radius: 12px; cursor: pointer; font-family: inherit;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(120,150,210,0.28); transition: .12s;
        }
        .fin-bizbtn:hover { background: rgba(48,108,236,0.14); border-color: rgba(48,108,236,0.55); }
        .fin-bizavatar { color: #8FC0FF; }
        .fin-bizname { color: #EAF1FF; }
        /* The trigger sits on the page, so it follows the theme; the popup it opens is dark in both.
           (This whole block is now a global style tag, so no :global() wrapper is needed here anymore.) */
        [data-theme="light"] .fin-bizbtn { background: var(--color-bg-elevated); border-color: var(--color-border); }
        [data-theme="light"] .fin-bizbtn:hover { background: var(--color-accent-primary-subtle); border-color: var(--color-border-active); }
        [data-theme="light"] .fin-bizavatar { color: var(--color-accent-text); }
        [data-theme="light"] .fin-bizname { color: var(--color-text-primary); }
        .fin-newbtn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          height: 46px; margin-bottom: 22px; border-radius: 12px; cursor: pointer; font-family: inherit;
          font-size: 13.5px; font-weight: 700; color: #22C55E;
          background: rgba(34,197,94,0.08); border: 1px dashed rgba(34,197,94,0.45); transition: .12s;
        }
        .fin-newbtn:hover { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.7); }
        .fin-cancel {
          height: 38px; padding: 0 16px; border-radius: 10px; cursor: pointer; font-family: inherit;
          font-size: 13px; font-weight: 600; color: var(--color-text-secondary);
          background: transparent; border: 1px solid var(--color-border);
        }
        .fin-cancel:hover { border-color: var(--color-border-active); color: var(--color-text-primary); }
        .fin-additem {
          display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; margin-top: 10px; border-radius: 10px;
          background: rgba(91,155,255,0.08); border: 1px solid rgba(91,155,255,0.35); color: var(--color-accent-text, #5B9BFF);
          font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; transition: .15s;
        }
        .fin-additem:hover { background: rgba(91,155,255,0.16); border-color: rgba(91,155,255,0.6); }
        .fin-month {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 15px 18px; border-radius: 16px; cursor: pointer; font-family: inherit; text-align: left;
          background: linear-gradient(135deg, rgba(48,108,236,0.14), rgba(48,108,236,0.04) 75%);
          border: 1px solid rgba(91,155,255,0.30); border-left: 4px solid #5B9BFF;
          color: var(--color-text-secondary); transition: .12s;
        }
        .fin-month:hover { border-color: rgba(91,155,255,0.55); }
        .fin-month-title { font-size: 15.5px; font-weight: 800; color: var(--color-text-primary); letter-spacing: -.01em; }
        .fin-month-sub { font-size: 11px; color: var(--color-text-tertiary); margin-left: 2px; }
        .fin-month-body {
          display: flex; flex-direction: column; gap: 12px; margin-top: 10px;
          padding-left: 17px; margin-left: 9px; border-left: 2px solid rgba(91,155,255,0.22);
        }
        .fin-weekhead {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; border-radius: 11px; cursor: pointer; font-family: inherit; text-align: left;
          background: rgba(245,166,35,0.07); border: 1px solid rgba(245,166,35,0.25); border-left: 3px solid #F5A623;
          color: var(--color-text-secondary); transition: .12s;
        }
        .fin-weekhead:hover { border-color: rgba(245,166,35,0.55); }
        .fin-week-title { font-size: 13px; font-weight: 800; color: var(--color-text-primary); }
        .fin-week-sub { font-size: 10.5px; color: var(--color-text-tertiary); margin-left: 2px; }
        .fin-week-body {
          display: flex; flex-direction: column; gap: 10px; margin-top: 8px;
          padding-left: 15px; margin-left: 7px; border-left: 2px solid rgba(245,166,35,0.20);
        }
        .fin-daylist {
          border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: var(--color-bg-secondary);
        }
        .fin-dayrow-div { border-bottom: 1px solid var(--color-border-subtle); }
        .fin-del {
          width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); display: flex; align-items: center; justify-content: center; transition: .12s; flex-shrink: 0;
        }
        .fin-del:hover { color: #E0485A; background: rgba(224,72,90,0.1); }

        .fin-icon-badge { animation: finIconPulse 3.2s ease-in-out infinite; }

        .fin-hero {
          display: flex; align-items: center; gap: 20px; padding: 20px;
          border-radius: 18px; margin-bottom: 18px;
          background: linear-gradient(135deg, rgba(48,108,236,0.14), rgba(34,197,94,0.08));
          border: 1px solid var(--color-border);
        }
        .fin-hero-ringwrap { position: relative; width: 92px; height: 92px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .fin-hero-ringlabel { position: absolute; display: flex; flex-direction: column; align-items: center; }
        .fin-hero-ringpct { font-size: 17px; font-weight: 800; color: var(--color-text-primary); }
        .fin-hero-ringsub { font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .06em; }
        .fin-hero-main { min-width: 0; flex: 1; }
        .fin-hero-eyebrow { font-size: 11px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
        .fin-hero-amount { font-size: 30px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
        .fin-hero-stats { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; }
        .fin-hero-stats span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
        .pfin-ring-arc { transition: stroke-dashoffset .6s cubic-bezier(.22,1,.36,1); }
        @media (max-width: 420px) {
          .fin-hero { gap: 14px; padding: 16px; }
          .fin-hero-amount { font-size: 24px; }
        }

        .fin-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); margin-bottom: 18px; }
        .fin-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          height: 34px; border-radius: 9px; border: none; background: transparent; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--color-text-tertiary); transition: .15s;
        }
        .fin-tab:hover { color: var(--color-text-secondary); }
        .fin-tab-active { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
        .fin-tab-count {
          display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 999px; background: rgba(91,155,255,0.2); color: #5B9BFF; font-size: 10px; font-weight: 800;
        }

        .fin-field { display: flex; flex-direction: column; min-width: 0; }
        .fin-field-caption { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
        .fin-fieldgrid { display: grid; gap: 16px; align-items: start; }
        .fin-req { color: #E0485A; }

        /* Gradient squircle icon badge — the "Revenue" form header and the
           "Expenses" card header each get one, green/red to match this app's
           existing revenue/expense color coding everywhere else. */
        .fin-sectionicon {
          width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0; color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .fin-sectionicon-revenue { background: linear-gradient(135deg, #16a34a, #22C55E); }
        .fin-sectionicon-expenses { background: linear-gradient(135deg, #b8303f, #E0485A); }

        /* The amount is the one hero field in this form — large, its own
           full-width row, with a currency pill inset into the input (common
           fintech "add transaction" pattern: one dominant amount field). */
        .fin-amountwrap { position: relative; display: flex; align-items: center; }
        .fin-amountcurrency {
          position: absolute; left: 6px; top: 6px; bottom: 6px; display: flex; align-items: center;
          padding: 0 13px; border-radius: 8px; background: rgba(91,155,255,0.14);
          color: var(--color-accent-text, #5B9BFF); font-size: 13.5px; font-weight: 700; pointer-events: none;
        }
        .fin-input-hero { height: 52px; padding-left: 72px; font-size: 18px; font-weight: 700; border-radius: 12px; }

        /* Date/month/year field styled like a select trigger: icon inset on
           the left, native picker UI on the right. */
        .fin-selectwrap { position: relative; display: flex; align-items: center; }
        .fin-selecticon { position: absolute; left: 14px; color: var(--color-text-tertiary); pointer-events: none; }
        .fin-input-select { height: 52px; padding-left: 40px; font-size: 14px; font-weight: 600; border-radius: 12px; }

        /* Expenses card — icon+title+subtitle header, a running total chip,
           a column-header row, then one grid-aligned row per item. Header row
           and item rows share the same grid template so columns line up. */
        .fin-expensecard { padding: 16px; border-radius: 14px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle); }
        .fin-expensecard-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .fin-expensecard-title { font-size: 15px; font-weight: 800; color: var(--color-text-primary); }
        .fin-expensecard-sub { font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 1px; }

        .fin-totalchip {
          display: flex; align-items: center; gap: 8px; padding: 7px 12px; margin-left: auto;
          border-radius: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border-subtle); flex-shrink: 0;
        }
        .fin-totalchip-icon {
          width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
          background: rgba(91,155,255,0.16); color: var(--color-accent-text, #5B9BFF);
          display: flex; align-items: center; justify-content: center;
        }
        .fin-totalchip-label { font-size: 9.5px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .04em; }
        .fin-totalchip-value { font-size: 13px; font-weight: 800; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }

        .fin-itemrow2 { display: grid; grid-template-columns: 1fr 120px 36px; gap: 10px; align-items: center; }
        .fin-itemrow2-head {
          padding: 0 2px; margin-bottom: 8px;
          font-size: 10px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .05em;
        }
        .fin-itemrow2-name { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .fin-itemicon {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .fin-itemdel {
          width: 32px; height: 32px; border-radius: 9px; border: none; cursor: pointer; flex-shrink: 0;
          background: rgba(224,72,90,0.14); color: #E0485A;
          display: flex; align-items: center; justify-content: center; transition: .15s; margin: 0 auto;
        }
        .fin-itemdel:hover { background: rgba(224,72,90,0.26); }

        .fin-notewrap { position: relative; }
        .fin-textarea {
          width: 100%; min-height: 78px; padding: 12px 14px; border-radius: 12px; font-size: 13px; font-family: inherit;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border); color: var(--color-text-primary);
          outline: none; resize: vertical; line-height: 1.5; transition: .12s;
        }
        .fin-textarea::placeholder { color: var(--color-text-tertiary); }
        .fin-textarea:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .fin-notecount { position: absolute; right: 12px; bottom: 10px; font-size: 10.5px; color: var(--color-text-tertiary); pointer-events: none; }

        /* Running-total summary, shown live above the save button — the
           "confirm before you commit" pattern fintech amount forms use. */
        .fin-netstrip {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          margin-top: 14px; padding: 10px 14px; border-radius: 10px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle);
          font-size: 12.5px; color: var(--color-text-tertiary);
        }
        .fin-netstrip strong { font-size: 15px; font-variant-numeric: tabular-nums; }

        .fin-entrypanel { padding: 14px 14px 16px; }
        .fin-entrypanel-edit { background: rgba(91,155,255,0.05); border-top: 2px solid rgba(91,155,255,0.35); }
        .fin-entrypanel-view { background: rgba(255,255,255,0.02); border-top: 2px solid var(--color-border); }

        .fin-stattiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .fin-stattile {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border-subtle);
        }
        .fin-stattile-icon { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .fin-stattile-value { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.2; }
        .fin-stattile-label { font-size: 10.5px; color: var(--color-text-tertiary); }

        /* Same label-column / bar-column grid as .fin-daylist's category
           breakdown elsewhere in this file, just one size down — so a single
           entry's itemized view reads as the same design language, not a
           one-off. Column widths are set inline per isMobile, like that one. */
        .fin-viewbreakdown { display: flex; flex-direction: column; gap: 9px; }
        .fin-viewbreakdown-row { display: grid; gap: 10px; align-items: center; }
        .fin-viewbreakdown-left { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .fin-viewbreakdown-dot { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
        .fin-viewbreakdown-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
        .fin-viewbreakdown-right { display: flex; align-items: center; gap: 8px; }
        .fin-viewbreakdown-track { flex: 1; height: 14px; border-radius: 6px; background: rgba(255,255,255,0.06); overflow: hidden; min-width: 0; }
        .fin-viewbreakdown-bar { height: 100%; border-radius: 6px; transition: width .5s cubic-bezier(.22,1,.36,1); }
        .fin-viewbreakdown-amount { font-size: 12px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; flex-shrink: 0; white-space: nowrap; }

        .fin-note {
          display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px;
          border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--color-border-subtle);
        }
        .fin-note-mark { font-size: 20px; line-height: .6; color: var(--color-text-tertiary); font-family: serif; flex-shrink: 0; }
        .fin-note span:last-child { font-size: 12px; color: var(--color-text-secondary); font-style: italic; line-height: 1.5; }

        .fin-fadeup { animation: finFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
        .fin-pop { animation: finPop .28s cubic-bezier(.22,1,.36,1) both; }
        @keyframes finFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes finPop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes finIconPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @media (prefers-reduced-motion: reduce) {
          .fin-fadeup, .fin-pop, .fin-icon-badge { animation: none; }
          .fin-viewbreakdown-bar { transition: none; }
        }
      `}</style>
    </div>
  );
}
