'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Sigma, ChevronDown, ChevronRight, Lock, X, Check, Building2 } from 'lucide-react';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const itemsTotal = (items) => (items || []).reduce((s, i) => s + num(i.amount), 0);
const cleanItems = (items) => (items || [])
  .filter(i => (i.what || '').trim() || num(i.amount))
  .map(i => ({ what: (i.what || '').trim(), amount: num(i.amount) }));

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const parseDay = (dateStr) => new Date(`${dateStr}T00:00:00`);
// "Monday 5th July 2026"
const fmtNice = (dateStr) => {
  const d = parseDay(dateStr);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};
const fmtNiceShort = (dateStr) => {
  const d = parseDay(dateStr);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};
const monthKeyOf = (dateStr) => (dateStr || '').slice(0, 7);   // 'YYYY-MM'
const monthLabel = (key) => {
  const [y, m] = (key || '').split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Supplies', 'Stock / Inventory', 'Transport', 'Utilities', 'Marketing', 'Equipment', 'Fees / Licenses', 'Miscellaneous'];
const EMPTY_ITEM = { what: '', amount: '' };
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
  const [openDayId, setOpenDayId] = useState(null);                 // the day being edited
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(null);               // the business currently being viewed
  const [bizMenuOpen, setBizMenuOpen] = useState(false);

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

  // Group entries by calendar month, newest month first, with a monthly net.
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
    });
    arr.sort((a, b) => (a.key < b.key ? 1 : -1));   // newest month first
    return arr;
  }, [rows]);

  const latestMonthKey = months[0]?.key;
  const isMonthOpen = (key) => (key === latestMonthKey) !== monthToggles.has(key); // latest open by default
  const toggleMonth = (key) => setMonthToggles(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const persistDemo = (next) => { setRows(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const addEntry = async () => {
    const items = cleanItems(nItems);
    const expenses = itemsTotal(items);
    if (num(nRevenue) === 0 && expenses === 0 && !nNote.trim()) return;
    if (!isDemo && (!agencyId || !businessId)) return;
    setSaving(true);
    const base = {
      agency_id: agencyId,
      business_id: businessId,
      created_by: isUuid(currentUserId) ? currentUserId : null,
      entry_date: nDate || today,
      revenue: num(nRevenue), expenses,
      expense_items: items,
      note: nNote.trim() || null,
    };
    const reset = () => { setNRevenue(''); setNItems([{ ...EMPTY_ITEM }]); setNNote(''); setNDate(today); setSaving(false); setShowAdd(false); };
    if (isDemo) {
      persistDemo([{ ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...rows]);
      reset(); return;
    }
    try {
      const { data, error } = await createClient().from('daily_finance').insert(base).select('*').maybeSingle();
      if (error) console.error('[finance] insert failed —', 'message:', error.message, '| code:', error.code, '| details:', error.details);
      if (data) setRows(prev => [data, ...prev]);
    } catch (err) { console.error('[finance] insert threw:', err); }
    reset();
  };

  const activeBiz = businesses.find(b => b.id === businessId) || null;

  const editRow = (id, patch) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const commitRow = async (row) => {
    if (!row) return;
    const items = cleanItems(row.expense_items);
    const patch = {
      entry_date: row.entry_date, revenue: num(row.revenue),
      expenses: itemsTotal(items), expense_items: items,
      note: (row.note || '').trim() || null,
    };
    editRow(row.id, patch);
    if (isDemo) { persistDemo(rows.map(r => (r.id === row.id ? { ...r, ...patch } : r))); return; }
    try { await createClient().from('daily_finance').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', row.id); }
    catch (err) { console.error(err); }
  };

  const deleteRow = async (id) => {
    if (isDemo) { persistDemo(rows.filter(r => r.id !== id)); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    try { await createClient().from('daily_finance').delete().eq('id', id); } catch (_) {}
  };

  const netColor = (n) => (n > 0 ? '#22C55E' : n < 0 ? '#E0485A' : 'var(--color-text-tertiary)');

  const itemsEditor = (items, setItems, onBlur) => {
    const change = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 28px', gap: 8, alignItems: 'center' }}>
            <input className="fin-input" list="fin-cats" type="text" placeholder="What was spent on (e.g. Rent)"
              value={it.what} onChange={e => change(i, { what: e.target.value })} onBlur={onBlur} />
            <input className="fin-input" type="number" inputMode="decimal" placeholder="Amount"
              value={it.amount} onChange={e => change(i, { amount: e.target.value })} onBlur={onBlur} />
            <button className="fin-del" title="Remove item"
              onClick={() => { setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : [{ ...EMPTY_ITEM }]); onBlur?.(); }}>
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
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Daily Finance</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Log daily revenue and itemized expenses — per business, grouped by week</div>
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
                {/* Month header — carries the monthly Net profit */}
                <button className="fin-week" onClick={() => toggleMonth(month.key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text-primary)' }}>{month.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>· {month.rows.length} day{month.rows.length !== 1 ? 's' : ''}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {!isMobile && <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 700 }}>{money(month.totals.revenue)}</span>}
                    {!isMobile && <span style={{ fontSize: 12, color: '#E0485A', fontWeight: 700 }}>{money(month.totals.expenses)}</span>}
                    <span style={{ fontSize: 13.5, color: netColor(month.totals.net), fontWeight: 800 }}>Net profit {money(month.totals.net)}</span>
                  </span>
                </button>

                {/* Days — daily revenue & expenses only (net is a monthly figure) */}
                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {month.rows.map(row => {
                      const dayOpen = openDayId === row.id;
                      const items = Array.isArray(row.expense_items) && row.expense_items.length ? row.expense_items : [{ ...EMPTY_ITEM }];
                      const onBlur = () => commitRow(row);
                      return (
                        <div key={row.id} style={{ background: 'var(--color-bg-secondary)', border: `1px solid ${dayOpen ? 'var(--color-border-active)' : 'var(--color-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
                          {/* Compact row — date · revenue · expenses (no daily net) */}
                          <div onClick={() => setOpenDayId(dayOpen ? null : row.id)}
                            style={{ display: 'grid', gridTemplateColumns: isMobile ? '16px 1fr auto auto 28px' : '18px 1fr auto auto 30px', gap: 10, alignItems: 'center', padding: '10px 14px', cursor: 'pointer' }}>
                            {dayOpen ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtNiceShort(row.entry_date)}</span>
                            <span style={{ fontSize: 12.5, color: '#22C55E', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(row.revenue)}</span>
                            <span style={{ fontSize: 12.5, color: '#E0485A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>−{money(row.expenses)}</span>
                            <button className="fin-del" title="Delete" onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}><Trash2 size={13} /></button>
                          </div>

                          {/* Expanded editor */}
                          {dayOpen && (
                            <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', margin: '12px 0' }}>
                                <div style={{ width: 160 }}>
                                  <label style={lbl}>Date</label>
                                  <input className="fin-input" type="date" value={row.entry_date} onChange={e => editRow(row.id, { entry_date: e.target.value })} onBlur={onBlur} />
                                </div>
                                <div style={{ width: 150 }}>
                                  <label style={lbl}>Revenue</label>
                                  <input className="fin-input" type="number" inputMode="decimal" value={row.revenue} onChange={e => editRow(row.id, { revenue: e.target.value })} onBlur={onBlur} />
                                </div>
                                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>logged by {memberName(row.created_by)}</div>
                              </div>
                              <label style={lbl}>Expenses — what was spent</label>
                              {itemsEditor(items, (next) => editRow(row.id, { expense_items: next, expenses: itemsTotal(next) }), onBlur)}
                              <label style={{ ...lbl, marginTop: 12 }}>Note</label>
                              <input className="fin-input" type="text" placeholder="Optional note…" value={row.note || ''} onChange={e => editRow(row.id, { note: e.target.value })} onBlur={onBlur} />
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
        .fin-week {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12;
          padding: 11px 15px; border-radius: 12px; cursor: pointer; font-family: inherit; text-align: left;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border); color: var(--color-text-secondary); transition: .12s;
        }
        .fin-week:hover { border-color: var(--color-border-active); }
        .fin-del {
          width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); display: flex; align-items: center; justify-content: center; transition: .12s; flex-shrink: 0;
        }
        .fin-del:hover { color: #E0485A; background: rgba(224,72,90,0.1); }
      `}</style>
    </div>
  );
}
