'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import {
  PiggyBank, Plus, Trash2, TrendingUp, TrendingDown, X,
  Loader2, Sparkles, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Wallet,
  Receipt, ArrowUpRight, ArrowDownRight, Pencil, Check, PieChart, Repeat, Target,
  BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import GoalsSavingsPanel from '@/components/layout/GoalsSavingsPanel';
import {
  money, num, hexToRgba, monthKeyOf, monthLabel, pad2, addMonthsToKey,
  useLiveTable, useCountUp, RadialProgress,
  insertRow as insertRowShared, deleteRow as deleteRowShared, updateRow as updateRowShared,
} from '@/lib/personalFinance/shared';

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

// Resolves each budget category's effective amount for `monthKey`: an exact
// row for that month wins outright (even a $0 row — that's how a "stop
// recurring" marker renders); otherwise the most recent earlier row marked
// `recurring` carries its amount forward, so a category set-and-forget once
// keeps applying to every later month until an explicit row overrides it.
// Returns a plain array (not a Map) — find a category with
// `.find(x => x.category === name)`.
const resolveMonthBudgets = (rows, monthKey) => {
  const exactByCategory = new Map();
  const bestCarryByCategory = new Map();
  rows.forEach(r => {
    if (r.month_key === monthKey) { exactByCategory.set(r.category, r); return; }
    if (r.month_key < monthKey && r.recurring) {
      const prevBest = bestCarryByCategory.get(r.category);
      if (!prevBest || r.month_key > prevBest.month_key) bestCarryByCategory.set(r.category, r);
    }
  });
  const categories = new Set([...exactByCategory.keys(), ...bestCarryByCategory.keys()]);
  const out = [];
  categories.forEach(category => {
    const exact = exactByCategory.get(category);
    if (exact) {
      out.push({ category, amount: num(exact.amount), recurring: !!exact.recurring, rowId: exact.id, sourceMonthKey: monthKey, isCarried: false });
      return;
    }
    const r = bestCarryByCategory.get(category);
    out.push({ category, amount: num(r.amount), recurring: true, rowId: null, sourceMonthKey: r.month_key, isCarried: true });
  });
  return out;
};

const INCOME_SOURCES = ['Salary', 'Business', 'Freelance', 'Side Hustle', 'Investments', 'Rental', 'Gift', 'Other'];
const CATEGORY_PALETTE = ['#E0485A', '#F97316', '#F5A623', '#EAB308', '#84CC16', '#EC4899', '#5B9BFF', '#0EA5E9', '#14B8A6', '#F472B6', '#A78BFA', '#94A3B8'];
const EMPTY_LINE = { label: '', detail: '', amount: '' };

// Validated categorical palette (color-formula skill, dark-surface steps) used
// for the Insights breakdown bars — a fixed hue per income source, and a
// stable hash-to-slot assignment for user-defined expense categories, so a
// given name always renders the same color regardless of sort order or which
// other entries exist that month.
const CHART_PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_COLOR = '#6B7A99';
const hashPaletteIndex = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % CHART_PALETTE.length;
};
const sourceColorOf = (name) => {
  const idx = INCOME_SOURCES.indexOf(name);
  return idx !== -1 ? CHART_PALETTE[idx] : CHART_PALETTE[hashPaletteIndex(name)];
};
const categoryColorOf = (name) => CHART_PALETTE[hashPaletteIndex(name)];

// Groups rows by a name field into { total, details: Map(detail -> amount) },
// then folds anything past the top 7 (by total) into an "Other" bucket whose
// own "details" are the folded names — past ~7-8 categorical slots, adjacent
// colors stop being tellable apart, so the tail gets aggregated instead of a
// 9th generated hue.
const buildBreakdown = (rows, keyField) => {
  const map = new Map();
  rows.forEach(r => {
    const name = (r[keyField] || '').trim() || 'Unspecified';
    const amt = num(r.amount);
    if (!map.has(name)) map.set(name, { total: 0, details: new Map() });
    const entry = map.get(name);
    entry.total += amt;
    const d = (r.detail || '').trim();
    if (d) entry.details.set(d, (entry.details.get(d) || 0) + amt);
  });
  const arr = [...map.entries()].map(([name, v]) => ({ name, total: v.total, details: v.details })).sort((a, b) => b.total - a.total);
  const CAP = 7;
  if (arr.length <= CAP) return arr;
  const top = arr.slice(0, CAP);
  const rest = arr.slice(CAP);
  const otherTotal = rest.reduce((s, r) => s + r.total, 0);
  const otherDetails = new Map(rest.map(r => [r.name, r.total]));
  return [...top, { name: 'Other', total: otherTotal, details: otherDetails, isOther: true }];
};

const chip = (text, tint) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: `${tint}20`, color: tint, fontWeight: 800, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{text}</span>
);

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
  const incomeTargetState = useLiveTable('personal_income_targets', 'demo-personal-income-targets', currentUserId, isDemo, 'month_key');
  const loading = incomeState.loading || expenseState.loading || budgetState.loading || incomeTargetState.loading;

  const [tab, setTab] = useState('budget');
  const [addFormType, setAddFormType] = useState(null); // null | 'income' | 'expense'
  const [nDate, setNDate] = useState(today);
  const [nIncomeItems, setNIncomeItems] = useState([{ ...EMPTY_LINE }]);
  const [nExpenseItems, setNExpenseItems] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatAmount, setNewCatAmount] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', amount: '' });
  const [expandedInsight, setExpandedInsight] = useState(null);
  // Amounts are never typed directly in-place — clicking the figure opens
  // this prompt (a small modal) to enter/confirm a new value instead, so a
  // stray click or tab-away can never silently change a saved number.
  const [amountPrompt, setAmountPrompt] = useState(null); // null | { type: 'incomeTarget' } | { type: 'budget', category }
  const [amountPromptValue, setAmountPromptValue] = useState('');
  const [editingTxn, setEditingTxn] = useState(null); // { type: 'income'|'expense', id }
  const [editTxnDraft, setEditTxnDraft] = useState({ label: '', detail: '', amount: '', date: '' });
  const [insightScope, setInsightScope] = useState('month'); // 'month' | 'year'
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'line' | 'area'
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const dateInputRef = useRef(null);

  // Reset per-month editing state during render (not in an Effect) when the
  // selected month changes — the React-recommended way to adjust state in
  // response to a prop/derived-value change without an extra render pass.
  const [draftMonthKey, setDraftMonthKey] = useState(selectedMonthKey);
  if (draftMonthKey !== selectedMonthKey) {
    setDraftMonthKey(selectedMonthKey);
    setEditingCategory(null);
    setExpandedInsight(null);
    setAmountPrompt(null);
    setEditingTxn(null);
  }

  useEffect(() => {
    if (addFormType) { const t = setTimeout(() => dateInputRef.current?.focus(), 60); return () => clearTimeout(t); }
  }, [addFormType]);

  // ---- Insert / delete / update helpers shared across the tables ----
  const crudCtx = { isDemo, currentUserId, toast };
  const insertRow = (table, state, base) => insertRowShared(table, state, base, crudCtx);
  const deleteRow = (table, state, id) => deleteRowShared(table, state, id, crudCtx);
  const updateRow = (table, state, id, patch) => updateRowShared(table, state, id, patch, crudCtx);

  // Edits an existing income/expense entry in place (label, detail, amount,
  // date) instead of forcing a delete-and-relog.
  const startEditTxn = (type, r) => {
    setEditingTxn({ type, id: r.id });
    setEditTxnDraft({ label: type === 'income' ? r.source : r.category, detail: r.detail || '', amount: String(r.amount), date: r.entry_date });
  };

  const commitEditTxn = async () => {
    if (!editingTxn) return;
    const { type, id } = editingTxn;
    const label = editTxnDraft.label.trim();
    if (!label) return;
    const table = type === 'income' ? 'personal_income' : 'personal_expenses';
    const state = type === 'income' ? incomeState : expenseState;
    const labelField = type === 'income' ? 'source' : 'category';
    const patch = { [labelField]: label, detail: editTxnDraft.detail.trim() || null, amount: num(editTxnDraft.amount), entry_date: editTxnDraft.date || today };
    const ok = await updateRow(table, state, id, patch);
    if (ok) { setEditingTxn(null); toast.success('Updated'); }
  };

  // Upserts the exact-month row for a category with a given amount + recurring
  // flag — the one place that actually writes to personal_budgets, shared by
  // plain amount edits, the recurring toggle, and the "stop recurring" stopper.
  const upsertBudgetRow = async (category, amount, recurring) => {
    const existing = budgetState.rows.find(r => r.month_key === selectedMonthKey && r.category === category);
    if (isDemo) {
      budgetState.persistDemo(prev => {
        const match = prev.find(r => r.month_key === selectedMonthKey && r.category === category);
        return match
          ? prev.map(r => (r.id === match.id ? { ...r, amount, recurring } : r))
          : [{ id: crypto.randomUUID(), user_id: currentUserId, month_key: selectedMonthKey, category, amount, recurring, created_at: new Date().toISOString() }, ...prev];
      });
      return true;
    }
    if (!currentUserId) return false;
    if (existing) {
      budgetState.setRows(prev => prev.map(r => (r.id === existing.id ? { ...r, amount, recurring } : r)));
      const { error } = await createClient().from('personal_budgets').update({ amount, recurring, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) { console.error('[personal-finance] budget update failed —', error.message); toast.error('Could not save budget', error.message); return false; }
      return true;
    }
    try {
      const { data, error } = await createClient().from('personal_budgets')
        .insert({ user_id: currentUserId, month_key: selectedMonthKey, category, amount, recurring }).select('*').maybeSingle();
      if (error) { console.error('[personal-finance] budget insert failed —', error.message); toast.error('Could not save budget', error.message); return false; }
      if (data) budgetState.setRows(prev => [data, ...prev]);
      return true;
    } catch (err) { console.error('[personal-finance] budget insert threw:', err); toast.error('Could not save budget', 'Something went wrong.'); return false; }
  };

  // recurringOverride stays null for every plain amount edit, which preserves
  // whatever recurring flag this category already resolved to for the viewed
  // month — so tweaking the number never silently cancels a recurring budget.
  // Passing an explicit boolean (from the "repeat monthly" toggle) freezes the
  // currently-resolved amount into an exact row for this month with the new
  // flag, which is how both turning recurrence on and off take effect.
  const saveBudget = async (category, amountRaw, recurringOverride = null) => {
    const amt = num(amountRaw);
    const existing = budgetState.rows.find(r => r.month_key === selectedMonthKey && r.category === category);
    const resolved = monthBudgetResolved.find(x => x.category === category);
    if (!existing && recurringOverride === null && resolved && amt === resolved.amount) return true;
    if (!existing && !resolved && amt <= 0) return true;
    const recurring = recurringOverride !== null ? recurringOverride : (resolved?.recurring ?? false);
    return upsertBudgetRow(category, amt, recurring);
  };

  // A single monthly income goal (not per-source, unlike budgets) — tracks
  // progress the same way budget-vs-spend does, just in the other direction.
  const saveIncomeTarget = async (amountRaw) => {
    const amt = num(amountRaw);
    const existing = incomeTargetState.rows.find(r => r.month_key === selectedMonthKey);
    if (!existing && amt <= 0) return true;
    if (isDemo) {
      incomeTargetState.persistDemo(prev => {
        const match = prev.find(r => r.month_key === selectedMonthKey);
        return match
          ? prev.map(r => (r.id === match.id ? { ...r, target_amount: amt } : r))
          : [{ id: crypto.randomUUID(), user_id: currentUserId, month_key: selectedMonthKey, target_amount: amt, created_at: new Date().toISOString() }, ...prev];
      });
      return true;
    }
    if (!currentUserId) return false;
    if (existing) {
      incomeTargetState.setRows(prev => prev.map(r => (r.id === existing.id ? { ...r, target_amount: amt } : r)));
      const { error } = await createClient().from('personal_income_targets').update({ target_amount: amt, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) { console.error('[personal-finance] income target update failed —', error.message); toast.error('Could not save target', error.message); return false; }
      return true;
    }
    try {
      const { data, error } = await createClient().from('personal_income_targets')
        .insert({ user_id: currentUserId, month_key: selectedMonthKey, target_amount: amt }).select('*').maybeSingle();
      if (error) { console.error('[personal-finance] income target insert failed —', error.message); toast.error('Could not save target', error.message); return false; }
      if (data) incomeTargetState.setRows(prev => [data, ...prev]);
      return true;
    } catch (err) { console.error('[personal-finance] income target insert threw:', err); toast.error('Could not save target', 'Something went wrong.'); return false; }
  };

  // Opens the amount prompt for the income target or a budget category's
  // amount — the only way either figure gets entered, so a save always
  // requires an explicit "Save" click rather than a stray blur.
  const openIncomeTargetPrompt = () => { setAmountPromptValue(monthIncomeTarget ? String(monthIncomeTarget) : ''); setAmountPrompt({ type: 'incomeTarget' }); };
  const openBudgetPrompt = (category, currentAmount) => { setAmountPromptValue(currentAmount ? String(currentAmount) : ''); setAmountPrompt({ type: 'budget', category }); };
  const closeAmountPrompt = () => { setAmountPrompt(null); setAmountPromptValue(''); };
  const confirmAmountPrompt = async () => {
    if (!amountPrompt) return;
    if (amountPrompt.type === 'incomeTarget') await saveIncomeTarget(amountPromptValue);
    else await saveBudget(amountPrompt.category, amountPromptValue);
    closeAmountPrompt();
  };

  // Adds a user-defined budget category with its name and starting amount
  // together, saved immediately so it survives a refresh.
  const addBudgetCategory = async (rawName, amountRaw) => {
    const category = rawName.trim();
    if (!category) return;
    const already = budgetState.rows.some(r => r.month_key === selectedMonthKey && r.category === category);
    if (already) { toast.error('Could not add', 'That category already exists this month.'); return; }
    await insertRow('personal_budgets', budgetState, { month_key: selectedMonthKey, category, amount: num(amountRaw) });
  };

  // Removes a budget category. If it has ever been marked recurring at or
  // before the viewed month, a hard delete wouldn't stick — an older
  // recurring row would just resurface for this month on the next resolve —
  // so instead we freeze a $0, non-recurring stopper row here to end the
  // carry-forward. Categories with no recurring history are hard-deleted,
  // same as before.
  const removeBudgetCategory = async (category) => {
    const hasRecurringHistory = budgetState.rows.some(r => r.category === category && r.recurring && r.month_key <= selectedMonthKey);
    if (hasRecurringHistory) { await upsertBudgetRow(category, 0, false); return; }
    const existing = budgetState.rows.find(r => r.month_key === selectedMonthKey && r.category === category);
    if (existing) await deleteRow('personal_budgets', budgetState, existing.id);
  };

  // Renames a category and/or updates its amount in one save, preserving
  // whatever recurring flag the category already resolved to. Renames
  // cascade to every expense already logged under the old name (any month),
  // so past spending stays attached to the category instead of orphaning.
  // Note: a rename only rewrites *this* month's row — an older row that
  // originated a recurrence stays behind under the old name, but it's inert
  // (nothing looks it up again) since this month's row, now under the new
  // name, becomes the newest recurring row any future month will resolve to.
  const editBudgetCategory = async (oldName, rawName, amountRaw) => {
    const newName = rawName.trim();
    if (!newName) return;
    const amt = num(amountRaw);
    const renamed = newName !== oldName;
    if (renamed && budgetCategoryList.includes(newName)) {
      toast.error('Could not rename', 'That category name is already in use.');
      return;
    }
    const resolvedOld = monthBudgetResolved.find(x => x.category === oldName);
    const recurring = resolvedOld?.recurring ?? false;
    const existing = budgetState.rows.find(r => r.month_key === selectedMonthKey && r.category === oldName);
    if (isDemo) {
      budgetState.persistDemo(prev => {
        const match = prev.find(r => r.month_key === selectedMonthKey && r.category === oldName);
        return match
          ? prev.map(r => (r.id === match.id ? { ...r, category: newName, amount: amt, recurring } : r))
          : [{ id: crypto.randomUUID(), user_id: currentUserId, month_key: selectedMonthKey, category: newName, amount: amt, recurring, created_at: new Date().toISOString() }, ...prev];
      });
      if (renamed) expenseState.persistDemo(prev => prev.map(r => (r.category === oldName ? { ...r, category: newName } : r)));
      return;
    }
    if (!currentUserId) return;
    try {
      if (existing) {
        budgetState.setRows(prev => prev.map(r => (r.id === existing.id ? { ...r, category: newName, amount: amt, recurring } : r)));
        const { error } = await createClient().from('personal_budgets').update({ category: newName, amount: amt, recurring, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) { console.error('[personal-finance] budget rename failed —', error.message); toast.error('Could not save', error.message); return; }
      } else {
        const { data, error } = await createClient().from('personal_budgets')
          .insert({ user_id: currentUserId, month_key: selectedMonthKey, category: newName, amount: amt, recurring }).select('*').maybeSingle();
        if (error) { console.error('[personal-finance] budget insert failed —', error.message); toast.error('Could not save', error.message); return; }
        if (data) budgetState.setRows(prev => [data, ...prev]);
      }
      if (renamed) {
        expenseState.setRows(prev => prev.map(r => (r.category === oldName ? { ...r, category: newName } : r)));
        const { error: expErr } = await createClient().from('personal_expenses')
          .update({ category: newName, updated_at: new Date().toISOString() }).eq('user_id', currentUserId).eq('category', oldName);
        if (expErr) console.error('[personal-finance] expense category rename failed —', expErr.message);
      }
    } catch (err) { console.error('[personal-finance] budget edit threw:', err); toast.error('Could not save', 'Something went wrong.'); }
  };

  // ---- Month-scoped derived data ----
  // Plain consts (not useMemo) from here through categoryStatus: the React
  // Compiler's memoization-preservation check can't trace a Map built from
  // an external function call's return value once another memo consumes it,
  // and bails out across the whole component when it can't. Budget rows are
  // few enough (personal-scale data) that recomputing each render is free.
  const monthBudgetResolved = resolveMonthBudgets(budgetState.rows, selectedMonthKey);
  const monthBudgetMap = new Map(monthBudgetResolved.map(v => [v.category, v.amount]));

  const monthIncomeRows = useMemo(() => incomeState.rows
    .filter(r => monthKeyOf(r.entry_date) === selectedMonthKey)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0)), [incomeState.rows, selectedMonthKey]);

  const monthExpenseRows = useMemo(() => expenseState.rows
    .filter(r => monthKeyOf(r.entry_date) === selectedMonthKey)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0)), [expenseState.rows, selectedMonthKey]);

  const totalIncome = useMemo(() => monthIncomeRows.reduce((s, r) => s + num(r.amount), 0), [monthIncomeRows]);
  const totalBudget = [...monthBudgetMap.values()].reduce((s, v) => s + v, 0);

  const spentByCategory = useMemo(() => {
    const m = new Map();
    monthExpenseRows.forEach(r => m.set(r.category, (m.get(r.category) || 0) + num(r.amount)));
    return m;
  }, [monthExpenseRows]);
  const totalSpent = useMemo(() => [...spentByCategory.values()].reduce((s, v) => s + v, 0), [spentByCategory]);
  const remaining = totalIncome - totalSpent;
  const budgetUsedPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const ringColor = totalBudget === 0 ? 'var(--color-text-tertiary)' : totalSpent > totalBudget ? '#E0485A' : budgetUsedPct >= 80 ? '#F5A623' : '#5B9BFF';

  const monthIncomeTarget = num(incomeTargetState.rows.find(r => r.month_key === selectedMonthKey)?.target_amount);
  const incomeTargetPct = monthIncomeTarget > 0 ? Math.round((totalIncome / monthIncomeTarget) * 100) : 0;

  const incomeBySource = useMemo(() => {
    const m = new Map();
    monthIncomeRows.forEach(r => m.set(r.source, (m.get(r.source) || 0) + num(r.amount)));
    return m;
  }, [monthIncomeRows]);

  // Insights: income-by-source and expense-by-category, each broken down
  // further into the free-text "detail" logged against that entry (e.g. a
  // specific employer or vendor under a source/category). Scoped to the
  // selected month, same as the rest of the panel.
  const incomeInsights = useMemo(() => buildBreakdown(monthIncomeRows, 'source'), [monthIncomeRows]);
  const expenseInsights = useMemo(() => buildBreakdown(monthExpenseRows, 'category'), [monthExpenseRows]);

  // Every detail ever logged, keyed by its source/category — offered as
  // datalist suggestions in Log entry so a past detail autocompletes the next
  // time you log the same source/category, without forcing a fixed sub-category list.
  const detailHistoryByLabel = useMemo(() => {
    const map = new Map();
    const collect = (rows, keyField) => rows.forEach(r => {
      const key = (r[keyField] || '').trim().toLowerCase();
      const d = (r.detail || '').trim();
      if (!key || !d) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(d);
    });
    collect(incomeState.rows, 'source');
    collect(expenseState.rows, 'category');
    return map;
  }, [incomeState.rows, expenseState.rows]);

  // 6-month income vs expense trend, ending at the selected month.
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(addMonthsToKey(selectedMonthKey, -i));
    return months.map(key => {
      const inc = incomeState.rows.filter(r => monthKeyOf(r.entry_date) === key).reduce((s, r) => s + num(r.amount), 0);
      const exp = expenseState.rows.filter(r => monthKeyOf(r.entry_date) === key).reduce((s, r) => s + num(r.amount), 0);
      const [y, m] = key.split('-');
      return { key, label: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short' }), Income: inc, Expenses: exp };
    });
  }, [incomeState.rows, expenseState.rows, selectedMonthKey]);

  // ---- Year-scoped data (Insights → "This year") ----
  const yearIncomeRows = useMemo(() => incomeState.rows.filter(r => (r.entry_date || '').slice(0, 4) === String(selectedYear)), [incomeState.rows, selectedYear]);
  const yearExpenseRows = useMemo(() => expenseState.rows.filter(r => (r.entry_date || '').slice(0, 4) === String(selectedYear)), [expenseState.rows, selectedYear]);
  const yearTotalIncome = useMemo(() => yearIncomeRows.reduce((s, r) => s + num(r.amount), 0), [yearIncomeRows]);
  const yearTotalExpense = useMemo(() => yearExpenseRows.reduce((s, r) => s + num(r.amount), 0), [yearExpenseRows]);
  const yearNet = yearTotalIncome - yearTotalExpense;
  const yearIncomeInsights = useMemo(() => buildBreakdown(yearIncomeRows, 'source'), [yearIncomeRows]);
  const yearExpenseInsights = useMemo(() => buildBreakdown(yearExpenseRows, 'category'), [yearExpenseRows]);

  // All 12 months of the selected year, Jan → Dec, income vs expense per month.
  const yearTrendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${selectedYear}-${pad2(i + 1)}`;
      const inc = incomeState.rows.filter(r => monthKeyOf(r.entry_date) === key).reduce((s, r) => s + num(r.amount), 0);
      const exp = expenseState.rows.filter(r => monthKeyOf(r.entry_date) === key).reduce((s, r) => s + num(r.amount), 0);
      return { key, label: new Date(selectedYear, i, 1).toLocaleDateString('en-GB', { month: 'short' }), Income: inc, Expenses: exp };
    });
  }, [incomeState.rows, expenseState.rows, selectedYear]);

  const monthTransactions = useMemo(() => {
    const income = monthIncomeRows.map(r => ({ id: r.id, type: 'income', label: r.source, amount: num(r.amount), date: r.entry_date }));
    const expense = monthExpenseRows.map(r => ({ id: r.id, type: 'expense', label: r.category, amount: num(r.amount), date: r.entry_date }));
    return [...income, ...expense].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [monthIncomeRows, monthExpenseRows]);

  // Budget categories are entirely user-defined — no fixed starter list, so
  // everyone builds their own criteria from a blank slate via "Add budget".
  const budgetCategoryList = (() => {
    const cats = new Set();
    monthBudgetMap.forEach((_, cat) => cats.add(cat));
    spentByCategory.forEach((_, cat) => cats.add(cat));
    return [...cats].sort();
  })();

  // Every category the user has ever created (any month, via budget or past
  // spending) — offered as a quick-fill chip in Log entry so a category you
  // added under Budget doesn't disappear when you go to log a transaction.
  const allExpenseChipOptions = useMemo(() => {
    const cats = new Set();
    budgetState.rows.forEach(r => cats.add(r.category));
    expenseState.rows.forEach(r => cats.add(r.category));
    return [...cats].sort();
  }, [budgetState.rows, expenseState.rows]);

  const categoryStatus = budgetCategoryList.map((cat, i) => {
    const budget = monthBudgetMap.get(cat) || 0;
    const spent = spentByCategory.get(cat) || 0;
    const over = budget > 0 ? Math.max(0, spent - budget) : 0;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    const r = monthBudgetResolved.find(x => x.category === cat);
    return { category: cat, budget, spent, over, pct, color, recurring: r?.recurring ?? false, isCarried: r?.isCarried ?? false, sourceMonthKey: r?.sourceMonthKey ?? null };
  });

  const overBudgetCategories = categoryStatus.filter(c => c.over > 0).sort((a, b) => b.over - a.over);
  const overallOver = totalBudget > 0 ? Math.max(0, totalSpent - totalBudget) : 0;

  // "Near" = 80%+ of a budget used but not over yet — a heads-up before the
  // over-budget alert, using the same 80% threshold the budget bars turn amber at.
  const NEAR_BUDGET_PCT = 80;
  const nearBudgetCategories = categoryStatus.filter(c => c.budget > 0 && c.over === 0 && c.pct >= NEAR_BUDGET_PCT).sort((a, b) => b.pct - a.pct);
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const overallNear = totalBudget > 0 && overallOver === 0 && overallPct >= NEAR_BUDGET_PCT;

  const prevMonthKey = addMonthsToKey(selectedMonthKey, -1);
  const prevMonthBudgets = useMemo(() => resolveMonthBudgets(budgetState.rows, prevMonthKey)
    .filter(v => v.amount > 0)
    .map(v => ({ category: v.category, amount: v.amount })), [budgetState.rows, prevMonthKey]);

  // Copies as a one-off, non-recurring snapshot — a nudge to match last
  // month, not a commitment. (Recurring categories keep carrying forward on
  // their own, which is why this button naturally appears less often once
  // you start using recurrence.)
  const copyPrevBudget = async () => {
    let copied = 0;
    for (const r of prevMonthBudgets) { if (await saveBudget(r.category, r.amount, false)) copied += 1; }
    if (copied === 0) return; // each failure already toasted its own error
    toast.success('Budget copied', `Copied ${copied} categor${copied !== 1 ? 'ies' : 'y'} from ${monthLabel(prevMonthKey)}.`);
  };

  // Reminder — fires a toast the moment a category (or the month overall)
  // crosses 80% of its budget (a heads-up) and again when it crosses into
  // over-budget, plus again on page load if either is already true.
  // Switching months just resyncs the baseline silently, no toast.
  const lastMonthRef = useRef(selectedMonthKey);
  const prevOverRef = useRef(new Map());
  const prevOverallRef = useRef(false);
  const prevNearRef = useRef(new Set());
  const prevOverallNearRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (lastMonthRef.current !== selectedMonthKey) {
      lastMonthRef.current = selectedMonthKey;
      prevOverRef.current = new Map(overBudgetCategories.map(c => [c.category, c.over]));
      prevOverallRef.current = overallOver > 0;
      prevNearRef.current = new Set(nearBudgetCategories.map(c => c.category));
      prevOverallNearRef.current = overallNear;
      return;
    }
    const prev = prevOverRef.current;
    const worsened = overBudgetCategories.find(c => !prev.has(c.category) || c.over > prev.get(c.category) + 0.5);
    const newlyNear = nearBudgetCategories.find(c => !prevNearRef.current.has(c.category));
    if (worsened) {
      toast.warning('Over budget', `${worsened.category} is now ${money(worsened.over)} over its ${money(worsened.budget)} budget for ${monthLabel(selectedMonthKey)}.`);
    } else if (overallOver > 0 && !prevOverallRef.current) {
      toast.warning('Over budget', `You've spent ${money(totalSpent)} against a ${money(totalBudget)} budget for ${monthLabel(selectedMonthKey)} — ${money(overallOver)} over.`);
    } else if (newlyNear) {
      toast.warning('Approaching budget', `${newlyNear.category} is at ${newlyNear.pct}% of its ${money(newlyNear.budget)} budget for ${monthLabel(selectedMonthKey)}.`);
    } else if (overallNear && !prevOverallNearRef.current) {
      toast.warning('Approaching budget', `You've used ${overallPct}% of your ${money(totalBudget)} budget for ${monthLabel(selectedMonthKey)}.`);
    }
    prevOverRef.current = new Map(overBudgetCategories.map(c => [c.category, c.over]));
    prevOverallRef.current = overallOver > 0;
    prevNearRef.current = new Set(nearBudgetCategories.map(c => c.category));
    prevOverallNearRef.current = overallNear;
  }, [overBudgetCategories, overallOver, nearBudgetCategories, overallNear, overallPct, selectedMonthKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanLines = (items) => items.filter(it => it.label.trim() && num(it.amount) > 0).map(it => ({ label: it.label.trim(), detail: (it.detail || '').trim() || null, amount: num(it.amount) }));
  const canAddIncome = cleanLines(nIncomeItems).length > 0;
  const canAddExpense = cleanLines(nExpenseItems).length > 0;

  // Income and expenses are logged independently, each through its own
  // button + form, rather than one combined entry — saving one never
  // touches the other's in-progress lines.
  const saveEntry = async (type) => {
    const items = type === 'income' ? nIncomeItems : nExpenseItems;
    const lines = cleanLines(items);
    if (lines.length === 0) return;
    if (!isDemo && !currentUserId) return;
    setSaving(true);
    const date = nDate || today;
    const table = type === 'income' ? 'personal_income' : 'personal_expenses';
    const state = type === 'income' ? incomeState : expenseState;
    const results = await Promise.all(lines.map(l => insertRow(table, state, {
      entry_date: date, detail: l.detail, amount: l.amount,
      ...(type === 'income' ? { source: l.label } : { category: l.label }),
    })));
    setSaving(false);
    if (results.every(ok => !ok)) return; // nothing saved — leave the form as-is, each failure already toasted
    if (type === 'income') setNIncomeItems([{ ...EMPTY_LINE }]); else setNExpenseItems([{ ...EMPTY_LINE }]);
    setNDate(today); setAddFormType(null);
    setSelectedMonthKey(monthKeyOf(date));
    if (results.every(ok => ok)) toast.success(type === 'income' ? 'Income logged' : 'Expense logged', fmtNice(date));
  };

  const incomeDisplay = useCountUp(totalIncome);
  const budgetDisplay = useCountUp(totalBudget);
  const spentDisplay = useCountUp(totalSpent);
  const remainingDisplay = useCountUp(remaining);

  const remainingColor = (n) => (n > 0 ? '#22C55E' : n < 0 ? '#E0485A' : 'var(--color-text-tertiary)');

  const lineEditor = (items, setItems, chipOptions, groupId) => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    const quickFill = (val) => {
      const idx = items.findIndex(it => !it.label.trim());
      const next = idx !== -1 ? items.map((it, i) => (i === idx ? { ...it, label: val } : it)) : [...items, { ...EMPTY_LINE, label: val }];
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
          {items.map((it, i) => {
            const listId = `pfin-detail-${groupId}-${i}`;
            const detailOptions = [...(detailHistoryByLabel.get(it.label.trim().toLowerCase()) || [])];
            return (
              <div key={i} className="pfin-item-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input className="pfin-input" style={{ flex: '1 1 130px' }} type="text" placeholder="Label" value={it.label} onChange={e => change(i, { label: e.target.value })} />
                <input className="pfin-input" style={{ flex: '1 1 130px' }} type="text" list={detailOptions.length ? listId : undefined}
                  placeholder="Detail (optional)" value={it.detail || ''} onChange={e => change(i, { detail: e.target.value })} />
                {detailOptions.length > 0 && (
                  <datalist id={listId}>
                    {detailOptions.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                )}
                <input className="pfin-input" style={{ flex: '0 1 110px', minWidth: 90 }} type="number" inputMode="decimal" placeholder="Amount" value={it.amount} onChange={e => change(i, { amount: e.target.value })} />
                <button className="pfin-del" title="Remove line"
                  onClick={() => { const next = items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_LINE }]; setItems(next); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <button className="pfin-additem" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([...items, { ...EMPTY_LINE }])}><Plus size={13} /> Add line</button>
      </div>
    );
  };

  // Renders one Insights breakdown card: a bar per source/category, sized by
  // share of the section's own max, with a click-to-expand drill-down into
  // that row's logged "detail" specifics.
  const insightSection = (title, Icon, tint, rows, sectionKey, colorFn, periodLabel = monthLabel(selectedMonthKey)) => {
    const max = rows.length ? Math.max(...rows.map(r => r.total)) : 0;
    return (
      <div className="pfin-fadeup" style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${tint}20`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Total <strong style={{ color: 'var(--color-text-primary)' }}>{money(rows.reduce((s, r) => s + r.total, 0))}</strong></span>
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Nothing logged for {periodLabel} yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => {
              const color = r.isOther ? OTHER_COLOR : colorFn(r.name);
              const rowKey = `${sectionKey}:${r.name}`;
              const isOpen = expandedInsight === rowKey;
              const detailRows = [...r.details.entries()].map(([name, amt]) => ({ name, amt })).sort((a, b) => b.amt - a.amt);
              const hasDetails = detailRows.length > 0;
              return (
                <div key={r.name}>
                  <button type="button" className="pfin-insightrow" disabled={!hasDetails}
                    onClick={() => setExpandedInsight(isOpen ? null : rowKey)}>
                    <span className="pfin-budgetrow-dot" style={{ background: color }} />
                    <span className="pfin-insightrow-label">{r.name}</span>
                    <span className="pfin-insightrow-amount">{money(r.total)}</span>
                    {hasDetails ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span style={{ width: 13 }} />}
                  </button>
                  <div className="pfin-insightbar-track"><div className="pfin-insightbar" style={{ width: `${max > 0 ? Math.max(3, (r.total / max) * 100) : 0}%`, background: color }} /></div>
                  {isOpen && hasDetails && (
                    <div className="pfin-insight-detail-list">
                      {detailRows.map(d => (
                        <div key={d.name} className="pfin-insight-detail-row">
                          <span className="pfin-insight-detail-label">{d.name}</span>
                          <span className="pfin-insight-detail-amount">{money(d.amt)}</span>
                          <div className="pfin-insightbar-track pfin-insightbar-track-sm">
                            <div className="pfin-insightbar" style={{ width: `${r.total > 0 ? Math.max(4, (d.amt / r.total) * 100) : 0}%`, background: color, opacity: 0.55 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

  // Renders one row in the Transactions list — either its normal display, or
  // (when it's the row being edited) an inline form editing label/detail/
  // amount/date in place, so fixing a typo doesn't mean delete-and-relog.
  const renderTxnRow = (r, type) => {
    const isEditing = editingTxn?.type === type && editingTxn?.id === r.id;
    const label = type === 'income' ? r.source : r.category;
    const sign = type === 'income' ? '+' : '−';
    const iconClass = type === 'income' ? 'pfin-txnicon-in' : 'pfin-txnicon-out';
    const amountClass = type === 'income' ? 'pfin-txnamount-in' : 'pfin-txnamount-out';
    const Icon = type === 'income' ? ArrowUpRight : ArrowDownRight;
    const table = type === 'income' ? 'personal_income' : 'personal_expenses';
    const state = type === 'income' ? incomeState : expenseState;

    if (isEditing) {
      return (
        <div key={r.id} className="pfin-txnrow-edit">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input className="pfin-input" style={{ flex: '1 1 90px' }} type="text" placeholder="Label" value={editTxnDraft.label}
              onChange={e => setEditTxnDraft(d => ({ ...d, label: e.target.value }))} autoFocus />
            <input className="pfin-input" style={{ flex: '1 1 90px' }} type="text" placeholder="Detail (optional)" value={editTxnDraft.detail}
              onChange={e => setEditTxnDraft(d => ({ ...d, detail: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <input className="pfin-input" style={{ flex: '1 1 110px' }} type="date" value={editTxnDraft.date}
              onChange={e => setEditTxnDraft(d => ({ ...d, date: e.target.value }))} />
            <input className="pfin-input" style={{ flex: '0 1 100px' }} type="number" inputMode="decimal" placeholder="Amount" value={editTxnDraft.amount}
              onChange={e => setEditTxnDraft(d => ({ ...d, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') commitEditTxn(); if (e.key === 'Escape') setEditingTxn(null); }} />
            <button className="pfin-del" title="Save" onClick={commitEditTxn}><Check size={13} /></button>
            <button className="pfin-del" title="Cancel" onClick={() => setEditingTxn(null)}><X size={13} /></button>
          </div>
        </div>
      );
    }

    return (
      <div key={r.id} className="pfin-txnrow">
        <div className={`pfin-txnicon ${iconClass}`}><Icon size={14} /></div>
        <div className="pfin-txnmeta">
          <span className="pfin-txnlabel">{label}</span>
          <span className="pfin-txndate">{r.detail ? `${r.detail} · ` : ''}{fmtShort(r.entry_date)}</span>
        </div>
        <span className={`pfin-txnamount ${amountClass}`}>{sign}{money(r.amount)}</span>
        <button className="pfin-del" title="Edit" onClick={() => startEditTxn(type, r)}>
          <Pencil size={13} />
        </button>
        <button className="pfin-del" title="Delete" onClick={() => deleteRow(table, state, r.id)}>
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' }}>
      {/* Header */}
      <div className="pfin-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div className="pfin-icon-badge" style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', flexShrink: 0 }}>
          <PiggyBank size={22} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Personal Finance</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Allocate a monthly budget, track where your income comes from, and get warned the moment you overspend — private to you</div>
        </div>
        <button className="pfin-save" style={isMobile ? { width: '100%', justifyContent: 'center' } : { marginLeft: 'auto', flexShrink: 0 }} onClick={() => setTab('transactions')}>
          <Plus size={15} /> Transactions
        </button>
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

      {/* Over-budget / approaching-budget reminder banner */}
      {overBudgetCategories.length > 0 || overallOver > 0 ? (
        <div className="pfin-fadeup pfin-banner pfin-banner-danger" style={{ animationDelay: '60ms' }}>
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
      ) : (nearBudgetCategories.length > 0 || overallNear) && (
        <div className="pfin-fadeup pfin-banner pfin-banner-warn" style={{ animationDelay: '60ms' }}>
          <div className="pfin-banner-icon"><AlertTriangle size={16} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Approaching budget for {monthLabel(selectedMonthKey)}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {nearBudgetCategories.length > 0 && (
                <span>{nearBudgetCategories.map(c => `${c.category} (${c.pct}%)`).join(' · ')}</span>
              )}
              {overallNear && <span>{nearBudgetCategories.length > 0 ? ' — ' : ''}Overall {overallPct}% of your {money(totalBudget)} budget used.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Hero: remaining balance + budget-used ring */}
      <div className="pfin-fadeup pfin-hero" style={{ animationDelay: '80ms' }}>
        <div className="pfin-hero-ringwrap">
          <RadialProgress pct={budgetUsedPct} size={isMobile ? 74 : 92} stroke={isMobile ? 7 : 9} color={ringColor} track="rgba(255,255,255,0.08)" />
          <div className="pfin-hero-ringlabel">
            <span className="pfin-hero-ringpct">{totalBudget > 0 ? `${budgetUsedPct}%` : '—'}</span>
            <span className="pfin-hero-ringsub">used</span>
          </div>
        </div>
        <div className="pfin-hero-main">
          <div className="pfin-hero-eyebrow">Remaining this month</div>
          <div className="pfin-hero-amount" style={{ color: remainingColor(remaining) }}>{money(remainingDisplay)}</div>
          <div className="pfin-hero-stats">
            <span><TrendingUp size={12} style={{ color: '#22C55E' }} /> {money(incomeDisplay)}</span>
            <span><Wallet size={12} style={{ color: '#5B9BFF' }} /> {money(budgetDisplay)}</span>
            <span><TrendingDown size={12} style={{ color: '#E0485A' }} /> {money(spentDisplay)}</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="pfin-fadeup pfin-tabs" style={{ animationDelay: '100ms' }}>
        <button className={`pfin-tab ${tab === 'budget' ? 'pfin-tab-active' : ''}`} onClick={() => setTab('budget')}>
          <Wallet size={14} /> Budget
        </button>
        <button className={`pfin-tab ${tab === 'transactions' ? 'pfin-tab-active' : ''}`} onClick={() => setTab('transactions')}>
          <Receipt size={14} /> Transactions
          {monthTransactions.length > 0 && <span className="pfin-tab-count">{monthTransactions.length}</span>}
        </button>
        <button className={`pfin-tab ${tab === 'insights' ? 'pfin-tab-active' : ''}`} onClick={() => setTab('insights')}>
          <PieChart size={14} /> Insights
        </button>
        <button className={`pfin-tab ${tab === 'goals' ? 'pfin-tab-active' : ''}`} onClick={() => setTab('goals')}>
          <Target size={14} /> Goals
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 30 }}>
          <Loader2 size={16} className="pfin-spin" /> Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Income target */}
          {tab === 'budget' && (
          <div className="pfin-fadeup" style={{ ...card, animationDelay: '200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(34,197,94,0.16)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={16} /></div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Income target</span>
              {monthIncomeTarget > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>{incomeTargetPct}% of <strong style={{ color: 'var(--color-text-primary)' }}>{money(monthIncomeTarget)}</strong></span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>Set what you aim to earn this month — the bar fills as income comes in.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="pfin-budgetrow-bar" style={{ flex: 1 }}>
                <div className="pfin-bar" style={{ width: `${monthIncomeTarget > 0 ? Math.min(100, Math.max(totalIncome > 0 ? 3 : 0, incomeTargetPct)) : 0}%`, height: '100%', borderRadius: 6, background: incomeTargetPct >= 100 ? '#22C55E' : '#5B9BFF' }} />
              </div>
              <button className="pfin-amountbtn" onClick={openIncomeTargetPrompt}>
                {monthIncomeTarget > 0 ? money(monthIncomeTarget) : 'Set target'}
              </button>
            </div>
            {monthIncomeTarget > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                {totalIncome >= monthIncomeTarget
                  ? `Target reached — ${money(totalIncome - monthIncomeTarget)} over.`
                  : `${money(monthIncomeTarget - totalIncome)} to go.`}
              </div>
            )}
          </div>
          )}

          {/* Budget allocation */}
          {tab === 'budget' && (
          <div className="pfin-fadeup" style={{ ...card, animationDelay: '220ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={16} /></div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Budget allocation</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Total <strong style={{ color: 'var(--color-text-primary)' }}>{money(totalBudget)}</strong></span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>Set what you plan to spend per category this month — the bar fills as you spend, and turns red once you go over.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input className="pfin-input" style={{ maxWidth: 200 }} type="text" placeholder="Category name" value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) { addBudgetCategory(newCatName, newCatAmount); setNewCatName(''); setNewCatAmount(''); } }} />
              <input className="pfin-input" style={{ maxWidth: 120 }} type="number" inputMode="decimal" placeholder="Amount" value={newCatAmount}
                onChange={e => setNewCatAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) { addBudgetCategory(newCatName, newCatAmount); setNewCatName(''); setNewCatAmount(''); } }} />
              <button className="pfin-additem" onClick={() => { if (newCatName.trim()) { addBudgetCategory(newCatName, newCatAmount); setNewCatName(''); setNewCatAmount(''); } }}><Plus size={13} /> Add budget</button>
              {totalBudget === 0 && prevMonthBudgets.length > 0 && (
                <button className="pfin-additem" onClick={copyPrevBudget}>
                  <Sparkles size={13} /> Copy budget from {monthLabel(prevMonthKey)}
                </button>
              )}
            </div>

            {categoryStatus.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                No budget categories yet — add one above to start building your own budget.
              </div>
            ) : (
            <div className="pfin-budgetgrid">
              {categoryStatus.map((c) => {
                const value = c.budget ? String(c.budget) : '';
                const barColor = c.over > 0 ? '#E0485A' : c.pct >= 80 ? '#F5A623' : c.color;
                const isEditing = editingCategory === c.category;
                const commitEdit = () => { editBudgetCategory(c.category, editDraft.name, editDraft.amount); setEditingCategory(null); };
                return (
                  <div key={c.category} className="pfin-budgetrow">
                    <div className="pfin-budgetrow-top">
                      <span className="pfin-budgetrow-dot" style={{ background: c.color }} />
                      {isEditing ? (
                        <input className="pfin-input pfin-budgetrow-nameinput" type="text" value={editDraft.name} autoFocus
                          onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCategory(null); }} />
                      ) : (
                        <>
                          <span className="pfin-budgetrow-label">
                            {c.category}
                            {c.isCarried && <span className="pfin-carried-badge" title={`Carried from ${monthLabel(c.sourceMonthKey)}`}>auto</span>}
                          </span>
                          <span className="pfin-budgetrow-spent" style={{ color: c.over > 0 ? '#E0485A' : 'var(--color-text-secondary)' }}>
                            {c.spent > 0 ? `${money(c.spent)} spent` : 'Nothing spent yet'}
                          </span>
                        </>
                      )}
                      {isEditing ? (
                        <>
                          <button className="pfin-del" title="Save" onClick={commitEdit}><Check size={13} /></button>
                          <button className="pfin-del" title="Cancel" onClick={() => setEditingCategory(null)}><X size={13} /></button>
                        </>
                      ) : (
                        <>
                          <button className={`pfin-del ${c.recurring ? 'pfin-recur-active' : ''}`}
                            title={c.recurring ? 'Recurring — click to stop carrying forward from this month' : 'Repeat this budget every month from now on'}
                            onClick={() => saveBudget(c.category, c.budget, !c.recurring)}>
                            <Repeat size={13} />
                          </button>
                          <button className="pfin-del" title="Edit category"
                            onClick={() => { setEditingCategory(c.category); setEditDraft({ name: c.category, amount: value }); }}>
                            <Pencil size={13} />
                          </button>
                          <button className="pfin-del" title="Delete category" onClick={() => removeBudgetCategory(c.category)}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="pfin-budgetrow-bottom">
                      <div className="pfin-budgetrow-bar">
                        <div className="pfin-bar" style={{ width: `${c.budget > 0 ? Math.max(c.pct, c.spent > 0 ? 3 : 0) : 0}%`, height: '100%', borderRadius: 6, background: barColor }} />
                      </div>
                      {isEditing ? (
                        <input className="pfin-input pfin-budgetrow-input" type="number" inputMode="decimal" placeholder="Budget"
                          value={editDraft.amount}
                          onChange={e => setEditDraft(d => ({ ...d, amount: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCategory(null); }} />
                      ) : (
                        <button className="pfin-amountbtn" onClick={() => openBudgetPrompt(c.category, c.budget)}>
                          {c.budget > 0 ? money(c.budget) : 'Set budget'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          )}

          {/* Log income / Log expense */}
          {tab === 'transactions' && (<>
          {addFormType ? (
            <div className="pfin-pop" style={{ ...card, border: `1px solid ${addFormType === 'income' ? 'rgba(34,197,94,0.35)' : 'rgba(224,72,90,0.35)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {addFormType === 'income'
                    ? <><ArrowUpRight size={15} style={{ color: '#22C55E' }} /> Add income</>
                    : <><ArrowDownRight size={15} style={{ color: '#E0485A' }} /> Add expense</>}
                </span>
                <button className="pfin-del" title="Close" onClick={() => setAddFormType(null)}><X size={16} /></button>
              </div>
              <div style={{ width: 160, marginBottom: 14 }}>
                <label style={lbl}>Date</label>
                <input ref={dateInputRef} className="pfin-input" type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{fmtNice(nDate)}</div>
              </div>
              {addFormType === 'income'
                ? lineEditor(nIncomeItems, setNIncomeItems, INCOME_SOURCES, 'income')
                : lineEditor(nExpenseItems, setNExpenseItems, allExpenseChipOptions, 'expense')}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="pfin-cancel" onClick={() => setAddFormType(null)}>Cancel</button>
                <button className="pfin-save" onClick={() => saveEntry(addFormType)} disabled={(addFormType === 'income' ? !canAddIncome : !canAddExpense) || saving}>
                  {saving ? <Loader2 size={15} className="pfin-spin" /> : <Plus size={15} />}
                  {saving ? 'Saving…' : addFormType === 'income' ? 'Save income' : 'Save expense'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="pfin-newbtn" style={{ flex: '1 1 160px' }} onClick={() => setAddFormType('income')}><Plus size={16} /> Add income</button>
              <button className="pfin-newbtn pfin-newbtn-expense" style={{ flex: '1 1 160px' }} onClick={() => setAddFormType('expense')}><Plus size={16} /> Add expense</button>
            </div>
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
              <div className="pfin-txncols">
                <div className="pfin-txncol">
                  <div className="pfin-txncol-head">
                    <span className="pfin-txncol-title">Income</span>
                    <span className="pfin-txncol-total pfin-txncol-total-in">+{money(totalIncome)}</span>
                  </div>
                  {monthIncomeRows.length === 0 ? (
                    <div className="pfin-txncol-empty">No income logged yet.</div>
                  ) : (
                    <div className="pfin-entrylist">
                      {monthIncomeRows.map(r => renderTxnRow(r, 'income'))}
                    </div>
                  )}
                </div>
                <div className="pfin-txncol">
                  <div className="pfin-txncol-head">
                    <span className="pfin-txncol-title">Expenses</span>
                    <span className="pfin-txncol-total pfin-txncol-total-out">−{money(totalSpent)}</span>
                  </div>
                  {monthExpenseRows.length === 0 ? (
                    <div className="pfin-txncol-empty">No expenses logged yet.</div>
                  ) : (
                    <div className="pfin-entrylist">
                      {monthExpenseRows.map(r => renderTxnRow(r, 'expense'))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </>)}

          {/* Insights */}
          {tab === 'insights' && (<>
            <div className="pfin-fadeup pfin-tabs" style={{ marginBottom: 4 }}>
              <button className={`pfin-tab ${insightScope === 'month' ? 'pfin-tab-active' : ''}`} onClick={() => setInsightScope('month')}>This month</button>
              <button className={`pfin-tab ${insightScope === 'year' ? 'pfin-tab-active' : ''}`} onClick={() => setInsightScope('year')}>This year</button>
            </div>

            {insightScope === 'year' && (
              <div className="pfin-fadeup pfin-monthnav">
                <button className="pfin-monthnav-btn" onClick={() => setSelectedYear(y => y - 1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
                <div style={{ textAlign: 'center' }}>
                  <div className="pfin-monthnav-label">{selectedYear}</div>
                  {selectedYear !== new Date().getFullYear() && (
                    <button className="pfin-monthnav-jump" onClick={() => setSelectedYear(new Date().getFullYear())}>Jump to this year</button>
                  )}
                </div>
                <button className="pfin-monthnav-btn" onClick={() => setSelectedYear(y => y + 1)} aria-label="Next year"><ChevronRight size={16} /></button>
              </div>
            )}

            {insightScope === 'year' && (
              <div className="pfin-fadeup" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 10 : 14 }}>
                {[
                  { label: 'Total income', value: yearTotalIncome, Icon: TrendingUp, tint: '#22C55E' },
                  { label: 'Total expenses', value: yearTotalExpense, Icon: TrendingDown, tint: '#E0485A' },
                  { label: 'Net', value: yearNet, Icon: Wallet, tint: '#5B9BFF' },
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
            )}

            {insightScope === 'month' ? (
              <>
                {insightSection('Income by source', TrendingUp, '#22C55E', incomeInsights, 'income', sourceColorOf)}
                {insightSection('Expenses by category', TrendingDown, '#E0485A', expenseInsights, 'expense', categoryColorOf)}
              </>
            ) : (
              <>
                {insightSection('Income by source', TrendingUp, '#22C55E', yearIncomeInsights, 'year-income', sourceColorOf, String(selectedYear))}
                {insightSection('Expenses by category', TrendingDown, '#E0485A', yearExpenseInsights, 'year-expense', categoryColorOf, String(selectedYear))}
              </>
            )}

            <div className="pfin-fadeup" style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PieChart size={16} /></div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>{insightScope === 'year' ? `${selectedYear} trend` : '6-month trend'}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {[
                    { key: 'bar', Icon: BarChart3, title: 'Bar chart' },
                    { key: 'line', Icon: LineChartIcon, title: 'Line chart' },
                    { key: 'area', Icon: AreaChartIcon, title: 'Area chart' },
                  ].map(({ key, Icon, title }) => (
                    <button key={key} type="button" className={`pfin-del ${chartType === key ? 'pfin-recur-active' : ''}`} title={title} onClick={() => setChartType(key)}>
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                {chartType === 'line' ? (
                  <LineChart data={insightScope === 'year' ? yearTrendData : trendData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ stroke: 'rgba(48,108,236,0.35)' }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="Income" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Expenses" stroke="#E0485A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={insightScope === 'year' ? yearTrendData : trendData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ stroke: 'rgba(48,108,236,0.35)' }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="Income" stroke="#22C55E" fill="#22C55E" fillOpacity={0.18} strokeWidth={2} />
                    <Area type="monotone" dataKey="Expenses" stroke="#E0485A" fill="#E0485A" fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart data={insightScope === 'year' ? yearTrendData : trendData} margin={{ top: 4, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6C82A3', fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                    <Tooltip cursor={{ fill: 'rgba(48,108,236,0.07)' }} contentStyle={{ background: 'rgba(8,14,30,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#E2EEFF', fontWeight: 700 }} itemStyle={{ padding: 0 }} formatter={(v, n) => [money(v), n]} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Income" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="Expenses" fill="#E0485A" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>)}

          {tab === 'goals' && <GoalsSavingsPanel selectedMonthKey={selectedMonthKey} />}
        </div>
      )}

      {amountPrompt && (
        <div className="pfin-modal-overlay" onClick={closeAmountPrompt}>
          <div className="pfin-modal pfin-pop" onClick={e => e.stopPropagation()}>
            <div className="pfin-modal-title">
              {amountPrompt.type === 'incomeTarget' ? 'Set income target' : `Set budget — ${amountPrompt.category}`}
            </div>
            <input className="pfin-input" type="number" inputMode="decimal" placeholder="Amount" autoFocus
              value={amountPromptValue}
              onChange={e => setAmountPromptValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAmountPrompt(); if (e.key === 'Escape') closeAmountPrompt(); }} />
            <div className="pfin-modal-actions">
              <button className="pfin-cancel" onClick={closeAmountPrompt}>Cancel</button>
              <button className="pfin-save" onClick={confirmAmountPrompt}><Check size={15} /> Save</button>
            </div>
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
        .pfin-newbtn-expense { color: #E0485A; background: rgba(224,72,90,0.08); border-color: rgba(224,72,90,0.45); }
        .pfin-newbtn-expense:hover { background: rgba(224,72,90,0.14); border-color: rgba(224,72,90,0.7); }
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
        .pfin-icon-badge { animation: pfinIconPulse 3.2s ease-in-out infinite; }
        .pfin-del {
          width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); display: flex; align-items: center; justify-content: center; transition: .15s; flex-shrink: 0;
        }
        .pfin-del:hover { color: #E0485A; background: rgba(224,72,90,0.1); transform: scale(1.08); }
        .pfin-recur-active { color: #5B9BFF; background: rgba(91,155,255,0.14); }
        .pfin-recur-active:hover { color: #5B9BFF; background: rgba(91,155,255,0.22); }
        .pfin-carried-badge {
          display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
          background: rgba(91,155,255,0.16); color: #5B9BFF; font-size: 9px; font-weight: 800;
          text-transform: uppercase; letter-spacing: .04em; vertical-align: middle;
        }
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
        }
        .pfin-banner-danger { background: rgba(224,72,90,0.10); border: 1px solid rgba(224,72,90,0.35); color: #F4A6AE; }
        .pfin-banner-warn { background: rgba(245,166,35,0.10); border: 1px solid rgba(245,166,35,0.35); color: #F5C177; }
        .pfin-banner-icon {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .pfin-banner-danger .pfin-banner-icon { background: rgba(224,72,90,0.18); color: #E0485A; }
        .pfin-banner-warn .pfin-banner-icon { background: rgba(245,166,35,0.18); color: #F5A623; }

        .pfin-hero {
          display: flex; align-items: center; gap: 20px; padding: 20px;
          border-radius: 18px; margin-bottom: 14px;
          background: linear-gradient(135deg, rgba(48,108,236,0.14), rgba(34,197,94,0.08));
          border: 1px solid var(--color-border);
        }
        .pfin-hero-ringwrap { position: relative; width: 92px; height: 92px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .pfin-hero-ringlabel { position: absolute; display: flex; flex-direction: column; align-items: center; }
        .pfin-hero-ringpct { font-size: 17px; font-weight: 800; color: var(--color-text-primary); }
        .pfin-hero-ringsub { font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .06em; }
        .pfin-hero-main { min-width: 0; flex: 1; }
        .pfin-hero-eyebrow { font-size: 11px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
        .pfin-hero-amount { font-size: 30px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
        .pfin-hero-stats { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; }
        .pfin-hero-stats span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
        .pfin-ring-arc { transition: stroke-dashoffset .6s cubic-bezier(.22,1,.36,1); }
        @media (max-width: 420px) {
          .pfin-hero { gap: 14px; padding: 16px; }
          .pfin-hero-amount { font-size: 24px; }
        }

        .pfin-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); margin-bottom: 18px; }
        .pfin-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          height: 34px; border-radius: 9px; border: none; background: transparent; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--color-text-tertiary); transition: .15s;
        }
        .pfin-tab:hover { color: var(--color-text-secondary); }
        .pfin-tab-active { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
        .pfin-tab-count {
          display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 999px; background: rgba(91,155,255,0.2); color: #5B9BFF; font-size: 10px; font-weight: 800;
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
        .pfin-budgetrow-nameinput { flex: 1; min-width: 0; height: 26px; font-size: 12.5px; font-weight: 600; }
        .pfin-budgetrow-spent { flex-shrink: 0; font-size: 11px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--color-text-tertiary); }
        .pfin-budgetrow-bottom { display: flex; align-items: center; gap: 10px; }
        .pfin-budgetrow-bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .pfin-budgetrow-input { width: 88px; flex-shrink: 0; height: 30px; text-align: right; }

        .pfin-amountbtn {
          flex-shrink: 0; height: 34px; padding: 0 14px; border-radius: 9px; font-size: 13px; font-weight: 700;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border); color: var(--color-text-primary);
          font-family: inherit; cursor: pointer; transition: .15s; font-variant-numeric: tabular-nums;
        }
        .pfin-amountbtn:hover { border-color: var(--color-border-active); background: var(--color-bg-elevated); transform: translateY(-1px); }
        .pfin-amountbtn:active { transform: translateY(0) scale(.97); }

        .pfin-modal-overlay {
          position: fixed; inset: 0; background: rgba(4,8,18,0.6); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
        }
        .pfin-modal {
          width: 100%; max-width: 300px; background: var(--color-bg-elevated); border: 1px solid var(--color-border);
          border-radius: 16px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .pfin-modal-title { font-size: 14.5px; font-weight: 800; color: var(--color-text-primary); margin-bottom: 12px; }
        .pfin-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

        .pfin-insightrow {
          width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px;
          border: none; background: transparent; cursor: pointer; font-family: inherit; text-align: left; transition: background .15s;
        }
        .pfin-insightrow:not(:disabled):hover { background: rgba(255,255,255,0.04); }
        .pfin-insightrow:disabled { cursor: default; }
        .pfin-insightrow-label { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pfin-insightrow-amount { flex-shrink: 0; font-size: 12.5px; font-weight: 700; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
        .pfin-insightbar-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin: 2px 4px 6px; }
        .pfin-insightbar-track-sm { height: 5px; margin: 2px 0 0; }
        .pfin-insightbar { height: 100%; border-radius: 3px; transition: width .6s cubic-bezier(.22,1,.36,1); }
        .pfin-insight-detail-list { display: flex; flex-direction: column; gap: 6px; padding: 4px 4px 10px 22px; }
        .pfin-insight-detail-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0 8px; }
        .pfin-insight-detail-label { font-size: 11.5px; font-weight: 600; color: var(--color-text-secondary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pfin-insight-detail-amount { font-size: 11.5px; font-weight: 700; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
        .pfin-insight-detail-row .pfin-insightbar-track { flex-basis: 100%; margin: 0; }

        .pfin-formgroup {
          display: flex; flex-direction: column; gap: 8px; padding: 12px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle); border-radius: 12px;
        }

        .pfin-sourcechip {
          padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
          color: var(--color-text-secondary); background: var(--color-bg-tertiary); border: 1px solid var(--color-border-subtle);
        }
        .pfin-sourcechip strong { color: var(--color-text-primary); font-weight: 700; margin-left: 4px; }

        .pfin-txncols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 560px) {
          .pfin-txncols { grid-template-columns: 1fr; gap: 18px; }
        }
        .pfin-txncol { min-width: 0; }
        .pfin-txncol-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border-subtle);
        }
        .pfin-txncol-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-tertiary); }
        .pfin-txncol-total { font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .pfin-txncol-total-in { color: #22C55E; }
        .pfin-txncol-total-out { color: #E0485A; }
        .pfin-txncol-empty { font-size: 11.5px; color: var(--color-text-muted); font-style: italic; padding: 4px 0; }

        .pfin-entrylist { display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto; }
        .pfin-txnrow {
          display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-radius: 8px; transition: background .15s;
        }
        .pfin-txnrow:hover { background: rgba(255,255,255,0.03); }
        .pfin-txnrow-edit {
          padding: 8px; margin: 2px 0; border-radius: 8px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border-active);
        }
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
          .pfin-bar, .pfin-ring-arc, .pfin-input, .pfin-save, .pfin-newbtn, .pfin-monthnav-btn { transition: none; }
        }
      `}</style>
    </div>
  );
}
