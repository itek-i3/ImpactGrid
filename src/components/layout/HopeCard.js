'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, Loader2, Plus, X, Check } from 'lucide-react';

// One accent per quarter — pulled from colors already used elsewhere in the
// dashboard (STAGE_TINT in HomeDashboard) so the stepper reads as native, not
// a new palette. Green is reserved for the "done" state, not a quarter identity.
const QUARTERS = [
  { key: 'Q1', label: 'Q1', range: 'Jan – Mar', months: [0, 1, 2], tint: '#5B9BFF' },
  { key: 'Q2', label: 'Q2', range: 'Apr – Jun', months: [3, 4, 5], tint: '#14B8A6' },
  { key: 'Q3', label: 'Q3', range: 'Jul – Sep', months: [6, 7, 8], tint: '#F5A623' },
  { key: 'Q4', label: 'Q4', range: 'Oct – Dec', months: [9, 10, 11], tint: '#EC4899' },
];
const EMPTY_QUARTERS = {
  Q1: { plans: [''], done: false }, Q2: { plans: [''], done: false },
  Q3: { plans: [''], done: false }, Q4: { plans: [''], done: false },
};
const currentQuarterKey = (month) => QUARTERS.find((q) => q.months.includes(month))?.key;
const cleanList = (list) => (Array.isArray(list) ? list : []).map((s) => (s || '').trim()).filter(Boolean);

// A loaded quarter always gets at least one (possibly empty) plan line so
// there's something to type into, same as the objectives list.
const normalizeQuarters = (raw) => {
  const out = {};
  QUARTERS.forEach((q) => {
    const r = raw?.[q.key] || {};
    const plans = cleanList(r.plans);
    out[q.key] = { plans: plans.length ? plans : [''], done: !!r.done };
  });
  return out;
};

// Circular progress indicator — same construction as the completeness ring
// elsewhere in the app (gradient stroke over a track circle), so "year
// progress" reads as one more native stat, not an imported widget.
function ProgressRing({ pct, size = 46, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-track, rgba(255,255,255,0.06))" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#hope-ring-grad)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 300ms ease' }}
      />
      <defs>
        <linearGradient id="hope-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E4FB8" />
          <stop offset="100%" stopColor="#5B9BFF" />
        </linearGradient>
      </defs>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.3} fontWeight="800" fill="var(--color-text-primary, #E2EEFF)" fontFamily="var(--font-mono, inherit)">
        {pct}%
      </text>
    </svg>
  );
}

export default function HopeCard() {
  const { userProfile, isDemo } = useWorkspaceStore();
  const toast = useToast();
  const [now] = useState(() => new Date());
  const year = now.getFullYear();
  const liveQuarter = currentQuarterKey(now.getMonth());

  const [hope, setHope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ objectives: [''], quarters: { ...EMPTY_QUARTERS } });
  const [saving, setSaving] = useState(false);
  // Which quarter's plan is expanded below the stepper — defaults to the
  // current one, but any quarter can be reviewed/edited by clicking its dot.
  const [selectedKey, setSelectedKey] = useState(liveQuarter);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo || !userProfile?.id) { if (!cancelled) setLoading(false); return; }
      const { data } = await createClient().from('yearly_hopes').select('*').eq('user_id', userProfile.id).eq('year', year).maybeSingle();
      if (cancelled) return;
      const loadedObjectives = cleanList(data?.objectives);
      setHope(data || null);
      setForm({
        objectives: loadedObjectives.length ? loadedObjectives : [''],
        quarters: normalizeQuarters(data?.quarters),
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userProfile?.id, isDemo, year]);

  const doneCount = QUARTERS.filter((q) => form.quarters[q.key]?.done).length;
  const progressPct = Math.round((doneCount / QUARTERS.length) * 100);
  const savedObjectives = cleanList(hope?.objectives);
  const dirty = JSON.stringify(cleanList(form.objectives)) !== JSON.stringify(savedObjectives)
    || QUARTERS.some((q) => JSON.stringify(cleanList(form.quarters[q.key]?.plans)) !== JSON.stringify(cleanList(hope?.quarters?.[q.key]?.plans)));

  // Writes the given fields (falling back to current form state for whichever
  // one isn't passed) so a plan edit doesn't need to resend the objectives and
  // vice versa. `silent` skips the save/error toast for the done-toggle.
  const persist = async (patch, { silent } = {}) => {
    const quartersSource = patch.quarters ?? form.quarters;
    const quarters = {};
    QUARTERS.forEach((q) => {
      const qs = quartersSource?.[q.key] || {};
      quarters[q.key] = { plans: cleanList(qs.plans), done: !!qs.done };
    });
    const clean = {
      user_id: userProfile?.id,
      year,
      objectives: cleanList(patch.objectives ?? form.objectives),
      quarters,
      updated_at: new Date().toISOString(),
    };
    setHope((h) => ({ ...(h || {}), ...clean }));
    if (isDemo || !userProfile?.id) return true;
    try {
      const { error } = await createClient().from('yearly_hopes').upsert(clean, { onConflict: 'user_id,year' });
      if (error) { console.error('[hope] save failed', error); if (!silent) toast.error('Could not save', error.message); return false; }
      return true;
    } catch (err) { console.error('[hope] save threw', err); if (!silent) toast.error('Could not save', 'Something went wrong.'); return false; }
  };

  const save = async () => {
    setSaving(true);
    const ok = await persist({ objectives: form.objectives, quarters: form.quarters });
    setSaving(false);
    if (ok) toast.success('Hope saved', `Your ${year} objectives and quarter plans are set.`);
  };

  const toggleDone = async (key) => {
    const nextDone = !form.quarters[key]?.done;
    const nextQuarters = { ...form.quarters, [key]: { ...form.quarters[key], done: nextDone } };
    setForm((f) => ({ ...f, quarters: nextQuarters }));
    await persist({ quarters: nextQuarters }, { silent: true });
  };

  const addObjective = () => setForm((f) => ({ ...f, objectives: [...f.objectives, ''] }));
  const setObjective = (i, value) => setForm((f) => ({ ...f, objectives: f.objectives.map((x, j) => (j === i ? value : x)) }));
  const removeObjective = (i) => setForm((f) => ({ ...f, objectives: f.objectives.length > 1 ? f.objectives.filter((_, j) => j !== i) : [''] }));

  const quarter = QUARTERS.find((q) => q.key === selectedKey) || QUARTERS[0];
  const qState = form.quarters[quarter.key] || { plans: [''], done: false };
  const setPlans = (plans) => setForm((f) => ({ ...f, quarters: { ...f.quarters, [quarter.key]: { ...qState, plans } } }));

  // ── tokens — matching HomeDashboard's card/header/input conventions. ──
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

  if (loading) {
    return (
      <div className="dash-card" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: tSub, fontSize: 12.5, minHeight: 120 }}>
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="dash-card" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${tint}22`, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={16} />
          </div>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Hope for {year}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: tSub, textAlign: 'right' }}>Quarters<br />achieved</span>
          <ProgressRing pct={progressPct} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 9 }}>Your {year} objectives</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.objectives.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: `${tint}16`, color: ink, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <input style={inputStyle} value={o} onChange={(e) => setObjective(i, e.target.value)} placeholder="What do you hope to achieve this year?" />
              <button onClick={() => removeObjective(i)} style={removeBtn}><X size={12} /></button>
            </div>
          ))}
          <button onClick={addObjective} style={{ ...dashedBtn, marginLeft: 28 }}><Plus size={12} /> Add objective</button>
        </div>
      </div>

      {/* Quarter stepper — the whole year at a glance; click a dot to review or edit that quarter below. */}
      <div style={{ paddingTop: 18, borderTop: '1px solid var(--color-divider, rgba(255,255,255,0.06))', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          {QUARTERS.map((q, i) => {
            const done = !!form.quarters[q.key]?.done;
            const active = q.key === selectedKey;
            const isLive = q.key === liveQuarter;
            return (
              <div key={q.key} style={{ display: 'flex', alignItems: 'center', flex: i < QUARTERS.length - 1 ? 1 : 'none' }}>
                <button
                  onClick={() => setSelectedKey(q.key)}
                  title={`${q.label} · ${q.range}`}
                  style={{
                    position: 'relative', width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800,
                    border: `2px solid ${done ? 'var(--color-success-text, #22C55E)' : active ? q.tint : 'var(--color-border)'}`,
                    background: done ? 'rgba(34,197,94,0.16)' : active ? `${q.tint}22` : 'transparent',
                    color: done ? 'var(--color-success-text, #22C55E)' : active ? q.tint : tSub,
                  }}
                >
                  {done ? <Check size={15} /> : q.label}
                  {isLive && !done && (
                    <span style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: q.tint, border: '2px solid var(--color-bg-tertiary, #0B1630)' }} />
                  )}
                </button>
                {i < QUARTERS.length - 1 && (
                  <div style={{ flex: 1, height: 2, margin: '0 2px', background: done ? 'var(--color-success-text, #22C55E)' : 'var(--color-border)', opacity: done ? 0.6 : 0.5 }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{quarter.label}</span>
            <span style={{ fontSize: 11.5, color: tSub }}>{quarter.range}</span>
          </div>
          {quarter.key === liveQuarter && (
            <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--color-accent-text, #7EB3FF)', background: 'rgba(48,108,236,0.16)', padding: '2px 7px', borderRadius: 999 }}>NOW</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
          {qState.plans.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                style={inputStyle} value={p}
                onChange={(e) => setPlans(qState.plans.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`What happens in ${quarter.label}?`}
              />
              <button onClick={() => setPlans(qState.plans.length > 1 ? qState.plans.filter((_, j) => j !== i) : [''])} style={removeBtn}><X size={11} /></button>
            </div>
          ))}
          <button onClick={() => setPlans([...qState.plans, ''])} style={dashedBtn}><Plus size={12} /> Add</button>
        </div>
        <button onClick={() => toggleDone(quarter.key)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          {qState.done ? <Check size={16} style={{ color: 'var(--color-success-text, #22C55E)' }} /> : <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${tSub}` }} />}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: qState.done ? 'var(--color-success-text, #22C55E)' : tSub }}>
            {qState.done ? `${quarter.label} achieved` : 'Mark this quarter achieved'}
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={save}
          disabled={saving || !dirty}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', border: 'none',
            background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
            opacity: saving || !dirty ? 0.5 : 1, cursor: saving || !dirty ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save hope'}
        </button>
      </div>
    </div>
  );
}
