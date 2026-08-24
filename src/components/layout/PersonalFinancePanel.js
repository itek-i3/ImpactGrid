'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import { PiggyBank, Plus, Trash2, TrendingUp, TrendingDown, Sigma, ChevronRight, X, BarChart2, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
const itemsTotal = (items) => (items || []).reduce((s, i) => s + num(i.amount), 0);
const cleanItems = (items) => (items || [])
  .filter(i => (i.what || '').trim() || num(i.amount))
  .map(i => ({ what: (i.what || '').trim(), amount: num(i.amount) }));
const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const parseDay = (dateStr) => new Date(`${dateStr}T00:00:00`);
const fmtChartDay = (dateStr) => { const d = parseDay(dateStr); return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`; };
const fmtNice = (dateStr) => {
  const d = parseDay(dateStr);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};
const monthKeyOf = (dateStr) => (dateStr || '').slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = (key || '').split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const pad2 = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (dateStr) => { const d = parseDay(dateStr); const dow = (d.getDay() + 6) % 7; return addDays(d, -dow); };
const weekKeyOf = (dateStr) => toDateStr(mondayOf(dateStr));
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

const EXPENSE_CATEGORIES = ['Rent / Mortgage', 'Groceries', 'Transport', 'Utilities', 'Subscriptions', 'Entertainment', 'Health', 'Debt Repayment', 'Savings', 'Shopping', 'Education', 'Miscellaneous'];
const EMPTY_ITEM = { what: '', amount: '' };

const CATEGORY_PALETTE = ['#E0485A', '#F97316', '#F5A623', '#EAB308', '#84CC16', '#EC4899', '#5B9BFF', '#0EA5E9', '#14B8A6', '#F472B6', '#A78BFA', '#94A3B8'];

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
  const remainder = rowExpenses - labelled;
  if (remainder > 0.5) {
    if (!map.has('__unlabelled__')) map.set('__unlabelled__', { label: 'Unlabelled', amount: 0 });
    map.get('__unlabelled__').amount += remainder;
  }
  const list = [...map.values()].filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = list.reduce((s, x) => s + x.amount, 0);
  return { list, total };
};

const chip = (text, tint) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: `${tint}20`, color: tint, fontWeight: 800, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{text}</span>
);

// Smoothly eases a displayed number toward `value` whenever it changes —
// summary tiles count up/down instead of jumping, so edits feel alive.
function useCountUp(value, duration = 550) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (Math.abs(to - from) < 0.5) { setDisplay(to); fromRef.current = to; return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) { raf = requestAnimationFrame(tick); }
      else { fromRef.current = to; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export default function PersonalFinancePanel() {
  const { userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nDate, setNDate] = useState(today);
  const [nIncome, setNIncome] = useState('');
  const [nItems, setNItems] = useState([{ ...EMPTY_ITEM }]);
  const [nNote, setNNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [monthToggles, setMonthToggles] = useState(() => new Set());
  const [weekToggles, setWeekToggles] = useState(() => new Set());
  const [openDay, setOpenDay] = useState(null);
  const [draft, setDraft] = useState({ income: '', items: [{ ...EMPTY_ITEM }], note: '' });
  const [reportPeriod, setReportPeriod] = useState('daily');
  const [chartType, setChartType] = useState('bar');
  const incomeInputRef = useRef(null);

  const demoKey = 'demo-personal-finance';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(demoKey) : null;
        if (!cancelled) { setRows(raw ? JSON.parse(raw) : []); setLoading(false); }
        return;
      }
      if (!currentUserId) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      const { data } = await createClient()
        .from('personal_finance').select('*').eq('user_id', currentUserId)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false });
      if (!cancelled) { setRows(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !currentUserId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`personal-finance:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_finance', filter: `user_id=eq.${currentUserId}` }, () => {
        const el = typeof document !== 'undefined' ? document.activeElement : null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        load();
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [currentUserId, isDemo]);

  // Autofocus the income field the moment the quick-add card opens.
  useEffect(() => {
    if (showAdd) { const t = setTimeout(() => incomeInputRef.current?.focus(), 60); return () => clearTimeout(t); }
  }, [showAdd]);

  const totals = useMemo(() => {
    let inc = 0, e = 0;
    rows.forEach(x => { inc += num(x.income); e += num(x.expenses); });
    return { income: inc, expenses: e, net: inc - e };
  }, [rows]);

  const incomeDisplay = useCountUp(totals.income);
  const expensesDisplay = useCountUp(totals.expenses);
  const netDisplay = useCountUp(totals.net);

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
      if (!map.has(key)) map.set(key, { key, label, income: 0, expenses: 0 });
      const e = map.get(key);
      e.income += num(r.income);
      e.expenses += num(r.expenses);
    });
    return [...map.values()]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .slice(reportPeriod === 'daily' ? -45 : -12)
      .map(e => ({ label: e.label, Income: e.income, Expenses: e.expenses }));
  }, [rows, reportPeriod]);

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
      let inc = 0, exp = 0;
      mo.rows.forEach(r => { inc += num(r.income); exp += num(r.expenses); });
      mo.totals = { income: inc, expenses: exp, net: inc - exp };
      mo.label = monthLabel(mo.key);

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
        let wi = 0, we = 0;
        w.rows.forEach(r => { wi += num(r.income); we += num(r.expenses); });
        w.totals = { income: wi, expenses: we, net: wi - we };
        w.label = weekLabel(w.key);
        w.count = new Set(w.rows.map(r => r.entry_date)).size;
      });
      weeks.sort((a, b) => (a.key < b.key ? 1 : -1));
      mo.weeks = weeks;
    });
    arr.sort((a, b) => (a.key < b.key ? 1 : -1));
    return arr;
  }, [rows]);

  const latestMonthKey = months[0]?.key;
  const isMonthOpen = (key) => (key === latestMonthKey) !== monthToggles.has(key);
  const toggleMonth = (key) => setMonthToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const latestWeekKey = months[0]?.weeks?.[0]?.key;
  const isWeekOpen = (key) => (key === latestWeekKey) !== weekToggles.has(key);
  const toggleWeek = (key) => setWeekToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const persistDemo = (next) => { setRows(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const saveDay = async (dateStr, d) => {
    const items = cleanItems(d.items);
    const expenses = itemsTotal(items);
    const income = num(d.income);
    const note = (d.note || '').trim() || null;
    const existing = rows.find(r => r.entry_date === dateStr);
    if (!existing && income === 0 && expenses === 0 && !note) return false;
    if (!isDemo && !currentUserId) return false;

    if (existing) {
      const patch = { income, expenses, expense_items: items, note };
      const next = rows.map(r => (r.id === existing.id ? { ...r, ...patch } : r));
      setRows(next);
      if (isDemo) { persistDemo(next); return true; }
      try {
        const { error } = await createClient().from('personal_finance').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) { console.error('[personal-finance] update failed —', error.message, '| code:', error.code, '| details:', error.details); toast.error('Could not save', error.message); return false; }
      } catch (err) { console.error('[personal-finance] update threw:', err); toast.error('Could not save', 'Something went wrong.'); return false; }
      return true;
    }

    const base = {
      user_id: currentUserId,
      entry_date: dateStr, income, expenses, expense_items: items, note,
    };
    if (isDemo) { persistDemo([{ ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...rows]); return true; }
    try {
      const { data, error } = await createClient().from('personal_finance').insert(base).select('*').maybeSingle();
      if (error) { console.error('[personal-finance] insert failed —', error.message, '| code:', error.code, '| details:', error.details); toast.error('Could not save', error.message); return false; }
      if (data) setRows(prev => (prev.some(r => r.id === data.id) ? prev : [data, ...prev]));
      return true;
    } catch (err) { console.error('[personal-finance] insert threw:', err); toast.error('Could not save', 'Something went wrong.'); return false; }
  };

  const openDayEditor = (dateStr) => {
    if (openDay === dateStr) { setOpenDay(null); return; }
    const entry = rows.find(r => r.entry_date === dateStr);
    setDraft({
      income: entry && entry.income != null ? String(entry.income) : '',
      items: (Array.isArray(entry?.expense_items) && entry.expense_items.length)
        ? entry.expense_items.map(i => ({ what: i.what || '', amount: i.amount != null ? String(i.amount) : '' }))
        : [{ ...EMPTY_ITEM }],
      note: entry?.note || '',
    });
    setOpenDay(dateStr);
  };

  const addEntry = async () => {
    if (num(nIncome) === 0 && itemsTotal(nItems) === 0 && !nNote.trim()) return;
    if (!isDemo && !currentUserId) return;
    setSaving(true);
    const dateUsed = nDate || today;
    const ok = await saveDay(dateUsed, { income: nIncome, items: nItems, note: nNote });
    setNIncome(''); setNItems([{ ...EMPTY_ITEM }]); setNNote(''); setNDate(today); setSaving(false); setShowAdd(false);
    if (ok) toast.success('Entry logged', fmtNice(dateUsed));
  };

  const deleteRow = async (id) => {
    if (!id) return;
    setOpenDay(null);
    if (isDemo) { persistDemo(rows.filter(r => r.id !== id)); toast.success('Entry deleted'); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      const { error } = await createClient().from('personal_finance').delete().eq('id', id);
      if (error) { console.error('[personal-finance] delete failed —', error.message, '| code:', error.code, '| details:', error.details); toast.error('Could not delete', error.message); return; }
      toast.success('Entry deleted');
    } catch (err) { console.error('[personal-finance] delete threw:', err); toast.error('Could not delete', 'Something went wrong.'); }
  };

  const netColor = (n) => (n > 0 ? '#22C55E' : n < 0 ? '#E0485A' : 'var(--color-text-tertiary)');

  // Chevron that rotates open/closed instead of swapping icons — a small
  // continuous motion reads as far smoother than an instant icon swap.
  const rotChevron = (open, size = 15) => (
    <ChevronRight size={size} className="pfin-chevron" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--color-text-tertiary)' }} />
  );

  // Collapsible wrapper using the 0fr → 1fr grid trick, so content animates
  // open/closed smoothly without ever measuring pixel heights in JS.
  const Collapse = ({ open, children }) => (
    <div className={`pfin-collapse${open ? ' pfin-collapse-open' : ''}`}>
      <div className="pfin-collapse-inner">{children}</div>
    </div>
  );

  const itemsEditor = (items, setItems, commit) => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    const quickFill = (category) => {
      const idx = items.findIndex(it => !it.what.trim());
      const next = idx !== -1
        ? items.map((it, i) => (i === idx ? { ...it, what: category } : it))
        : [...items, { what: category, amount: '' }];
      setItems(next);
      commit?.(next);
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EXPENSE_CATEGORIES.map((cat, i) => {
            const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
            return (
              <button key={cat} type="button" className="pfin-chip"
                style={{ color, background: hexToRgba(color, 0.12), borderColor: hexToRgba(color, 0.4) }}
                onClick={() => quickFill(cat)}
                onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(color, 0.22); }}
                onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(color, 0.12); }}>
                {cat}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} className="pfin-item-row" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 28px', gap: 8, alignItems: 'center' }}>
              <input className="pfin-input" list="pfin-cats" type="text" placeholder="What was spent on (e.g. Groceries)"
                value={it.what} onChange={e => change(i, { what: e.target.value })} onBlur={() => commit?.(items)} />
              <input className="pfin-input" type="number" inputMode="decimal" placeholder="Amount"
                value={it.amount} onChange={e => change(i, { amount: e.target.value })} onBlur={() => commit?.(items)} />
              <button className="pfin-del" title="Remove item"
                onClick={() => { const next = items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_ITEM }]; setItems(next); commit?.(next); }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <button className="pfin-additem" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}><Plus size={13} /> Add item</button>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Expenses total <strong style={{ color: '#E0485A', fontVariantNumeric: 'tabular-nums' }}>{money(itemsTotal(items))}</strong>
          </span>
        </div>
      </div>
    );
  };

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
                      <div className="pfin-bar" style={{ width: `${Math.max(3, (c.amount / max) * 100)}%`, height: '100%', borderRadius: 6, background: color, opacity: 0.9 }} />
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
  const canAdd = num(nIncome) !== 0 || itemsTotal(nItems) !== 0 || nNote.trim();

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' }}>
      <datalist id="pfin-cats">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>

      {/* Header */}
      <div className="pfin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div className="pfin-icon-badge" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
          <PiggyBank size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Personal Finance</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Log your income &amp; expenses and watch exactly where each week&apos;s money goes — private to you</div>
        </div>
      </div>

      {/* Overall summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
        {[
          { label: 'Total income', value: incomeDisplay, Icon: TrendingUp, tint: '#22C55E' },
          { label: 'Total expenses', value: expensesDisplay, Icon: TrendingDown, tint: '#E0485A' },
          { label: 'Net', value: netDisplay, Icon: Sigma, tint: '#5B9BFF' },
        ].map(({ label, value, Icon, tint }, i) => (
          <div key={label} className="pfin-tile pfin-fadeup" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 60}ms` }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${tint}20`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(value)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Income vs Expenses charts */}
      {chartData.length > 0 && (
        <div className="pfin-fadeup" style={{ ...card, marginBottom: 18, animationDelay: '120ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={16} /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Finance reports</span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{reportPeriod}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['daily','weekly','monthly'].map(period => (
                <button key={period} className="pfin-pill" onClick={() => setReportPeriod(period)} style={{ borderColor: reportPeriod === period ? 'rgba(91,155,255,0.6)' : 'var(--color-border)', background: reportPeriod === period ? 'rgba(91,155,255,0.16)' : 'transparent', color: reportPeriod === period ? '#EAF1FF' : 'var(--color-text-secondary)' }}>
                  {period}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {['bar','line'].map(mode => (
                <button key={mode} className="pfin-pill" onClick={() => setChartType(mode)} style={{ borderColor: chartType === mode ? 'rgba(34,197,94,0.6)' : 'var(--color-border)', background: chartType === mode ? 'rgba(34,197,94,0.14)' : 'transparent', color: chartType === mode ? '#EAF1FF' : 'var(--color-text-secondary)' }}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 10, background: 'var(--color-bg-secondary)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8 }}>Income vs Expenses · {reportPeriod}</div>
              <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
                {chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ stroke: 'rgba(48,108,236,0.35)', strokeWidth: 1 }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} animationDuration={400} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="Income" stroke="#22C55E" strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="Expenses" stroke="#E0485A" strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ fill: 'rgba(48,108,236,0.07)' }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Income" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive animationDuration={500} animationEasing="ease-out" />
                    <Bar dataKey="Expenses" fill="#E0485A" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive animationDuration={500} animationEasing="ease-out" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* New entry — hidden behind a button so it doesn't take up space */}
      {showAdd ? (
        <div className="pfin-pop" style={{ ...card, border: '1px solid rgba(34,197,94,0.35)', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}><Sparkles size={15} style={{ color: '#22C55E' }} /> New day entry</span>
            <button className="pfin-del" title="Close" onClick={() => setShowAdd(false)}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ width: 160 }}>
              <label style={lbl}>Date</label>
              <input className="pfin-input" type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{fmtNice(nDate)}</div>
            </div>
            <div style={{ width: 160 }}>
              <label style={lbl}>Income</label>
              <input ref={incomeInputRef} className="pfin-input" type="number" inputMode="decimal" placeholder="0" value={nIncome} onChange={e => setNIncome(e.target.value)} />
            </div>
          </div>
          <label style={lbl}>Expenses — what was spent</label>
          {itemsEditor(nItems, setNItems)}
          <label style={{ ...lbl, marginTop: 14 }}>Note (optional)</label>
          <input className="pfin-input" type="text" placeholder="Anything to add about today…" value={nNote} onChange={e => setNNote(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="pfin-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="pfin-save" onClick={addEntry} disabled={!canAdd || saving}>
              {saving ? <Loader2 size={15} className="pfin-spin" /> : <Plus size={15} />} {saving ? 'Saving…' : 'Add day entry'}
            </button>
          </div>
        </div>
      ) : (
        <button className="pfin-newbtn pfin-fadeup" onClick={() => setShowAdd(true)} style={{ animationDelay: '160ms' }}><Plus size={16} /> Add day entry</button>
      )}

      {/* Months */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 30 }}>
          <Loader2 size={16} className="pfin-spin" /> Loading…
        </div>
      ) : months.length === 0 ? (
        <div className="pfin-fadeup" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: '40px 20px' }}>
          <div className="pfin-empty-icon"><PiggyBank size={26} /></div>
          <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>No entries yet</div>
          <div style={{ fontSize: 12.5 }}>Add today&apos;s figures above to start tracking your money.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {months.map((month, mi) => {
            const open = isMonthOpen(month.key);
            return (
              <div key={month.key} className="pfin-fadeup" style={{ animationDelay: `${Math.min(mi, 5) * 50}ms` }}>
                {/* Month header — bold, elevated, blue accent stripe */}
                <button className="pfin-month" onClick={() => toggleMonth(month.key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    {rotChevron(open, 17)}
                    <CalendarDays size={16} style={{ color: '#5B9BFF', flexShrink: 0 }} />
                    <span className="pfin-month-title">{month.label}</span>
                    <span className="pfin-month-sub">{month.rows.length} day{month.rows.length !== 1 ? 's' : ''} logged</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!isMobile && chip(money(month.totals.income), '#22C55E')}
                    {!isMobile && chip(`−${money(month.totals.expenses)}`, '#E0485A')}
                    {chip(`Net ${money(month.totals.net)}`, netColor(month.totals.net))}
                  </span>
                </button>

                {/* Weeks — nested under the month via a connecting guide line */}
                <Collapse open={open}>
                  <div className="pfin-month-body">
                    {/* Monthly expense breakdown — the whole month's spend, by category */}
                    {renderBreakdown(month, 'month')}

                    {month.weeks.map(week => {
                      const wOpen = isWeekOpen(week.key);
                      return (
                        <div key={week.key}>
                          {/* Week header — carries the week's totals, amber accent stripe */}
                          <button className="pfin-weekhead" onClick={() => toggleWeek(week.key)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              {rotChevron(wOpen, 15)}
                              <span className="pfin-week-title">{week.label}</span>
                              <span className="pfin-week-sub">{week.count} day{week.count !== 1 ? 's' : ''}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                              {!isMobile && chip(money(week.totals.income), '#22C55E')}
                              {!isMobile && chip(`−${money(week.totals.expenses)}`, '#E0485A')}
                              {chip(`Net ${money(week.totals.net)}`, netColor(week.totals.net))}
                            </span>
                          </button>

                          {/* Weekly expense breakdown + days — nested under the week via a guide line */}
                          <Collapse open={wOpen}>
                            <div className="pfin-week-body">
                              {renderBreakdown(week, 'week')}

                              {/* The seven weekdays — one unified list, not seven separate boxes */}
                              <div className="pfin-daylist">
                                {week.dates.map((ds, i) => {
                                  const entry = week.byDate.get(ds);
                                  const has = !!entry;
                                  const dayOpen = openDay === ds;
                                  const commit = () => saveDay(ds, draft);
                                  return (
                                    <div key={ds} className={`pfin-dayrow${i < 6 ? ' pfin-dayrow-div' : ''}`}
                                      style={{ background: dayOpen ? 'rgba(48,108,236,0.07)' : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                      {/* Compact slot — weekday · income · expenses · delete */}
                                      <div onClick={() => openDayEditor(ds)}
                                        style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto 28px' : '18px 1fr auto auto 30px', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                                        {rotChevron(dayOpen, 14)}
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontSize: 13, fontWeight: 800, color: has ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{weekdayOf(ds)}</span>
                                          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{ordinal(parseDay(ds).getDate())}</span>
                                        </span>
                                        {has ? (
                                          <>
                                            {chip(money(entry.income), '#22C55E')}
                                            {chip(`−${money(entry.expenses)}`, '#E0485A')}
                                            <button className="pfin-del" title="Delete this day" onClick={(e) => { e.stopPropagation(); deleteRow(entry.id); }}><Trash2 size={13} /></button>
                                          </>
                                        ) : (
                                          <span style={{ gridColumn: '3 / -1', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'right' }}>No entry — tap to add</span>
                                        )}
                                      </div>

                                      {/* Expanded editor (bound to the shared draft buffer) */}
                                      <Collapse open={dayOpen}>
                                        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
                                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', margin: '12px 0' }}>
                                            <div style={{ width: 150 }}>
                                              <label style={lbl}>Income</label>
                                              <input className="pfin-input" type="number" inputMode="decimal" placeholder="0" value={draft.income} onChange={e => setDraft(d => ({ ...d, income: e.target.value }))} onBlur={commit} />
                                            </div>
                                            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                                              {fmtNice(ds)}
                                            </div>
                                          </div>
                                          <label style={lbl}>Expenses — what was spent</label>
                                          {itemsEditor(draft.items, (next) => setDraft(d => ({ ...d, items: next })), (nextItems) => saveDay(ds, { ...draft, items: nextItems }))}
                                          <label style={{ ...lbl, marginTop: 12 }}>Note</label>
                                          <input className="pfin-input" type="text" placeholder="Optional note…" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} onBlur={commit} />
                                        </div>
                                      </Collapse>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </Collapse>
                        </div>
                      );
                    })}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .pfin-input {
          width: 100%; height: 34px; padding: 0 10px; border-radius: 9px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .15s;
          font-variant-numeric: tabular-nums;
        }
        .pfin-input::placeholder { color: var(--color-text-tertiary); }
        .pfin-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); transform: translateY(-1px); }
        .pfin-save {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 18px; border-radius: 10px; border: none;
          background: linear-gradient(135deg,#16a34a,#22C55E); color: #fff; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: transform .15s, box-shadow .15s;
        }
        .pfin-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(34,197,94,0.3); }
        .pfin-save:active:not(:disabled) { transform: translateY(0) scale(.97); }
        .pfin-save:disabled { opacity: .5; cursor: not-allowed; }
        .pfin-newbtn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          height: 46px; margin-bottom: 22px; border-radius: 12px; cursor: pointer; font-family: inherit;
          font-size: 13.5px; font-weight: 700; color: #22C55E;
          background: rgba(34,197,94,0.08); border: 1px dashed rgba(34,197,94,0.45); transition: .15s;
        }
        .pfin-newbtn:hover { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.7); transform: translateY(-1px); }
        .pfin-newbtn:active { transform: translateY(0) scale(.985); }
        .pfin-cancel {
          height: 38px; padding: 0 16px; border-radius: 10px; cursor: pointer; font-family: inherit;
          font-size: 13px; font-weight: 600; color: var(--color-text-secondary);
          background: transparent; border: 1px solid var(--color-border); transition: .15s;
        }
        .pfin-cancel:hover { border-color: var(--color-border-active); color: var(--color-text-primary); }
        .pfin-additem {
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 8px;
          background: transparent; border: 1px dashed var(--color-border); color: var(--color-text-secondary);
          font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; transition: .15s;
        }
        .pfin-additem:hover { border-color: var(--color-border-active); color: var(--color-text-primary); transform: translateY(-1px); }
        .pfin-chip {
          padding: 5px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
          border: 1px solid; cursor: pointer; font-family: inherit; transition: transform .12s, background .15s;
        }
        .pfin-chip:hover { transform: translateY(-1px) scale(1.02); }
        .pfin-chip:active { transform: translateY(0) scale(.96); }
        .pfin-pill {
          border: 1px solid; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; text-transform: capitalize; font-family: inherit; transition: transform .12s, background .15s, border-color .15s;
        }
        .pfin-pill:hover { transform: translateY(-1px); }
        .pfin-pill:active { transform: translateY(0) scale(.96); }
        .pfin-tile { transition: transform .18s, box-shadow .18s; }
        .pfin-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.18); }
        .pfin-icon-badge { animation: pfinIconPulse 3.2s ease-in-out infinite; }
        .pfin-month {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 15px 18px; border-radius: 16px; cursor: pointer; font-family: inherit; text-align: left;
          background: linear-gradient(135deg, rgba(48,108,236,0.14), rgba(48,108,236,0.04) 75%);
          border: 1px solid rgba(91,155,255,0.30); border-left: 4px solid #5B9BFF;
          color: var(--color-text-secondary); transition: .15s;
        }
        .pfin-month:hover { border-color: rgba(91,155,255,0.55); transform: translateY(-1px); }
        .pfin-month-title { font-size: 15.5px; font-weight: 800; color: var(--color-text-primary); letter-spacing: -.01em; }
        .pfin-month-sub { font-size: 11px; color: var(--color-text-tertiary); margin-left: 2px; }
        .pfin-month-body {
          display: flex; flex-direction: column; gap: 12px; padding-top: 10px;
          padding-left: 17px; margin-left: 9px; border-left: 2px solid rgba(91,155,255,0.22);
        }
        .pfin-weekhead {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; border-radius: 11px; cursor: pointer; font-family: inherit; text-align: left;
          background: rgba(245,166,35,0.07); border: 1px solid rgba(245,166,35,0.25); border-left: 3px solid #F5A623;
          color: var(--color-text-secondary); transition: .15s;
        }
        .pfin-weekhead:hover { border-color: rgba(245,166,35,0.55); transform: translateY(-1px); }
        .pfin-week-title { font-size: 13px; font-weight: 800; color: var(--color-text-primary); }
        .pfin-week-sub { font-size: 10.5px; color: var(--color-text-tertiary); margin-left: 2px; }
        .pfin-week-body {
          display: flex; flex-direction: column; gap: 10px; padding-top: 8px;
          padding-left: 15px; margin-left: 7px; border-left: 2px solid rgba(245,166,35,0.20);
        }
        .pfin-daylist {
          border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: var(--color-bg-secondary);
        }
        .pfin-dayrow-div { border-bottom: 1px solid var(--color-border-subtle); }
        .pfin-del {
          width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); display: flex; align-items: center; justify-content: center; transition: .15s; flex-shrink: 0;
        }
        .pfin-del:hover { color: #E0485A; background: rgba(224,72,90,0.1); transform: scale(1.08); }
        .pfin-chevron { transition: transform .25s cubic-bezier(.22,1,.36,1); flex-shrink: 0; }
        .pfin-bar { transition: width .6s cubic-bezier(.22,1,.36,1); }
        .pfin-empty-icon {
          width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
          background: rgba(34,197,94,0.12); color: #22C55E; animation: pfinBob 2.6s ease-in-out infinite;
        }

        .pfin-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.22,1,.36,1); }
        .pfin-collapse-open { grid-template-rows: 1fr; }
        .pfin-collapse-inner { overflow: hidden; min-height: 0; }

        .pfin-fadeup { animation: pfinFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
        .pfin-pop { animation: pfinPop .28s cubic-bezier(.22,1,.36,1) both; }
        .pfin-spin { animation: pfinSpin .8s linear infinite; }

        @keyframes pfinFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pfinPop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pfinSpin { to { transform: rotate(360deg); } }
        @keyframes pfinIconPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes pfinBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

        @media (prefers-reduced-motion: reduce) {
          .pfin-fadeup, .pfin-pop, .pfin-icon-badge, .pfin-empty-icon, .pfin-spin { animation: none; }
          .pfin-collapse, .pfin-chevron, .pfin-bar, .pfin-tile, .pfin-month, .pfin-weekhead, .pfin-input, .pfin-save, .pfin-newbtn { transition: none; }
        }
      `}</style>
    </div>
  );
}
