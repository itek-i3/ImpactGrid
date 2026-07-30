'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Sigma, ChevronDown, ChevronRight, Lock, X, Check, Building2, BarChart2, CalendarDays } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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
  const [openDay, setOpenDay] = useState(null);                     // the date (YYYY-MM-DD) whose slot is expanded
  const [draft, setDraft] = useState({ revenue: '', items: [{ ...EMPTY_ITEM }], note: '' }); // editor buffer for openDay
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(null);               // the business currently being viewed
  const [bizMenuOpen, setBizMenuOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('daily');
  const [chartType, setChartType] = useState('bar');

  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));

  // Keep a valid business selected (adjust during render — React's documented pattern).
  if (businesses.length && !businesses.some(b => b.id === businessId)) {
    setBusinessId(businesses[0].id);
  } else if (!businesses.length && businessId) {
    setBusinessId(null);
  }

  const demoKey = agencyId ? `demo-finance-${agencyId}-${businessId || 'none'}` : 'demo-finance';

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

  // Businesses in this agency (for the switcher) + realtime.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(`demo-biz-${agencyId || 'x'}`); list = raw ? JSON.parse(raw) : [{ id: 'demo-biz-1', name: 'Sample Business' }]; } catch (_) {}
        if (!cancelled) setBusinesses(list);
        return;
      }
      if (!agencyId) { if (!cancelled) setBusinesses([]); return; }
      const { data } = await createClient().from('businesses').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
      if (!cancelled) setBusinesses(data || []);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`biz:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo]);

  // Finance entries for the SELECTED business + realtime.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(demoKey) : null;
        if (!cancelled) { setRows(raw ? JSON.parse(raw) : []); setLoading(false); }
        return;
      }
      if (!agencyId || !businessId) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      const { data } = await createClient()
        .from('daily_finance').select('*').eq('agency_id', agencyId).eq('business_id', businessId)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false });
      if (!cancelled) { setRows(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`finance:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_finance', filter: `agency_id=eq.${agencyId}` }, () => {
        const el = typeof document !== 'undefined' ? document.activeElement : null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        load();
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, demoKey, businessId]);

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

  // Report-ready revenue vs expenses chart (daily, weekly, or monthly).
  const chartData = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (!r.entry_date) return;
      let key = r.entry_date;
      let label = fmtChartDay(r.entry_date);
      if (reportPeriod === 'weekly') {
        key = weekKeyOf(r.entry_date);
        label = weekLabel(key);
      } else if (reportPeriod === 'monthly') {
        key = monthKeyOf(r.entry_date);
        label = monthLabel(key);
      }
      if (!map.has(key)) map.set(key, { key, label, revenue: 0, expenses: 0 });
      const e = map.get(key);
      e.revenue += num(r.revenue);
      e.expenses += num(r.expenses);
    });
    return [...map.values()]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .slice(reportPeriod === 'daily' ? -45 : -12)
      .map(e => ({ label: e.label, Revenue: e.revenue, Expenses: e.expenses }));
  }, [rows, reportPeriod]);

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

  const latestMonthKey = months[0]?.key;
  const isMonthOpen = (key) => (key === latestMonthKey) !== monthToggles.has(key); // latest open by default
  const toggleMonth = (key) => setMonthToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const latestWeekKey = months[0]?.weeks?.[0]?.key;
  const isWeekOpen = (key) => (key === latestWeekKey) !== weekToggles.has(key); // latest week open by default
  const toggleWeek = (key) => setWeekToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const persistDemo = (next) => { setRows(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const activeBiz = businesses.find(b => b.id === businessId) || null;

  // Create-or-update the single entry for a given date (never a second Monday).
  // `d` is an explicit editor value so callers avoid any stale-state reads.
  const saveDay = async (dateStr, d) => {
    const items = cleanItems(d.items);
    const expenses = itemsTotal(items);
    const revenue = num(d.revenue);
    const note = (d.note || '').trim() || null;
    const existing = rows.find(r => r.entry_date === dateStr);
    if (!existing && revenue === 0 && expenses === 0 && !note) return; // nothing to store
    if (!isDemo && (!agencyId || !businessId)) return;

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
      agency_id: agencyId, business_id: businessId,
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

  const addEntry = async () => {
    if (num(nRevenue) === 0 && itemsTotal(nItems) === 0 && !nNote.trim()) return;
    if (!isDemo && (!agencyId || !businessId)) return;
    setSaving(true);
    // Upsert by date so picking a date that already exists edits it (no duplicate day).
    await saveDay(nDate || today, { revenue: nRevenue, items: nItems, note: nNote });
    setNRevenue(''); setNItems([{ ...EMPTY_ITEM }]); setNNote(''); setNDate(today); setSaving(false); setShowAdd(false);
  };

  const deleteRow = async (id) => {
    if (!id) return;
    setOpenDay(null);
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
  const itemsEditor = (items, setItems, commit) => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 28px', gap: 8, alignItems: 'center' }}>
            <input className="fin-input" list="fin-cats" type="text" placeholder="What was spent on (e.g. Rent)"
              value={it.what} onChange={e => change(i, { what: e.target.value })} onBlur={() => commit?.(items)} />
            <input className="fin-input" type="number" inputMode="decimal" placeholder="Amount"
              value={it.amount} onChange={e => change(i, { amount: e.target.value })} onBlur={() => commit?.(items)} />
            <button className="fin-del" title="Remove item"
              onClick={() => { const next = items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_ITEM }]; setItems(next); commit?.(next); }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <button className="fin-additem" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}><Plus size={13} /> Add item</button>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Expenses total <strong style={{ color: '#E0485A', fontVariantNumeric: 'tabular-nums' }}>{money(itemsTotal(items))}</strong>
          </span>
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
  const canAdd = num(nRevenue) !== 0 || itemsTotal(nItems) !== 0 || nNote.trim();

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>Daily Finance is available to managers and admins only.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' }}>
      <datalist id="fin-cats">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
          <Wallet size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Finance</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Track daily revenue &amp; expenses, and see exactly where each week&apos;s money goes</div>
        </div>
      </div>

      {/* Business switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Business</span>
        <div style={{ position: 'relative' }}>
          <button className="fin-bizbtn" onClick={() => setBizMenuOpen(o => !o)}>
            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.22)', color: '#8FC0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
              {(activeBiz?.name || '?').charAt(0).toUpperCase()}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#EAF1FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
              {activeBiz?.name || 'Select business'}
            </span>
            <ChevronDown size={17} style={{ color: '#8FB4E8', flexShrink: 0 }} />
          </button>
          {bizMenuOpen && (
            <>
              <div onClick={() => setBizMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 901, minWidth: 300, maxHeight: 360, overflowY: 'auto', background: '#0b1424', border: '1px solid rgba(120,150,210,0.25)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', padding: 6 }}>
                {businesses.length === 0 && (
                  <div style={{ padding: '16px 12px', fontSize: 12.5, color: '#8FB4E8' }}>No businesses yet.</div>
                )}
                {businesses.map(b => {
                  const on = b.id === businessId;
                  return (
                    <button key={b.id} onClick={() => { setBusinessId(b.id); setBizMenuOpen(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 9, border: 'none', background: on ? 'rgba(48,108,236,0.22)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'none'; }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.22)', color: '#8FC0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{(b.name || '?').charAt(0).toUpperCase()}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#EAF1FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                        {(b.domain || b.sector) && <span style={{ display: 'block', fontSize: 11.5, color: '#8FB4E8', marginTop: 1 }}>{[b.domain, b.sector].filter(Boolean).join(' · ')}</span>}
                      </span>
                      {on && <Check size={16} style={{ color: '#7EB3FF', flexShrink: 0 }} />}
                    </button>
                  );
                })}
                <button onClick={() => { setBizMenuOpen(false); setCurrentView('businesses'); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px', marginTop: 4, border: 'none', borderTop: '1px solid rgba(120,150,210,0.18)', background: 'none', color: '#7EB3FF', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Building2 size={15} /> Manage businesses
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!businessId ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>No business selected</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>Create a business in the Businesses tab to start tracking its daily finance.</div>
          <button className="fin-save" onClick={() => setCurrentView('businesses')} style={{ margin: '0 auto' }}><Building2 size={15} /> Go to Businesses</button>
        </div>
      ) : (
      <>

      {/* Overall summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
        {[
          { label: 'Total revenue', value: totals.revenue, Icon: TrendingUp, tint: '#22C55E' },
          { label: 'Total expenses', value: totals.expenses, Icon: TrendingDown, tint: '#E0485A' },
          { label: 'Net', value: totals.net, Icon: Sigma, tint: '#5B9BFF' },
        ].map(({ label, value, Icon, tint }) => (
          <div key={label} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${tint}20`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(value)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs Expenses and Expenses-only charts */}
      {chartData.length > 0 && (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={16} /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Finance reports</span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{activeBiz?.name ? `${activeBiz.name} · ` : ''}{reportPeriod}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['daily','weekly','monthly'].map(period => (
                <button key={period} onClick={() => setReportPeriod(period)} style={{ border: '1px solid', borderColor: reportPeriod === period ? 'rgba(91,155,255,0.6)' : 'var(--color-border)', background: reportPeriod === period ? 'rgba(91,155,255,0.16)' : 'transparent', color: reportPeriod === period ? '#EAF1FF' : 'var(--color-text-secondary)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {period}
                </button>
              ))}
            </div>
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
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8 }}>Revenue vs Expenses · {reportPeriod}</div>
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

      {/* New entry — hidden behind a button so it doesn't take up space */}
      {showAdd ? (
        <div style={{ ...card, border: '1px solid rgba(34,197,94,0.35)', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>New day entry</span>
            <button className="fin-del" title="Close" onClick={() => setShowAdd(false)}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ width: 160 }}>
              <label style={lbl}>Date</label>
              <input className="fin-input" type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{fmtNice(nDate)}</div>
            </div>
            <div style={{ width: 160 }}>
              <label style={lbl}>Revenue</label>
              <input className="fin-input" type="number" inputMode="decimal" placeholder="0" value={nRevenue} onChange={e => setNRevenue(e.target.value)} />
            </div>
          </div>
          <label style={lbl}>Expenses — what was spent</label>
          {itemsEditor(nItems, setNItems)}
          <label style={{ ...lbl, marginTop: 14 }}>Note (optional)</label>
          <input className="fin-input" type="text" placeholder="Anything to add about today…" value={nNote} onChange={e => setNNote(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="fin-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="fin-save" onClick={addEntry} disabled={!canAdd || saving}><Plus size={15} /> Add day entry</button>
          </div>
        </div>
      ) : (
        <button className="fin-newbtn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add day entry</button>
      )}

      {/* Months */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 20 }}>Loading…</div>
      ) : months.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5, padding: '24px 20px' }}>No entries yet — add today&apos;s figures above.</div>
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
                    <CalendarDays size={16} style={{ color: '#5B9BFF', flexShrink: 0 }} />
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
                                  const dayOpen = openDay === ds;
                                  const commit = () => saveDay(ds, draft);
                                  return (
                                    <div key={ds} className={`fin-dayrow${i < 6 ? ' fin-dayrow-div' : ''}`}
                                      style={{ background: dayOpen ? 'rgba(48,108,236,0.07)' : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                      {/* Compact slot — weekday · revenue · expenses · delete */}
                                      <div onClick={() => openDayEditor(ds)}
                                        style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto 28px' : '18px 1fr auto auto 30px', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                                        {dayOpen ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontSize: 13, fontWeight: 800, color: has ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{weekdayOf(ds)}</span>
                                          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{ordinal(parseDay(ds).getDate())}</span>
                                        </span>
                                        {has ? (
                                          <>
                                            {chip(money(entry.revenue), '#22C55E')}
                                            {chip(`−${money(entry.expenses)}`, '#E0485A')}
                                            <button className="fin-del" title="Delete this day" onClick={(e) => { e.stopPropagation(); deleteRow(entry.id); }}><Trash2 size={13} /></button>
                                          </>
                                        ) : (
                                          <span style={{ gridColumn: '3 / -1', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'right' }}>No entry — tap to add</span>
                                        )}
                                      </div>

                                      {/* Expanded editor (bound to the shared draft buffer) */}
                                      {dayOpen && (
                                        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
                                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', margin: '12px 0' }}>
                                            <div style={{ width: 150 }}>
                                              <label style={lbl}>Revenue</label>
                                              <input className="fin-input" type="number" inputMode="decimal" placeholder="0" value={draft.revenue} onChange={e => setDraft(d => ({ ...d, revenue: e.target.value }))} onBlur={commit} />
                                            </div>
                                            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                                              {fmtNice(ds)}{entry ? ` · logged by ${memberName(entry.created_by)}` : ''}
                                            </div>
                                          </div>
                                          <label style={lbl}>Expenses — what was spent</label>
                                          {itemsEditor(draft.items, (next) => setDraft(d => ({ ...d, items: next })), (nextItems) => saveDay(ds, { ...draft, items: nextItems }))}
                                          <label style={{ ...lbl, marginTop: 12 }}>Note</label>
                                          <input className="fin-input" type="text" placeholder="Optional note…" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} onBlur={commit} />
                                        </div>
                                      )}
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

      </>
      )}

      <style jsx>{`
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
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 8px;
          background: transparent; border: 1px dashed var(--color-border); color: var(--color-text-secondary);
          font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .fin-additem:hover { border-color: var(--color-border-active); color: var(--color-text-primary); }
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
      `}</style>
    </div>
  );
}
