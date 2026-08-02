'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import ImgOrFallback from '@/components/ui/ImgOrFallback';
import { Target, Users, Pencil, Plus, X, Check, Flag, Trophy, ListChecks, Square, CheckSquare } from 'lucide-react';

const roleTint = { superadmin: '#E0485A', manager: '#F5A623', member: '#5B9BFF' };
const arr = (v) => (Array.isArray(v) ? v : []);
const pct = (cur, tgt) => { const t = Number(tgt) || 0, c = Number(cur) || 0; if (t <= 0) return c > 0 ? 100 : 0; return Math.max(0, Math.min(100, Math.round((c / t) * 100))); };
const emptyForm = () => ({ department: '', mission: '', priorities: [''], outcomes: [''], weekly_objectives: [''], kpis: [] });

export default function TeamPanel() {
  const { userProfile, workspace, activeAgencyId, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const me = userProfile?.id;
  const isManager = ['manager', 'superadmin'].includes(userProfile?.role);

  const [members, setMembers] = useState([]);
  const [missions, setMissions] = useState({}); // user_id -> row
  const [editUser, setEditUser] = useState(null); // user_id being edited
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
      if (cancelled) return;
      const map = {};
      (data || []).forEach((r) => { map[r.user_id] = r; });
      setMissions(map);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  const canEditMember = (uid) => uid === me || isManager;

  const openEdit = (uid) => {
    const m = missions[uid];
    setForm({
      department: m?.department || '',
      mission: m?.mission || '',
      priorities: arr(m?.priorities).length ? [...arr(m.priorities)] : [''],
      outcomes: arr(m?.outcomes).length ? [...arr(m.outcomes)] : [''],
      weekly_objectives: arr(m?.weekly_objectives).length ? [...arr(m.weekly_objectives)] : [''],
      kpis: arr(m?.kpis).map((k) => ({ label: k.label || '', target: k.target ?? '', current: k.current ?? '', unit: k.unit || '' })),
    });
    setEditUser(uid);
  };

  const persist = async (uid, patch) => {
    const existing = missions[uid] || {};
    const row = { agency_id: agencyId, user_id: uid, department: existing.department ?? null, mission: existing.mission ?? null,
      priorities: arr(existing.priorities), outcomes: arr(existing.outcomes), weekly_objectives: arr(existing.weekly_objectives),
      kpis: arr(existing.kpis), tasks: arr(existing.tasks), ...patch };
    setMissions((mm) => ({ ...mm, [uid]: { ...row } }));
    if (isDemo || !agencyId) return;
    try { await createClient().from('member_missions').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'agency_id,user_id' }); }
    catch (err) { console.error('[missions] save failed', err); }
  };

  const saveEdit = async () => {
    setSaving(true);
    await persist(editUser, {
      department: form.department.trim() || null,
      mission: form.mission.trim() || null,
      priorities: form.priorities.map((s) => s.trim()).filter(Boolean),
      outcomes: form.outcomes.map((s) => s.trim()).filter(Boolean),
      weekly_objectives: form.weekly_objectives.map((s) => s.trim()).filter(Boolean),
      kpis: form.kpis.filter((k) => (k.label || '').trim()).map((k) => ({ label: k.label.trim(), target: Number(k.target) || 0, current: Number(k.current) || 0, unit: (k.unit || '').trim() })),
    });
    setSaving(false);
    setEditUser(null);
  };

  // My Mission tasks (inline, autosave)
  const myRow = missions[me] || {};
  const myTasks = arr(myRow.tasks);
  const setMyTasks = (next) => persist(me, { tasks: next });

  const myProgress = useMemo(() => {
    if (myTasks.length) return Math.round((myTasks.filter((t) => t.done).length / myTasks.length) * 100);
    const kpis = arr(myRow.kpis);
    if (kpis.length) return Math.round(kpis.reduce((s, k) => s + pct(k.current, k.target), 0) / kpis.length);
    return 0;
  }, [myTasks, myRow.kpis]);

  const meMember = members.find((m) => m.id === me) || { id: me, full_name: userProfile?.full_name, email: userProfile?.email, role: userProfile?.role };

  // ── tokens ──
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = { background: 'var(--color-bg-elevated, rgba(255,255,255,0.03))', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.14))', borderRadius: 16, padding: 20 };

  const avatar = (m, size = 40) => (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: `${roleTint[m.role] || '#5B9BFF'}22`, color: roleTint[m.role] || '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800 }}>
      <ImgOrFallback src={m.avatar_url} fallback={(m.full_name || m.email || '?').charAt(0).toUpperCase()} />
    </div>
  );

  const chipList = (items, tint) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: tKey, lineHeight: 1.4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: tint, marginTop: 6, flexShrink: 0 }} />
          <span>{s}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 36px 80px', color: tKey }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,155,255,0.14)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={22} /></div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>Team missions</h1>
          <div style={{ fontSize: 12.5, color: tSub }}>Every person aligned to measurable outcomes — not just tasks</div>
        </div>
      </div>

      {/* My Mission This Week */}
      <div style={{ ...card, marginBottom: 22, background: 'linear-gradient(135deg, rgba(48,108,236,0.10), rgba(255,255,255,0.02) 60%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {avatar(meMember, 44)}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7EB3FF', textTransform: 'uppercase', letterSpacing: '.06em' }}>My mission this week</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{meMember.full_name || meMember.email || 'You'}</div>
            </div>
          </div>
          <button onClick={() => openEdit(me)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#7EB3FF', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(48,108,236,0.25)' }}><Pencil size={13} /> Edit my mission</button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.5, color: myRow.mission ? tKey : tSub, fontStyle: myRow.mission ? 'normal' : 'italic', fontWeight: myRow.mission ? 500 : 400 }}>
          {myRow.mission || 'Define your mission — the outcome you exist to create. Click "Edit my mission".'}
        </p>

        {/* This week progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: tSub, marginBottom: 6 }}><span>Progress this week</span><span style={{ fontWeight: 800, color: tKey }}>{myProgress}%</span></div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${myProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#16A36B,#22C55E)', transition: 'width .3s' }} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}>
          {/* Weekly objectives + KPIs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}><Flag size={13} /> Weekly objectives</div>
              {arr(myRow.weekly_objectives).length ? chipList(arr(myRow.weekly_objectives), '#F5A623') : <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>None set yet.</div>}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}><Trophy size={13} /> KPIs</div>
              {arr(myRow.kpis).length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {arr(myRow.kpis).map((k, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span style={{ color: tKey, fontWeight: 600 }}>{k.label}</span><span style={{ color: tSub, fontVariantNumeric: 'tabular-nums' }}>{k.current}{k.unit ? ` ${k.unit}` : ''} / {k.target}{k.unit ? ` ${k.unit}` : ''}</span></div>
                      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${pct(k.current, k.target)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#1E4FB8,#5B9BFF)' }} /></div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No KPIs yet.</div>}
            </div>
          </div>

          {/* Tasks checklist */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}><ListChecks size={13} /> My tasks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myTasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 9, background: 'var(--color-bg-hover, rgba(48,108,236,0.05))', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.1))' }}>
                  <button onClick={() => setMyTasks(myTasks.map((x, j) => j === i ? { ...x, done: !x.done } : x))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.done ? '#22C55E' : tSub, display: 'flex', padding: 0, flexShrink: 0 }}>{t.done ? <CheckSquare size={17} /> : <Square size={17} />}</button>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.done ? tSub : tKey, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                  <button onClick={() => setMyTasks(myTasks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, display: 'flex', padding: 0, flexShrink: 0 }}><X size={13} /></button>
                </div>
              ))}
              <TaskAdder onAdd={(text) => setMyTasks([...myTasks, { text, done: false }])} />
            </div>
          </div>
        </div>
      </div>

      {/* Team Mission Board */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}><Target size={13} /> Team mission board</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
        {members.map((m) => {
          const mm = missions[m.id] || {};
          return (
            <div key={m.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                {avatar(m, 40)}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || m.email}</div>
                  <div style={{ fontSize: 11.5, color: tSub, textTransform: 'capitalize' }}>{m.role}{mm.department ? ` · ${mm.department}` : ''}</div>
                </div>
                {canEditMember(m.id) && <button onClick={() => openEdit(m.id)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, display: 'flex', padding: 4, flexShrink: 0 }}><Pencil size={14} /></button>}
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, color: mm.mission ? tKey : tSub, fontStyle: mm.mission ? 'normal' : 'italic' }}>{mm.mission || 'No mission set yet.'}</p>
              {arr(mm.priorities).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Monthly priorities</div>
                  {chipList(arr(mm.priorities), '#5B9BFF')}
                </div>
              )}
              {arr(mm.outcomes).length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Expected outcomes</div>
                  {chipList(arr(mm.outcomes), '#22C55E')}
                </div>
              )}
            </div>
          );
        })}
        {members.length === 0 && <div style={{ ...card, gridColumn: '1 / -1', textAlign: 'center', color: tSub, fontSize: 13 }}>No team members loaded.</div>}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div onClick={() => setEditUser(null)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(2,5,12,0.82)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)', margin: '20px 0', background: '#0b1120', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{editUser === me ? 'My mission' : `Edit mission · ${members.find((m) => m.id === editUser)?.full_name || ''}`}</span>
              <button onClick={() => setEditUser(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#D8E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto' }}>
              <Field label="Department"><input className="tm-in" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Marketing" /></Field>
              <Field label="Mission"><textarea className="tm-in" rows={2} value={form.mission} onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))} placeholder="The outcome this person exists to create" /></Field>
              <ListField label="Monthly priorities" items={form.priorities} onChange={(v) => setForm((f) => ({ ...f, priorities: v }))} placeholder="Priority" />
              <ListField label="Expected outcomes (measurable)" items={form.outcomes} onChange={(v) => setForm((f) => ({ ...f, outcomes: v }))} placeholder="e.g. Generate 50 qualified conversations" />
              <ListField label="Weekly objectives" items={form.weekly_objectives} onChange={(v) => setForm((f) => ({ ...f, weekly_objectives: v }))} placeholder="This week's objective" />
              <div>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>KPIs</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {form.kpis.map((k, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px 30px', gap: 6 }}>
                      <input className="tm-in" value={k.label} onChange={(e) => setForm((f) => ({ ...f, kpis: f.kpis.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} placeholder="KPI" />
                      <input className="tm-in" value={k.current} onChange={(e) => setForm((f) => ({ ...f, kpis: f.kpis.map((x, j) => j === i ? { ...x, current: e.target.value } : x) }))} placeholder="Now" inputMode="decimal" />
                      <input className="tm-in" value={k.target} onChange={(e) => setForm((f) => ({ ...f, kpis: f.kpis.map((x, j) => j === i ? { ...x, target: e.target.value } : x) }))} placeholder="Target" inputMode="decimal" />
                      <input className="tm-in" value={k.unit} onChange={(e) => setForm((f) => ({ ...f, kpis: f.kpis.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) }))} placeholder="Unit" />
                      <button onClick={() => setForm((f) => ({ ...f, kpis: f.kpis.filter((_, j) => j !== i) }))} style={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm((f) => ({ ...f, kpis: [...f.kpis, { label: '', target: '', current: '', unit: '' }] }))} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add KPI</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: '#9DB8DD', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={15} /> Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .tm-in { width: 100%; box-sizing: border-box; background: var(--color-bg-tertiary, rgba(255,255,255,0.04)); border: 1px solid var(--color-border-subtle, rgba(48,108,236,0.16)); border-radius: 9px; padding: 8px 11px; font-size: 13px; color: var(--color-text-primary, #E2EEFF); font-family: inherit; outline: none; resize: vertical; line-height: 1.5; }
        .tm-in:focus { border-color: rgba(48,108,236,0.55); }
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

function ListField({ label, items, onChange, placeholder }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 7 }}>
            <input className="tm-in" value={v} onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))} placeholder={`${placeholder} ${i + 1}`} />
            <button onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [''])} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
          </div>
        ))}
        <button onClick={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add</button>
      </div>
    </div>
  );
}

function TaskAdder({ onAdd }) {
  const [text, setText] = useState('');
  const submit = () => { const t = text.trim(); if (!t) return; onAdd(t); setText(''); };
  return (
    <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} placeholder="Add a task…"
        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'var(--color-bg-tertiary, rgba(255,255,255,0.04))', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.14))', borderRadius: 9, padding: '7px 11px', fontSize: 13, color: 'var(--color-text-primary, #E2EEFF)', fontFamily: 'inherit', outline: 'none' }} />
      <button onClick={submit} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '0 13px', borderRadius: 9, border: 'none', background: 'rgba(48,108,236,0.2)', color: '#7EB3FF', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={14} /></button>
    </div>
  );
}
