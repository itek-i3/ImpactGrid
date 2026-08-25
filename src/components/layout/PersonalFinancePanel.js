'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import {
  PiggyBank, Plus, Trash2, TrendingUp, TrendingDown, Sigma, X,
  Loader2, Sparkles, ChevronLeft, ChevronRight, AlertTriangle, Wallet,
  Receipt, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const parseDay = (dateStr) => new Date(`${dateStr}T00:00:00`);
const fmtNice = (dateStr) => {
  const d = parseDay(dateStr);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};
const fmtShort = (dateStr) => {
  const d = parseDay(dateStr);
  return `${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};
const monthKeyOf = (dateStr) => (dateStr || '').slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = (key || '').split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const pad2 = (n) => String(n).padStart(2, '0');
const addMonthsToKey = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const EXPENSE_CATEGORIES = ['Rent / Mortgage', 'Groceries', 'Transport', 'Utilities', 'Subscriptions', 'Entertainment', 'Health', 'Debt Repayment', 'Savings', 'Shopping', 'Education', 'Miscellaneous'];
const INCOME_SOURCES = ['Salary', 'Business', 'Freelance', 'Side Hustle', 'Investments', 'Rental', 'Gift', 'Other'];
const CATEGORY_PALETTE = ['#E0485A', '#F97316', '#F5A623', '#EAB308', '#84CC16', '#EC4899', '#5B9BFF', '#0EA5E9', '#14B8A6', '#F472B6', '#A78BFA', '#94A3B8'];
const EMPTY_LINE = { label: '', amount: '' };

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

// Loads + realtime-subscribes one of the three personal-finance tables, with
// a localStorage-backed mirror for demo mode. Called once per table — same
// hook, same order, every render, so the Rules of Hooks stay satisfied.
function useLiveTable(table, demoKey, currentUserId, isDemo, orderCol) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(demoKey) : null;
        if (!cancelled) { setRows(raw ? JSON.parse(raw) : []); setLoading(false); }
        return;
      }
      if (!currentUserId) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      const { data, error } = await createClient()
        .from(table).select('*').eq('user_id', currentUserId)
        .order(orderCol, { ascending: false }).order('created_at', { ascending: false });
      if (error) console.error(`[personal-finance] ${table} load failed —`, error.message, '| code:', error.code);
      if (!cancelled) { setRows(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !currentUserId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`${table}:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${currentUserId}` }, () => {
        const el = typeof document !== 'undefined' ? document.activeElement : null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        load();
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [table, demoKey, currentUserId, isDemo, orderCol]);

  const persistDemo = (next) => { setRows(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  return { rows, setRows, loading, persistDemo };
}

export default function PersonalFinancePanel() {
  const { userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const currentMonthKey = today.slice(0, 7);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);

  const incomeState = useLiveTable('personal_income', 'demo-personal-income', currentUserId, isDemo, 'entry_date');
  const expenseState = useLiveTable('personal_expenses', 'demo-personal-expenses', currentUserId, isDemo, 'entry_date');
  const budgetState = useLiveTable('personal_budgets', 'demo-personal-budgets', currentUserId, isDemo, 'month_key');
  const loading = incomeState.loading || expenseState.loading || budgetState.loading;

  const [showAdd, setShowAdd] = useState(false);
  const [nDate, setNDate] = useState(today);
  const [nIncomeItems, setNIncomeItems] = useState([{ ...EMPTY_LINE }]);
  const [nExpenseItems, setNExpenseItems] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});
  const [pendingCategories, setPendingCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const dateInputRef = useRef(null);

  // Reset per-month editing state during render (not in an Effect) when the
  // selected month changes — the React-recommended way to adjust state in
  // response to a prop/derived-value change without an extra render pass.
  const [draftMonthKey, setDraftMonthKey] = useState(selectedMonthKey);
  if (draftMonthKey !== selectedMonthKey) {
    setDraftMonthKey(selectedMonthKey);
    setBudgetDraft({});
    setPendingCategories([]);
  }

  useEffect(() => {
    if (showAdd) { const t = setTimeout(() => dateInputRef.current?.focus(), 60); return () => clearTimeout(t); }
  }, [showAdd]);

  // ---- Insert / delete helpers shared across the three tables ----
  const insertRow = async (table, state, base) => {
    if (isDemo) { state.persistDemo([{ ...base, id: crypto.randomUUID(), user_id: currentUserId, created_at: new Date().toISOString() }, ...state.rows]); return true; }
    if (!currentUserId) return false;
    try {
      const { data, error } = await createClient().from(table).insert({ ...base, user_id: currentUserId }).select('*').maybeSingle();
      if (error) { console.error(`[personal-finance] ${table} insert failed —`, error.message, '| code:', error.code); toast.error('Could not save', error.message); return false; }
      if (data) state.setRows(prev => (prev.some(r => r.id === data.id) ? prev : [data, ...prev]));
      return true;
    } catch (err) { console.error(`[personal-finance] ${table} insert threw:`, err); toast.error('Could not save', 'Something went wrong.'); return false; }
  };

  const deleteRow = async (table, state, id) => {
    if (isDemo) { state.persistDemo(state.rows.filter(r => r.id !== id)); toast.success('Deleted'); return; }
    state.setRows(prev => prev.filter(r => r.id !== id));
    try {
      const { error } = await createClient().from(table).delete().eq('id', id);
      if (error) { console.error(`[personal-finance] ${table} delete failed —`, error.message, '| code:', error.code); toast.error('Could not delete', error.message); return; }
      toast.success('Deleted');
    } catch (err) { console.error(`[personal-finance] ${table} delete threw:`, err); toast.error('Could not delete', 'Something went wrong.'); }
  };

  const saveBudget = async (category, amountRaw) => {
    const amt = num(amountRaw);
    const existing = budgetState.rows.find(r => r.month_key === selectedMonthKey && r.category === category);
    if (!existing && amt <= 0) return true;
    if (isDemo) {
      const next = existing
        ? budgetState.rows.map(r => (r.id === existing.id ? { ...r, amount: amt } : r))
        : [{ id: crypto.randomUUID(), user_id: currentUserId, month_key: selectedMonthKey, category, amount: amt, created_at: new Date().toISOString() }, ...budgetState.rows];
      budgetState.persistDemo(next);
      return true;
    }
    if (!currentUserId) return false;
    if (existing) {
      budgetState.setRows(prev => prev.map(r => (r.id === existing.id ? { ...r, amount: amt } : r)));
      const { error } = await createClient().from('personal_budgets').update({ amount: amt, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) { console.error('[personal-finance] budget update failed —', error.message); toast.error('Could not save budget', error.message); return false; }
      return true;
    }
    try {
      const { data, error } = await createClient().from('personal_budgets')
        .insert({ user_id: currentUserId, month_key: selectedMonthKey, category, amount: amt }).select('*').maybeSingle();
      if (error) { console.error('[personal-finance] budget insert failed —', error.message); toast.error('Could not save budget', error.message); return false; }
      if (data) budgetState.setRows(prev => [data, ...prev]);
      return true;
    } catch (err) { console.error('[personal-finance] budget insert threw:', err); toast.error('Could not save budget', 'Something went wrong.'); return false; }
  };

  // ---- Month-scoped derived data ----
  const monthBudgetMap = useMemo(() => {
    const map = new Map();
    budgetState.rows.forEach(r => { if (r.month_key === selectedMonthKey) map.set(r.category, num(r.amount)); });
    return map;
  }, [budgetState.rows, selectedMonthKey]);

  const monthIncomeRows = useMemo(() => incomeState.rows
    .filter(r => monthKeyOf(r.entry_date) === selectedMonthKey)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0)), [incomeState.rows, selectedMonthKey]);

  const monthExpenseRows = useMemo(() => expenseState.rows
    .filter(r => monthKeyOf(r.entry_date) === selectedMonthKey)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0)), [expenseState.rows, selectedMonthKey]);

  const totalIncome = useMemo(() => monthIncomeRows.reduce((s, r) => s + num(r.amount), 0), [monthIncomeRows]);
  const totalBudget = useMemo(() => [...monthBudgetMap.values()].reduce((s, v) => s + v, 0), [monthBudgetMap]);

  const spentByCategory = useMemo(() => {
    const m = new Map();
    monthExpenseRows.forEach(r => m.set(r.category, (m.get(r.category) || 0) + num(r.amount)));
    return m;
  }, [monthExpenseRows]);
  const totalSpent = useMemo(() => [...spentByCategory.values()].reduce((s, v) => s + v, 0), [spentByCategory]);
  const remaining = totalBudget - totalSpent;

  const incomeBySource = useMemo(() => {
    const m = new Map();
    monthIncomeRows.forEach(r => m.set(r.source, (m.get(r.source) || 0) + num(r.amount)));
    return m;
  }, [monthIncomeRows]);

  const monthTransactions = useMemo(() => {
    const income = monthIncomeRows.map(r => ({ id: r.id, type: 'income', label: r.source, amount: num(r.amount), date: r.entry_date }));
    const expense = monthExpenseRows.map(r => ({ id: r.id, type: 'expense', label: r.category, amount: num(r.amount), date: r.entry_date }));
    return [...income, ...expense].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [monthIncomeRows, monthExpenseRows]);

  const budgetCategoryList = useMemo(() => {
    const custom = new Set();
    monthBudgetMap.forEach((_, cat) => { if (!EXPENSE_CATEGORIES.includes(cat)) custom.add(cat); });
    spentByCategory.forEach((_, cat) => { if (!EXPENSE_CATEGORIES.includes(cat)) custom.add(cat); });
    pendingCategories.forEach(cat => { if (!EXPENSE_CATEGORIES.includes(cat)) custom.add(cat); });
    return [...EXPENSE_CATEGORIES, ...[...custom].sort()];
  }, [monthBudgetMap, spentByCategory, pendingCategories]);

  const categoryStatus = useMemo(() => budgetCategoryList.map((cat, i) => {
    const budget = monthBudgetMap.get(cat) || 0;
    const spent = spentByCategory.get(cat) || 0;
    const over = budget > 0 ? Math.max(0, spent - budget) : 0;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    return { category: cat, budget, spent, over, pct, color };
  }), [budgetCategoryList, monthBudgetMap, spentByCategory]);

  const overBudgetCategories = useMemo(() => categoryStatus.filter(c => c.over > 0).sort((a, b) => b.over - a.over), [categoryStatus]);
  const overallOver = totalBudget > 0 ? Math.max(0, totalSpent - totalBudget) : 0;

  const prevMonthKey = addMonthsToKey(selectedMonthKey, -1);
  const prevMonthBudgets = useMemo(() => budgetState.rows.filter(r => r.month_key === prevMonthKey && num(r.amount) > 0), [budgetState.rows, prevMonthKey]);

  const copyPrevBudget = async () => {
    let copied = 0;
    for (const r of prevMonthBudgets) { if (await saveBudget(r.category, r.amount)) copied += 1; }
    if (copied === 0) return; // each failure already toasted its own error
    toast.success('Budget copied', `Copied ${copied} categor${copied !== 1 ? 'ies' : 'y'} from ${monthLabel(prevMonthKey)}.`);
  };

  // Reminder — fires a toast the moment a category (or the month overall)
  // crosses into over-budget, and again on page load if it's already over.
  // Switching months just resyncs the baseline silently, no toast.
  const lastMonthRef = useRef(selectedMonthKey);
  const prevOverRef = useRef(new Map());
  const prevOverallRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (lastMonthRef.current !== selectedMonthKey) {
      lastMonthRef.current = selectedMonthKey;
      prevOverRef.current = new Map(overBudgetCategories.map(c => [c.category, c.over]));
      prevOverallRef.current = overallOver > 0;
      return;
    }
    const prev = prevOverRef.current;
    const worsened = overBudgetCategories.find(c => !prev.has(c.category) || c.over > prev.get(c.category) + 0.5);
    if (worsened) {
      toast.warning('Over budget', `${worsened.category} is now ${money(worsened.over)} over its ${money(worsened.budget)} budget for ${monthLabel(selectedMonthKey)}.`);
    } else if (overallOver > 0 && !prevOverallRef.current) {
      toast.warning('Over budget', `You've spent ${money(totalSpent)} against a ${money(totalBudget)} budget for ${monthLabel(selectedMonthKey)} — ${money(overallOver)} over.`);
    }
    prevOverRef.current = new Map(overBudgetCategories.map(c => [c.category, c.over]));
    prevOverallRef.current = overallOver > 0;
  }, [overBudgetCategories, overallOver, selectedMonthKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanLines = (items) => items.filter(it => it.label.trim() && num(it.amount) > 0).map(it => ({ label: it.label.trim(), amount: num(it.amount) }));
  const canAdd = cleanLines(nIncomeItems).length > 0 || cleanLines(nExpenseItems).length > 0;

  const saveEntry = async () => {
    const incomeLines = cleanLines(nIncomeItems);
    const expenseLines = cleanLines(nExpenseItems);
    if (incomeLines.length === 0 && expenseLines.length === 0) return;
    if (!isDemo && !currentUserId) return;
    setSaving(true);
    const date = nDate || today;
    const results = await Promise.all([
      ...incomeLines.map(l => insertRow('personal_income', incomeState, { entry_date: date, source: l.label, amount: l.amount })),
      ...expenseLines.map(l => insertRow('personal_expenses', expenseState, { entry_date: date, category: l.label, amount: l.amount })),
    ]);
    setSaving(false);
    if (results.every(ok => !ok)) return; // nothing saved — leave the form as-is, each failure already toasted
    setNIncomeItems([{ ...EMPTY_LINE }]); setNExpenseItems([{ ...EMPTY_LINE }]); setNDate(today); setShowAdd(false);
    setSelectedMonthKey(monthKeyOf(date));
    if (results.every(ok => ok)) toast.success('Entry logged', fmtNice(date));
  };

  const incomeDisplay = useCountUp(totalIncome);
  const budgetDisplay = useCountUp(totalBudget);
  const spentDisplay = useCountUp(totalSpent);
  const remainingDisplay = useCountUp(remaining);

  const remainingColor = (n) => (n > 0 ? '#22C55E' : n < 0 ? '#E0485A' : 'var(--color-text-tertiary)');

  const lineEditor = (items, setItems, chipOptions) => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    const quickFill = (val) => {
      const idx = items.findIndex(it => !it.label.trim());
      const next = idx !== -1 ? items.map((it, i) => (i === idx ? { ...it, label: val } : it)) : [...items, { label: val, amount: '' }];
      setItems(next);
    };
    return (
      <div className="pfin-formgroup">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chipOptions.map((opt, i) => {
            const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
            return (
              <button key={opt} type="button" className="pfin-chip"
                style={{ color, background: hexToRgba(color, 0.12), borderColor: hexToRgba(color, 0.4) }}
                onClick={() => quickFill(opt)}
                onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(color, 0.22); }}
                onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(color, 0.12); }}>
                {opt}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} className="pfin-item-row" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 28px', gap: 8, alignItems: 'center' }}>
              <input className="pfin-input" type="text" placeholder="Label" value={it.label} onChange={e => change(i, { label: e.target.value })} />
              <input className="pfin-input" type="number" inputMode="decimal" placeholder="Amount" value={it.amount} onChange={e => change(i, { amount: e.target.value })} />
              <button className="pfin-del" title="Remove line"
                onClick={() => { const next = items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_LINE }]; setItems(next); }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button className="pfin-additem" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([...items, { ...EMPTY_LINE }])}><Plus size={13} /> Add line</button>
      </div>
    );
  };

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' }}>
      {/* Header */}
      <div className="pfin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div className="pfin-icon-badge" style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
          <PiggyBank size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Personal Finance</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Allocate a monthly budget, track where your income comes from, and get warned the moment you overspend — private to you</div>
        </div>
      </div>

      {/* Month switcher */}
      <div className="pfin-fadeup pfin-monthnav" style={{ animationDelay: '40ms' }}>
        <button className="pfin-monthnav-btn" onClick={() => setSelectedMonthKey(k => addMonthsToKey(k, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="pfin-monthnav-label">{monthLabel(selectedMonthKey)}</div>
          {selectedMonthKey !== currentMonthKey && (
            <button className="pfin-monthnav-jump" onClick={() => setSelectedMonthKey(currentMonthKey)}>Jump to this month</button>
          )}
        </div>
        <button className="pfin-monthnav-btn" onClick={() => setSelectedMonthKey(k => addMonthsToKey(k, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>

      {/* Over-budget reminder banner */}
      {(overBudgetCategories.length > 0 || overallOver > 0) && (
        <div className="pfin-fadeup pfin-banner" style={{ animationDelay: '60ms' }}>
          <div className="pfin-banner-icon"><AlertTriangle size={16} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Over budget for {monthLabel(selectedMonthKey)}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {overBudgetCategories.length > 0 && (
                <span>{overBudgetCategories.map(c => `${c.category} (+${money(c.over)})`).join(' · ')}</span>
              )}
              {overallOver > 0 && <span>{overBudgetCategories.length > 0 ? ' — ' : ''}Overall {money(overallOver)} over your {money(totalBudget)} budget.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom: 18 }}>
        {[
          { label: 'Income', value: incomeDisplay, Icon: TrendingUp, tint: '#22C55E' },
          { label: 'Budget', value: budgetDisplay, Icon: Wallet, tint: '#5B9BFF' },
          { label: 'Spent', value: spentDisplay, Icon: TrendingDown, tint: '#E0485A' },
          { label: 'Remaining', value: remainingDisplay, Icon: Sigma, tint: remainingColor(remaining) },
        ].map(({ label, value, Icon, tint }, i) => (
          <div key={label} className="pfin-tile pfin-fadeup" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, animationDelay: `${i * 50 + 80}ms`, borderLeft: label === 'Remaining' ? `3px solid ${tint}` : card.border }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${tint}20`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(value)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 30 }}>
          <Loader2 size={16} className="pfin-spin" /> Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Budget allocation */}
          <div className="pfin-fadeup" style={{ ...card, animationDelay: '220ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={16} /></div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Budget allocation</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Total <strong style={{ color: 'var(--color-text-primary)' }}>{money(totalBudget)}</strong></span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>Set what you plan to spend per category this month — the bar fills as you spend, and turns red once you go over.</div>

            {totalBudget === 0 && prevMonthBudgets.length > 0 && (
              <button className="pfin-additem" style={{ marginBottom: 12 }} onClick={copyPrevBudget}>
                <Sparkles size={13} /> Copy budget from {monthLabel(prevMonthKey)}
              </button>
            )}

            <div className="pfin-budgetgrid">
              {categoryStatus.map((c) => {
                const value = budgetDraft[c.category] ?? (monthBudgetMap.get(c.category) ? String(monthBudgetMap.get(c.category)) : '');
                const barColor = c.over > 0 ? '#E0485A' : c.pct >= 80 ? '#F5A623' : c.color;
                return (
                  <div key={c.category} className="pfin-budgetrow">
                    <div className="pfin-budgetrow-top">
                      <span className="pfin-budgetrow-dot" style={{ background: c.color }} />
                      <span className="pfin-budgetrow-label">{c.category}</span>
                      <span className="pfin-budgetrow-spent" style={{ color: c.over > 0 ? '#E0485A' : 'var(--color-text-secondary)' }}>
                        {c.spent > 0 ? `${money(c.spent)} spent` : 'Nothing spent yet'}
                      </span>
                    </div>
                    <div className="pfin-budgetrow-bottom">
                      <div className="pfin-budgetrow-bar">
                        <div className="pfin-bar" style={{ width: `${c.budget > 0 ? Math.max(c.pct, c.spent > 0 ? 3 : 0) : 0}%`, height: '100%', borderRadius: 6, background: barColor }} />
                      </div>
                      <input className="pfin-input pfin-budgetrow-input" type="number" inputMode="decimal" placeholder="Budget"
                        value={value}
                        onChange={e => setBudgetDraft(d => ({ ...d, [c.category]: e.target.value }))}
                        onBlur={e => { saveBudget(c.category, e.target.value); setBudgetDraft(d => { const n = { ...d }; delete n[c.category]; return n; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input className="pfin-input" style={{ maxWidth: 220 }} type="text" placeholder="Custom category…" value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) { setPendingCategories(p => [...p, newCatName.trim()]); setNewCatName(''); } }} />
              <button className="pfin-additem" onClick={() => { if (newCatName.trim()) { setPendingCategories(p => [...p, newCatName.trim()]); setNewCatName(''); } }}><Plus size={13} /> Add category</button>
            </div>
          </div>

          {/* Log entry */}
          {showAdd ? (
            <div className="pfin-pop" style={{ ...card, border: '1px solid rgba(34,197,94,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}><Sparkles size={15} style={{ color: '#22C55E' }} /> Log entry</span>
                <button className="pfin-del" title="Close" onClick={() => setShowAdd(false)}><X size={16} /></button>
              </div>
              <div style={{ width: 160, marginBottom: 14 }}>
                <label style={lbl}>Date</label>
                <input ref={dateInputRef} className="pfin-input" type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{fmtNice(nDate)}</div>
              </div>
              <label style={lbl}>Income — where it came from</label>
              {lineEditor(nIncomeItems, setNIncomeItems, INCOME_SOURCES)}
              <label style={{ ...lbl, marginTop: 16 }}>Expenses — what was spent</label>
              {lineEditor(nExpenseItems, setNExpenseItems, EXPENSE_CATEGORIES)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="pfin-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="pfin-save" onClick={saveEntry} disabled={!canAdd || saving}>
                  {saving ? <Loader2 size={15} className="pfin-spin" /> : <Plus size={15} />} {saving ? 'Saving…' : 'Save entry'}
                </button>
              </div>
            </div>
          ) : (
            <button className="pfin-newbtn" onClick={() => setShowAdd(true)}><Plus size={16} /> Log entry</button>
          )}

          {/* Transactions this month */}
          <div className="pfin-fadeup" style={{ ...card, animationDelay: '300ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Receipt size={16} /></div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Transactions this month</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {chip(`+${money(totalIncome)}`, '#22C55E')}
                {chip(`−${money(totalSpent)}`, '#E0485A')}
              </span>
            </div>

            {incomeBySource.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--color-border-subtle)' }}>
                {[...incomeBySource.entries()].filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1]).map(([source, amt]) => (
                  <span key={source} className="pfin-sourcechip">{source} <strong>{money(amt)}</strong></span>
                ))}
              </div>
            )}

            {monthTransactions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>No transactions logged for {monthLabel(selectedMonthKey)} yet.</div>
            ) : (
              <div className="pfin-entrylist">
                {monthTransactions.map(t => (
                  <div key={`${t.type}-${t.id}`} className="pfin-txnrow">
                    <div className={t.type === 'income' ? 'pfin-txnicon pfin-txnicon-in' : 'pfin-txnicon pfin-txnicon-out'}>
                      {t.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    </div>
                    <div className="pfin-txnmeta">
                      <span className="pfin-txnlabel">{t.label}</span>
                      <span className="pfin-txndate">{fmtShort(t.date)}</span>
                    </div>
                    <span className={t.type === 'income' ? 'pfin-txnamount pfin-txnamount-in' : 'pfin-txnamount pfin-txnamount-out'}>
                      {t.type === 'income' ? '+' : '−'}{money(t.amount)}
                    </span>
                    <button className="pfin-del" title="Delete"
                      onClick={() => deleteRow(t.type === 'income' ? 'personal_income' : 'personal_expenses', t.type === 'income' ? incomeState : expenseState, t.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          height: 46px; border-radius: 12px; cursor: pointer; font-family: inherit;
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
        .pfin-tile { transition: transform .18s, box-shadow .18s; }
        .pfin-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.18); }
        .pfin-icon-badge { animation: pfinIconPulse 3.2s ease-in-out infinite; }
        .pfin-del {
          width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); display: flex; align-items: center; justify-content: center; transition: .15s; flex-shrink: 0;
        }
        .pfin-del:hover { color: #E0485A; background: rgba(224,72,90,0.1); transform: scale(1.08); }
        .pfin-bar { transition: width .6s cubic-bezier(.22,1,.36,1); }

        .pfin-monthnav {
          display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0 auto 14px;
          width: fit-content; padding: 6px; border-radius: 999px;
          background: var(--color-bg-elevated); border: 1px solid var(--color-border);
        }
        .pfin-monthnav-btn {
          width: 30px; height: 30px; border-radius: 50%; border: none; background: transparent;
          color: var(--color-text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: .15s; flex-shrink: 0;
        }
        .pfin-monthnav-btn:hover { background: rgba(91,155,255,0.14); color: #5B9BFF; }
        .pfin-monthnav-label { font-size: 15px; font-weight: 800; color: var(--color-text-primary); letter-spacing: -.01em; min-width: 150px; }
        .pfin-monthnav-jump {
          background: none; border: none; cursor: pointer; color: #5B9BFF; font-size: 11px; font-weight: 700;
          font-family: inherit; padding: 2px 0; margin-top: 1px;
        }
        .pfin-monthnav-jump:hover { text-decoration: underline; }

        .pfin-banner {
          display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; margin-bottom: 18px;
          background: rgba(224,72,90,0.10); border: 1px solid rgba(224,72,90,0.35); color: #F4A6AE;
        }
        .pfin-banner-icon {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: rgba(224,72,90,0.18); color: #E0485A;
          display: flex; align-items: center; justify-content: center;
        }

        .pfin-budgetgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (max-width: 560px) {
          .pfin-budgetgrid { grid-template-columns: 1fr; }
        }
        .pfin-budgetrow {
          display: flex; flex-direction: column; gap: 8px; padding: 12px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle); border-radius: 12px;
        }
        .pfin-budgetrow-top { display: flex; align-items: center; gap: 8px; }
        .pfin-budgetrow-dot { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
        .pfin-budgetrow-label { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pfin-budgetrow-spent { flex-shrink: 0; font-size: 11px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--color-text-tertiary); }
        .pfin-budgetrow-bottom { display: flex; align-items: center; gap: 10px; }
        .pfin-budgetrow-bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .pfin-budgetrow-input { width: 88px; flex-shrink: 0; height: 30px; text-align: right; }

        .pfin-formgroup {
          display: flex; flex-direction: column; gap: 8px; padding: 12px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle); border-radius: 12px;
        }

        .pfin-sourcechip {
          padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
          color: var(--color-text-secondary); background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle);
        }
        .pfin-sourcechip strong { color: var(--color-text-primary); font-weight: 700; margin-left: 4px; }

        .pfin-entrylist { display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto; }
        .pfin-txnrow {
          display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-radius: 8px; transition: background .15s;
        }
        .pfin-txnrow:hover { background: rgba(255,255,255,0.03); }
        .pfin-txnicon {
          width: 30px; height: 30px; border-radius: 999px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .pfin-txnicon-in { background: rgba(34,197,94,0.16); color: #22C55E; }
        .pfin-txnicon-out { background: rgba(224,72,90,0.16); color: #E0485A; }
        .pfin-txnmeta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .pfin-txnlabel { font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pfin-txndate { font-size: 10.5px; color: var(--color-text-tertiary); }
        .pfin-txnamount { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; }
        .pfin-txnamount-in { color: #22C55E; }
        .pfin-txnamount-out { color: #E0485A; }

        .pfin-fadeup { animation: pfinFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
        .pfin-pop { animation: pfinPop .28s cubic-bezier(.22,1,.36,1) both; }
        .pfin-spin { animation: pfinSpin .8s linear infinite; }

        @keyframes pfinFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pfinPop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pfinSpin { to { transform: rotate(360deg); } }
        @keyframes pfinIconPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

        @media (prefers-reduced-motion: reduce) {
          .pfin-fadeup, .pfin-pop, .pfin-icon-badge, .pfin-spin { animation: none; }
          .pfin-bar, .pfin-tile, .pfin-input, .pfin-save, .pfin-newbtn, .pfin-monthnav-btn { transition: none; }
        }
      `}</style>
    </div>
  );
}
