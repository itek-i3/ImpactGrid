'use client';

import { useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import {
  Target, Plus, Trash2, Pencil, Check, X, Loader2, Landmark,
  ArrowUpRight, ArrowDownRight, CalendarClock, Flag,
} from 'lucide-react';
import {
  money, num, monthKeyOf, RadialProgress,
  useLiveTable, insertRow as insertRowShared, deleteRow as deleteRowShared, updateRow as updateRowShared,
} from '@/lib/personalFinance/shared';

const CATEGORY_PALETTE = ['#E0485A', '#F97316', '#F5A623', '#EAB308', '#84CC16', '#EC4899', '#5B9BFF', '#0EA5E9', '#14B8A6', '#F472B6', '#A78BFA', '#94A3B8'];
const EMPTY_FORM = { name: '', kind: 'goal', term: 'longterm', institution: '', targetAmount: '', maturityDate: '' };
const EMPTY_CONTRIB = { type: 'deposit', amount: '', date: '', note: '' };

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const parseDay = (dateStr) => new Date(`${dateStr}T00:00:00`);
const fmtShort = (dateStr) => {
  const d = parseDay(dateStr);
  return `${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};
const fmtNice = (dateStr) => {
  const d = parseDay(dateStr);
  return `${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};

const maturityText = (dateStr, today) => {
  if (!dateStr) return null;
  const days = Math.round((parseDay(dateStr) - parseDay(today)) / 86400000);
  if (days < 0) return { text: `Matured ${fmtNice(dateStr)}`, tone: 'muted' };
  if (days === 0) return { text: 'Matures today', tone: 'warn' };
  if (days <= 30) return { text: `${days} day${days === 1 ? '' : 's'} to go · ${fmtNice(dateStr)}`, tone: 'warn' };
  return { text: `${days} days to go · ${fmtNice(dateStr)}`, tone: 'ok' };
};

const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 16 };
const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

export default function GoalsSavingsPanel({ selectedMonthKey }) {
  const { userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const pocketState = useLiveTable('personal_savings_pockets', 'demo-personal-savings-pockets', currentUserId, isDemo, 'created_at');
  const txnState = useLiveTable('personal_savings_transactions', 'demo-personal-savings-transactions', currentUserId, isDemo, 'entry_date');
  const loading = pocketState.loading || txnState.loading;

  const crudCtx = { isDemo, currentUserId, toast };
  const insertRow = (table, state, base) => insertRowShared(table, state, base, crudCtx);
  const deleteRow = (table, state, id) => deleteRowShared(table, state, id, crudCtx);
  const updateRow = (table, state, id, patch) => updateRowShared(table, state, id, patch, crudCtx);

  const [showForm, setShowForm] = useState(false);
  const [editingPocketId, setEditingPocketId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [contribForPocketId, setContribForPocketId] = useState(null);
  const [contribDraft, setContribDraft] = useState({ ...EMPTY_CONTRIB });
  const [editingTxn, setEditingTxn] = useState(null); // { pocketId, id }
  const [editTxnDraft, setEditTxnDraft] = useState({ amount: '', date: '', note: '' });

  const txnsByPocket = useMemo(() => {
    const m = new Map();
    txnState.rows.forEach(t => { if (!m.has(t.pocket_id)) m.set(t.pocket_id, []); m.get(t.pocket_id).push(t); });
    return m;
  }, [txnState.rows]);

  const pocketStats = useMemo(() => {
    const m = new Map();
    pocketState.rows.forEach(p => {
      const txns = txnsByPocket.get(p.id) || [];
      let totalDeposited = 0, totalWithdrawn = 0, depositedThisMonth = 0, withdrawnThisMonth = 0;
      txns.forEach(t => {
        const amt = num(t.amount);
        const inMonth = monthKeyOf(t.entry_date) === selectedMonthKey;
        if (t.type === 'deposit') { totalDeposited += amt; if (inMonth) depositedThisMonth += amt; }
        else { totalWithdrawn += amt; if (inMonth) withdrawnThisMonth += amt; }
      });
      const balance = totalDeposited - totalWithdrawn;
      const target = num(p.target_amount);
      const progressPct = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : null;
      m.set(p.id, { balance, totalDeposited, totalWithdrawn, depositedThisMonth, withdrawnThisMonth, progressPct, target });
    });
    return m;
  }, [pocketState.rows, txnsByPocket, selectedMonthKey]);

  const totalBalance = useMemo(() => [...pocketStats.values()].reduce((s, v) => s + v.balance, 0), [pocketStats]);

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setShowForm(false); setEditingPocketId(null); };

  const startEditPocket = (p) => {
    setEditingPocketId(p.id);
    setForm({
      name: p.name, kind: p.kind, term: p.term || 'longterm', institution: p.institution || '',
      targetAmount: p.target_amount ? String(p.target_amount) : '', maturityDate: p.maturity_date || '',
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    const name = form.name.trim();
    if (!name) return;
    const base = {
      name, kind: form.kind,
      term: form.kind === 'savings' ? form.term : null,
      institution: form.kind === 'savings' ? (form.institution.trim() || null) : null,
      target_amount: num(form.targetAmount) > 0 ? num(form.targetAmount) : null,
      maturity_date: form.maturityDate || null,
    };
    if (editingPocketId) {
      const ok = await updateRow('personal_savings_pockets', pocketState, editingPocketId, base);
      if (ok) { toast.success('Updated', name); resetForm(); }
    } else {
      const ok = await insertRow('personal_savings_pockets', pocketState, base);
      if (ok) { toast.success('Added', name); resetForm(); }
    }
  };

  const removePocket = async (pocketId) => {
    if (isDemo) txnState.persistDemo(prev => prev.filter(t => t.pocket_id !== pocketId));
    await deleteRow('personal_savings_pockets', pocketState, pocketId);
  };

  const logContribution = async (pocketId) => {
    const amt = num(contribDraft.amount);
    if (amt <= 0) return;
    const ok = await insertRow('personal_savings_transactions', txnState, {
      pocket_id: pocketId, type: contribDraft.type, amount: amt,
      entry_date: contribDraft.date || today, note: (contribDraft.note || '').trim() || null,
    });
    if (ok) {
      toast.success(contribDraft.type === 'deposit' ? 'Deposit logged' : 'Withdrawal logged', money(amt));
      setContribDraft({ ...EMPTY_CONTRIB });
      setContribForPocketId(null);
    }
  };

  const startEditTxn = (pocketId, t) => {
    setEditingTxn({ pocketId, id: t.id });
    setEditTxnDraft({ amount: String(t.amount), date: t.entry_date, note: t.note || '' });
  };

  const commitEditTxn = async () => {
    if (!editingTxn) return;
    const amt = num(editTxnDraft.amount);
    if (amt <= 0) return;
    const ok = await updateRow('personal_savings_transactions', txnState, editingTxn.id, {
      amount: amt, entry_date: editTxnDraft.date || today, note: editTxnDraft.note.trim() || null,
    });
    if (ok) { setEditingTxn(null); toast.success('Updated'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 30 }}>
        <Loader2 size={16} className="pfin-spin" /> Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="pfin-fadeup" style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(91,155,255,0.16)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={16} /></div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Goals & Savings</span>
          {pocketState.rows.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Total <strong style={{ color: 'var(--color-text-primary)' }}>{money(totalBalance)}</strong></span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Track longer-horizon goals (like a project you are raising funds for) and savings pockets (long-term or short-term, wherever they are held) — target, contributions, withdrawals, and maturity all in one place.</div>
      </div>

      {showForm ? (
        <div className="pfin-pop" style={{ ...card, border: '1px solid rgba(91,155,255,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>{editingPocketId ? 'Edit' : 'Add a goal or savings pocket'}</span>
            <button className="pfin-del" title="Close" onClick={resetForm}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>Name</label>
              <input className="pfin-input" type="text" placeholder="e.g. Farm project, Emergency fund" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ key: 'goal', label: 'Goal', Icon: Flag }, { key: 'savings', label: 'Savings', Icon: Landmark }].map(({ key, label, Icon }) => (
                  <button key={key} type="button" className="pfin-chip"
                    style={{
                      color: form.kind === key ? '#5B9BFF' : 'var(--color-text-secondary)',
                      background: form.kind === key ? 'rgba(91,155,255,0.16)' : 'transparent',
                      borderColor: form.kind === key ? 'rgba(91,155,255,0.5)' : 'var(--color-border)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                    onClick={() => setForm(f => ({ ...f, kind: key }))}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>
            {form.kind === 'savings' && (
              <>
                <div>
                  <label style={lbl}>Term</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ key: 'longterm', label: 'Long-term' }, { key: 'shortterm', label: 'Short-term' }].map(({ key, label }) => (
                      <button key={key} type="button" className="pfin-chip"
                        style={{
                          color: form.term === key ? '#5B9BFF' : 'var(--color-text-secondary)',
                          background: form.term === key ? 'rgba(91,155,255,0.16)' : 'transparent',
                          borderColor: form.term === key ? 'rgba(91,155,255,0.5)' : 'var(--color-border)',
                        }}
                        onClick={() => setForm(f => ({ ...f, term: key }))}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Institution</label>
                  <input className="pfin-input" type="text" placeholder="e.g. SACCO, Ziidi" value={form.institution}
                    onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={lbl}>Target amount (optional)</label>
                <input className="pfin-input" type="number" inputMode="decimal" placeholder="e.g. 300000" value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={lbl}>Maturity date (optional)</label>
                <input className="pfin-input" type="date" value={form.maturityDate}
                  onChange={e => setForm(f => ({ ...f, maturityDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="pfin-cancel" onClick={resetForm}>Cancel</button>
            <button className="pfin-save" onClick={submitForm} disabled={!form.name.trim()}>
              <Plus size={15} /> {editingPocketId ? 'Save changes' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        <button className="pfin-newbtn" onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }}><Plus size={16} /> Add a goal or savings pocket</button>
      )}

      {pocketState.rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
          Nothing tracked yet — add a goal (like a project you are raising funds for) or a savings pocket above.
        </div>
      ) : (
        pocketState.rows.map((p, i) => {
          const stats = pocketStats.get(p.id) || { balance: 0, totalDeposited: 0, totalWithdrawn: 0, depositedThisMonth: 0, withdrawnThisMonth: 0, progressPct: null, target: 0 };
          const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
          const txns = (txnsByPocket.get(p.id) || []).slice().sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0));
          const maturity = maturityText(p.maturity_date, today);
          const subtitle = p.kind === 'goal' ? 'Goal' : [p.term === 'longterm' ? 'Long-term' : p.term === 'shortterm' ? 'Short-term' : null, p.institution].filter(Boolean).join(' · ') || 'Savings';
          const isContribOpen = contribForPocketId === p.id;

          return (
            <div key={p.id} className="pfin-fadeup" style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="pfin-budgetrow-dot" style={{ background: color }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{subtitle}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button className="pfin-del" title="Edit" onClick={() => startEditPocket(p)}><Pencil size={13} /></button>
                  <button className="pfin-del" title="Delete" onClick={() => removePocket(p.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                {stats.target > 0 && (
                  <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RadialProgress pct={stats.progressPct || 0} size={64} stroke={6} color={stats.progressPct >= 100 ? '#22C55E' : '#5B9BFF'} track="rgba(255,255,255,0.08)" />
                    <div style={{ position: 'absolute', fontSize: 12, fontWeight: 800, color: 'var(--color-text-primary)' }}>{stats.progressPct}%</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px 18px', flex: 1, minWidth: 0 }}>
                  {stats.target > 0 && (
                    <div><span style={lbl}>Target</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{money(stats.target)}</span></div>
                  )}
                  <div><span style={lbl}>Invested so far</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{money(stats.balance)}</span></div>
                  <div><span style={lbl}>Invested this month</span><span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>{money(stats.depositedThisMonth)}</span></div>
                  <div><span style={lbl}>Withdrawn this month</span><span style={{ fontSize: 13, fontWeight: 700, color: stats.withdrawnThisMonth > 0 ? '#E0485A' : 'var(--color-text-primary)' }}>{money(stats.withdrawnThisMonth)}</span></div>
                  <div><span style={lbl}>Withdrawn (total)</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{money(stats.totalWithdrawn)}</span></div>
                  <div>
                    <span style={lbl}>Maturity</span>
                    {maturity ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: maturity.tone === 'warn' ? '#F5A623' : maturity.tone === 'muted' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}>
                        <CalendarClock size={12} /> {maturity.text}
                      </span>
                    ) : <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not set</span>}
                  </div>
                </div>
              </div>

              {isContribOpen ? (
                <div className="pfin-formgroup" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ key: 'deposit', label: 'Deposit' }, { key: 'withdrawal', label: 'Withdrawal' }].map(({ key, label }) => (
                      <button key={key} type="button" className="pfin-chip"
                        style={{
                          color: contribDraft.type === key ? (key === 'deposit' ? '#22C55E' : '#E0485A') : 'var(--color-text-secondary)',
                          background: contribDraft.type === key ? (key === 'deposit' ? 'rgba(34,197,94,0.16)' : 'rgba(224,72,90,0.16)') : 'transparent',
                          borderColor: contribDraft.type === key ? (key === 'deposit' ? 'rgba(34,197,94,0.5)' : 'rgba(224,72,90,0.5)') : 'var(--color-border)',
                        }}
                        onClick={() => setContribDraft(d => ({ ...d, type: key }))}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input className="pfin-input" style={{ flex: '0 1 110px' }} type="number" inputMode="decimal" placeholder="Amount" value={contribDraft.amount}
                      onChange={e => setContribDraft(d => ({ ...d, amount: e.target.value }))} />
                    <input className="pfin-input" style={{ flex: '0 1 140px' }} type="date" value={contribDraft.date || today}
                      onChange={e => setContribDraft(d => ({ ...d, date: e.target.value }))} />
                    <input className="pfin-input" style={{ flex: '1 1 140px' }} type="text" placeholder="Note (optional)" value={contribDraft.note}
                      onChange={e => setContribDraft(d => ({ ...d, note: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="pfin-cancel" onClick={() => { setContribForPocketId(null); setContribDraft({ ...EMPTY_CONTRIB }); }}>Cancel</button>
                    <button className="pfin-save" onClick={() => logContribution(p.id)} disabled={num(contribDraft.amount) <= 0}><Plus size={15} /> Log</button>
                  </div>
                </div>
              ) : (
                <button className="pfin-additem" style={{ marginBottom: 10 }}
                  onClick={() => { setContribForPocketId(p.id); setContribDraft({ ...EMPTY_CONTRIB, date: today }); }}>
                  <Plus size={13} /> Log contribution
                </button>
              )}

              {txns.length > 0 && (
                <div className="pfin-entrylist" style={{ maxHeight: 220 }}>
                  {txns.map(t => {
                    const isEditing = editingTxn?.pocketId === p.id && editingTxn?.id === t.id;
                    if (isEditing) {
                      return (
                        <div key={t.id} className="pfin-txnrow-edit">
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="pfin-input" style={{ flex: '0 1 100px' }} type="number" inputMode="decimal" placeholder="Amount" value={editTxnDraft.amount}
                              onChange={e => setEditTxnDraft(d => ({ ...d, amount: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') commitEditTxn(); if (e.key === 'Escape') setEditingTxn(null); }} />
                            <input className="pfin-input" style={{ flex: '0 1 130px' }} type="date" value={editTxnDraft.date}
                              onChange={e => setEditTxnDraft(d => ({ ...d, date: e.target.value }))} />
                            <input className="pfin-input" style={{ flex: '1 1 120px' }} type="text" placeholder="Note" value={editTxnDraft.note}
                              onChange={e => setEditTxnDraft(d => ({ ...d, note: e.target.value }))} />
                            <button className="pfin-del" title="Save" onClick={commitEditTxn}><Check size={13} /></button>
                            <button className="pfin-del" title="Cancel" onClick={() => setEditingTxn(null)}><X size={13} /></button>
                          </div>
                        </div>
                      );
                    }
                    const isDeposit = t.type === 'deposit';
                    return (
                      <div key={t.id} className="pfin-txnrow">
                        <div className={`pfin-txnicon ${isDeposit ? 'pfin-txnicon-in' : 'pfin-txnicon-out'}`}>{isDeposit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</div>
                        <div className="pfin-txnmeta">
                          <span className="pfin-txnlabel">{t.note || (isDeposit ? 'Deposit' : 'Withdrawal')}</span>
                          <span className="pfin-txndate">{fmtShort(t.entry_date)}</span>
                        </div>
                        <span className={`pfin-txnamount ${isDeposit ? 'pfin-txnamount-in' : 'pfin-txnamount-out'}`}>{isDeposit ? '+' : '−'}{money(t.amount)}</span>
                        <button className="pfin-del" title="Edit" onClick={() => startEditTxn(p.id, t)}><Pencil size={13} /></button>
                        <button className="pfin-del" title="Delete" onClick={() => deleteRow('personal_savings_transactions', txnState, t.id)}><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
