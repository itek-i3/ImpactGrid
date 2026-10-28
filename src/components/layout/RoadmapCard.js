'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import { Map, Pencil, Plus, X, Check, TrendingUp, Square, CheckSquare } from 'lucide-react';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);

// Same quarter identity (tint + range) as the Hope stepper, so the two
// year-planning features read as one family rather than two palettes.
const QUARTERS = [
  { key: 'Q1', label: 'Q1', range: 'Jan – Mar', tint: '#5B9BFF' },
  { key: 'Q2', label: 'Q2', range: 'Apr – Jun', tint: '#14B8A6' },
  { key: 'Q3', label: 'Q3', range: 'Jul – Sep', tint: '#F5A623' },
  { key: 'Q4', label: 'Q4', range: 'Oct – Dec', tint: '#EC4899' },
];

// A winding river path with one flag per quarter sitting on it — Q1/Q3 ride
// the crests, Q2/Q4 sit in the troughs — echoing a timeline-infographic
// roadmap rather than a plain grid. Geometry is fixed, so it's computed once
// at module load, not per render.
const WAVE_W = 1000;
const WAVE_H = 200;
const WAVE_MIDY = 100;
const WAVE_AMP = 54;
const WAVE_PHASE = 0.14;
const WAVE_PERIOD = 0.48;
const Q_XFRAC = { Q1: 0.14, Q2: 0.38, Q3: 0.62, Q4: 0.86 };
const waveY = (xFrac) => WAVE_MIDY - WAVE_AMP * Math.cos(((xFrac - WAVE_PHASE) / WAVE_PERIOD) * Math.PI * 2);
const WAVE_PATH = Array.from({ length: 161 }, (_, i) => {
  const xFrac = i / 160;
  return `${i === 0 ? 'M' : 'L'}${(xFrac * WAVE_W).toFixed(1)},${waveY(xFrac).toFixed(1)}`;
}).join(' ');
const WAVE_POINTS = QUARTERS.map((q) => ({ ...q, x: Q_XFRAC[q.key] * WAVE_W, y: waveY(Q_XFRAC[q.key]) }));

const emptyTarget = () => ({ value: '', done: false });
const emptyKeyResult = () => ({ text: '', targets: { Q1: emptyTarget(), Q2: emptyTarget(), Q3: emptyTarget(), Q4: emptyTarget() } });
const emptyObjective = () => ({ text: '', keyResults: [emptyKeyResult()] });
const emptyForm = () => ({ target_revenue: '', objectives: [emptyObjective()] });

// A target used to be a plain string; normalize old data into the current
// { value, done } shape so an already-saved roadmap still renders and its
// checkboxes have somewhere to live.
const normalizeTarget = (t) => (
  t && typeof t === 'object' ? { value: t.value || '', done: !!t.done } : { value: t || '', done: false }
);
const normalizeKeyResult = (k) => ({
  text: k?.text || '',
  targets: { Q1: normalizeTarget(k?.targets?.Q1), Q2: normalizeTarget(k?.targets?.Q2), Q3: normalizeTarget(k?.targets?.Q3), Q4: normalizeTarget(k?.targets?.Q4) },
});
const normalizeObjective = (o) => ({
  text: o?.text || '',
  keyResults: Array.isArray(o?.keyResults) && o.keyResults.length ? o.keyResults.map(normalizeKeyResult) : [emptyKeyResult()],
});

export default function RoadmapCard() {
  const { userProfile, workspace, activeAgencyId, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();

  const [now] = useState(() => new Date());
  const targetYear = now.getFullYear() + 1;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = isDemo || ['manager', 'superadmin'].includes(userProfile?.role);

  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemo || !agencyId) { if (!cancelled) setLoading(false); return; }
      const { data } = await createClient().from('agency_roadmaps').select('*').eq('agency_id', agencyId).eq('year', targetYear).maybeSingle();
      if (!cancelled) { setRoadmap(data || null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo, targetYear]);

  const objectives = Array.isArray(roadmap?.objectives)
    ? roadmap.objectives.map(normalizeObjective).filter((o) => o.text)
    : [];
  const hasRoadmap = !!roadmap?.target_revenue || objectives.length > 0;

  // The same objectives/key results, regrouped by the quarter they target —
  // what the timeline below actually renders milestone-by-milestone. Key
  // results that share an objective are nested under one objective title
  // instead of repeating it on every line. oi/ki carry each item's position
  // in `objectives` so its checkbox can be toggled and persisted.
  const quarterEntries = { Q1: [], Q2: [], Q3: [], Q4: [] };
  objectives.forEach((o, oi) => {
    QUARTERS.forEach((q) => {
      const items = [];
      o.keyResults.forEach((k, ki) => {
        if (!k.text) return;
        const t = k.targets[q.key];
        if (t.value) items.push({ keyResult: k.text, target: t.value, done: t.done, oi, ki });
      });
      if (items.length) quarterEntries[q.key].push({ objective: o.text, items });
    });
  });

  // Flips one milestone's checkbox and persists the whole objectives tree —
  // same pattern as Hope's per-quarter "done" toggle.
  const toggleTargetDone = async (oi, ki, qKey) => {
    if (!canEdit) return;
    const nextObjectives = objectives.map((o, j) => (
      j !== oi ? o : {
        ...o,
        keyResults: o.keyResults.map((k, l) => (
          l !== ki ? k : { ...k, targets: { ...k.targets, [qKey]: { ...k.targets[qKey], done: !k.targets[qKey].done } } }
        )),
      }
    ));
    setRoadmap((r) => ({ ...(r || {}), objectives: nextObjectives }));
    if (isDemo || !agencyId) return;
    try {
      const { error } = await createClient().from('agency_roadmaps').upsert(
        { agency_id: agencyId, year: targetYear, target_revenue: roadmap?.target_revenue ?? null, objectives: nextObjectives, updated_at: new Date().toISOString() },
        { onConflict: 'agency_id,year' },
      );
      if (error) { console.error('[roadmap] toggle failed', error); toast.error('Could not save', error.message); }
    } catch (err) { console.error('[roadmap] toggle threw', err); toast.error('Could not save', 'Something went wrong.'); }
  };

  const startEdit = () => {
    setForm({
      target_revenue: roadmap?.target_revenue != null ? String(roadmap.target_revenue) : '',
      objectives: objectives.length ? objectives.map((o) => ({ text: o.text, keyResults: o.keyResults.map((k) => ({ text: k.text, targets: { ...k.targets } })) })) : [emptyObjective()],
    });
    setEditing(true);
  };

  const save = async () => {
    const clean = {
      agency_id: agencyId,
      year: targetYear,
      target_revenue: form.target_revenue.toString().trim() ? Number(form.target_revenue) : null,
      objectives: form.objectives
        .map((o) => ({
          text: (o.text || '').trim(),
          keyResults: (o.keyResults || [])
            .map((k) => ({
              text: (k.text || '').trim(),
              targets: {
                Q1: { value: (k.targets?.Q1?.value || '').trim(), done: !!k.targets?.Q1?.done },
                Q2: { value: (k.targets?.Q2?.value || '').trim(), done: !!k.targets?.Q2?.done },
                Q3: { value: (k.targets?.Q3?.value || '').trim(), done: !!k.targets?.Q3?.done },
                Q4: { value: (k.targets?.Q4?.value || '').trim(), done: !!k.targets?.Q4?.done },
              },
            }))
            .filter((k) => k.text),
        }))
        .filter((o) => o.text),
    };
    setSaving(true);
    if (!isDemo && agencyId) {
      try {
        const { error } = await createClient().from('agency_roadmaps').upsert({ ...clean, updated_at: new Date().toISOString() }, { onConflict: 'agency_id,year' });
        if (error) { console.error('[roadmap] save failed', error); toast.error('Could not save', error.message); setSaving(false); return; }
      } catch (err) { console.error('[roadmap] save threw', err); toast.error('Could not save', 'Something went wrong.'); setSaving(false); return; }
    }
    setRoadmap((r) => ({ ...(r || {}), ...clean }));
    setSaving(false);
    setEditing(false);
  };

  const setObjectiveText = (i, text) => setForm((f) => ({ ...f, objectives: f.objectives.map((o, j) => (j === i ? { ...o, text } : o)) }));
  const addObjective = () => setForm((f) => ({ ...f, objectives: [...f.objectives, emptyObjective()] }));
  const removeObjective = (i) => setForm((f) => ({ ...f, objectives: f.objectives.length > 1 ? f.objectives.filter((_, j) => j !== i) : [emptyObjective()] }));

  const setKeyResultText = (oi, ki, text) => setForm((f) => ({ ...f, objectives: f.objectives.map((o, j) => (j === oi ? { ...o, keyResults: o.keyResults.map((k, l) => (l === ki ? { ...k, text } : k)) } : o)) }));
  const setKeyResultTarget = (oi, ki, qKey, value) => setForm((f) => ({ ...f, objectives: f.objectives.map((o, j) => (j === oi ? { ...o, keyResults: o.keyResults.map((k, l) => (l === ki ? { ...k, targets: { ...k.targets, [qKey]: { ...k.targets[qKey], value } } } : k)) } : o)) }));
  const addKeyResult = (oi) => setForm((f) => ({ ...f, objectives: f.objectives.map((o, j) => (j === oi ? { ...o, keyResults: [...o.keyResults, emptyKeyResult()] } : o)) }));
  const removeKeyResult = (oi, ki) => setForm((f) => ({ ...f, objectives: f.objectives.map((o, j) => (j === oi ? { ...o, keyResults: o.keyResults.length > 1 ? o.keyResults.filter((_, l) => l !== ki) : [emptyKeyResult()] } : o)) }));

  // ── tokens — matching HomeDashboard's / HopeCard's card conventions. ──
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const tint = '#F5A623';
  const ink = 'var(--color-warning-text, #F5A623)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };
  const inputStyle = {
    flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.16))', borderRadius: 9,
    padding: '7px 10px', fontSize: 12.5, color: tKey, fontFamily: 'inherit', outline: 'none',
  };
  const removeBtn = {
    width: 28, flexShrink: 0, borderRadius: 7, border: '1px solid var(--color-border)', background: 'transparent',
    color: 'var(--color-text-control, #8FB4E8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const dashedBtn = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, alignSelf: 'flex-start',
    border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: 'var(--color-accent-text, #7EB3FF)',
    fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  };

  const header = (right) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${tint}22`, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Map size={16} /></div>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>{targetYear} Roadmap</h2>
      </div>
      {right}
    </div>
  );

  if (loading) {
    return (
      <div className="dash-card" style={{ ...card, minHeight: 120, display: 'flex', alignItems: 'center', color: tSub, fontSize: 12.5 }}>
        {header()}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="dash-card" style={card}>
        {header()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Target revenue for {targetYear}</span>
            <input type="number" inputMode="decimal" style={{ ...inputStyle, width: '100%' }} value={form.target_revenue} onChange={(e) => setForm((f) => ({ ...f, target_revenue: e.target.value }))} placeholder="e.g. 50000000" />
          </label>

          <div>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Objectives &amp; key results</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.objectives.map((o, oi) => (
                <div key={oi} style={{ border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.16))', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input style={inputStyle} value={o.text} onChange={(e) => setObjectiveText(oi, e.target.value)} placeholder={`Objective ${oi + 1}`} />
                    <button onClick={() => removeObjective(oi)} style={removeBtn}><X size={13} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Key results</span>
                    {o.keyResults.map((k, ki) => (
                      <div key={ki} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input style={{ ...inputStyle, fontSize: 12.5 }} value={k.text} onChange={(e) => setKeyResultText(oi, ki, e.target.value)} placeholder={`Key result ${ki + 1}`} />
                          <button onClick={() => removeKeyResult(oi, ki)} style={removeBtn}><X size={12} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
                          {QUARTERS.map((q) => (
                            <input key={q.key} style={{ ...inputStyle, fontSize: 11.5 }} value={k.targets[q.key].value} onChange={(e) => setKeyResultTarget(oi, ki, q.key, e.target.value)} placeholder={`${q.label} target`} />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addKeyResult(oi)} style={dashedBtn}><Plus size={12} /> Add key result</button>
                  </div>
                </div>
              ))}
              <button onClick={addObjective} style={dashedBtn}><Plus size={13} /> Add objective</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-control, #9DB8DD)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={15} /> {saving ? 'Saving…' : 'Save roadmap'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card" style={card}>
      {header(canEdit && (
        <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--color-accent-text, #7EB3FF)', background: 'rgba(48,108,236,0.12)', border: '1px solid rgba(48,108,236,0.35)', flexShrink: 0 }}>
          {hasRoadmap ? <Pencil size={12} /> : <Plus size={13} />} {hasRoadmap ? 'Edit roadmap' : `Build ${targetYear} roadmap`}
        </button>
      ))}

      {!hasRoadmap ? (
        <div style={{ fontSize: 13.5, color: tSub, fontStyle: 'italic' }}>No {targetYear} roadmap set yet.{canEdit ? ` Add the target revenue, objectives and key results via "Build ${targetYear} roadmap".` : ''}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {roadmap?.target_revenue != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(34,197,94,0.16)', color: 'var(--color-success-text, #22C55E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={17} /></div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Target revenue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(roadmap.target_revenue)}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <svg viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} style={{ width: '100%', aspectRatio: `${WAVE_W} / ${WAVE_H}`, display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="roadmap-wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1E4FB8" />
                  <stop offset="100%" stopColor="#5B9BFF" />
                </linearGradient>
              </defs>
              {[16, 8, 0, -8, -16].map((offset) => (
                <path key={offset} d={WAVE_PATH} fill="none" stroke="url(#roadmap-wave-grad)" strokeWidth={offset === 0 ? 3 : 1.5} opacity={offset === 0 ? 0.9 : 0.22} strokeLinecap="round" transform={`translate(0 ${offset})`} />
              ))}
              {WAVE_POINTS.map((q) => (
                <g key={q.key}>
                  <circle cx={q.x} cy={q.y} r={15} fill="none" stroke={q.tint} strokeWidth={1.5} opacity={0.35} />
                  <circle cx={q.x} cy={q.y} r={9} fill={q.tint} stroke="var(--color-bg-elevated, #0B1630)" strokeWidth={3} />
                </g>
              ))}
            </svg>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginTop: 10 }}>
              {QUARTERS.map((q) => {
                const entries = quarterEntries[q.key];
                return (
                  <div key={q.key} style={{ borderTop: `2px solid ${q.tint}`, paddingTop: 9, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: q.tint }}>{q.label} · {q.range}</div>
                    {entries.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: tSub, fontStyle: 'italic', marginTop: 7 }}>No targets set.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        {entries.map((group, gi) => (
                          <div key={gi}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: tKey, lineHeight: 1.35 }}>{group.objective}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 3 }}>
                              {group.items.map((item, ii) => (
                                <div
                                  key={ii}
                                  onClick={() => toggleTargetDone(item.oi, item.ki, q.key)}
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: canEdit ? 'pointer' : 'default' }}
                                >
                                  {item.done ? <CheckSquare size={12} style={{ color: 'var(--color-success-text, #22C55E)', flexShrink: 0, marginTop: 1 }} /> : <Square size={12} style={{ color: tSub, flexShrink: 0, marginTop: 1 }} />}
                                  <span style={{ fontSize: 11, lineHeight: 1.35, overflowWrap: 'break-word', color: item.done ? tSub : tSub, textDecoration: item.done ? 'line-through' : 'none' }}>
                                    {item.keyResult}: <span style={{ fontWeight: 700, color: item.done ? tSub : q.tint }}>{item.target}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
