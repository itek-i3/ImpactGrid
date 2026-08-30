'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
export const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
export const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export const pad2 = (n) => String(n).padStart(2, '0');
export const monthKeyOf = (dateStr) => (dateStr || '').slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = (key || '').split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
export const addMonthsToKey = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

// Smoothly eases a displayed number toward `value` whenever it changes —
// summary tiles count up/down instead of jumping, so edits feel alive.
export function useCountUp(value, duration = 550) {
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

// Circular progress gauge — SVG stroke-dashoffset ring, no chart library.
export function RadialProgress({ pct, size, stroke, color, track }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="pfin-ring-arc" />
    </svg>
  );
}

// Loads + realtime-subscribes one personal-finance table, with a
// localStorage-backed mirror for demo mode. Called once per table — same
// hook, same order, every render, so the Rules of Hooks stay satisfied.
export function useLiveTable(table, demoKey, currentUserId, isDemo, orderCol) {
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

  // Accepts either a next array or an updater(prev) => next — the updater
  // form is what makes concurrent saves (e.g. two income lines in one
  // Promise.all) safe: each call resolves against React's queued prev state
  // instead of a shared stale snapshot, so the second call can't clobber
  // what the first just added.
  const persistDemo = (updater) => {
    setRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  return { rows, setRows, loading, persistDemo };
}

// Generic insert/delete/update against a personal-finance table, branching on
// demo (localStorage mirror) vs live (Supabase). `ctx` carries what would
// otherwise be closed over from component state: { isDemo, currentUserId, toast }.
export const insertRow = async (table, state, base, { isDemo, currentUserId, toast }) => {
  if (isDemo) { state.persistDemo(prev => [{ ...base, id: crypto.randomUUID(), user_id: currentUserId, created_at: new Date().toISOString() }, ...prev]); return true; }
  if (!currentUserId) return false;
  try {
    const { data, error } = await createClient().from(table).insert({ ...base, user_id: currentUserId }).select('*').maybeSingle();
    if (error) { console.error(`[personal-finance] ${table} insert failed —`, error.message, '| code:', error.code); toast.error('Could not save', error.message); return false; }
    if (data) state.setRows(prev => (prev.some(r => r.id === data.id) ? prev : [data, ...prev]));
    return true;
  } catch (err) { console.error(`[personal-finance] ${table} insert threw:`, err); toast.error('Could not save', 'Something went wrong.'); return false; }
};

export const deleteRow = async (table, state, id, { isDemo, toast }) => {
  if (isDemo) { state.persistDemo(prev => prev.filter(r => r.id !== id)); toast.success('Deleted'); return; }
  state.setRows(prev => prev.filter(r => r.id !== id));
  try {
    const { error } = await createClient().from(table).delete().eq('id', id);
    if (error) { console.error(`[personal-finance] ${table} delete failed —`, error.message, '| code:', error.code); toast.error('Could not delete', error.message); return; }
    toast.success('Deleted');
  } catch (err) { console.error(`[personal-finance] ${table} delete threw:`, err); toast.error('Could not delete', 'Something went wrong.'); }
};

export const updateRow = async (table, state, id, patch, { isDemo, toast }) => {
  if (isDemo) { state.persistDemo(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r))); return true; }
  state.setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  try {
    const { error } = await createClient().from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error(`[personal-finance] ${table} update failed —`, error.message, '| code:', error.code); toast.error('Could not save', error.message); return false; }
    return true;
  } catch (err) { console.error(`[personal-finance] ${table} update threw:`, err); toast.error('Could not save', 'Something went wrong.'); return false; }
};
