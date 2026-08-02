'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { ClipboardCheck, Trophy, TriangleAlert, Lightbulb, Compass, Pencil, Plus, X, Check } from 'lucide-react';

const arr = (v) => (Array.isArray(v) ? v : []);
const iso = (d) => d.toISOString().slice(0, 10);
const mondayOf = (date) => { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; };
const addDays = (isoStr, n) => { const d = new Date(isoStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d; };
const fmt = (d) => d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
const weekLabel = (weekStart) => { const s = new Date(weekStart + 'T00:00:00'); const e = addDays(weekStart, 6); return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`; };

const SECTIONS = [
  { key: 'wins', label: 'Wins', Icon: Trophy, tint: '#22C55E', ph: 'A win this week' },
  { key: 'challenges', label: 'Challenges', Icon: TriangleAlert, tint: '#F5A623', ph: 'A challenge faced' },
  { key: 'lessons', label: 'Lessons', Icon: Lightbulb, tint: '#5B9BFF', ph: 'Something learned' },
  { key: 'next_focus', label: 'Next week focus', Icon: Compass, tint: '#14B8A6', ph: 'Focus for next week' },
];

const emptyForm = (weekStart) => ({ week_start: weekStart, headline: '', wins: [''], challenges: [''], lessons: [''], next_focus: [''] });

export default function WeeklyReviewPanel() {
  const { userProfile, workspace, activeAgencyId, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = isDemo || ['manager', 'superadmin'].includes(userProfile?.role);

  const [thisMonday] = useState(() => iso(mondayOf(new Date())));
  const [reviews, setReviews] = useState([]);
  const [editing, setEditing] = useState(null); // review row or {new:true}
  const [form, setForm] = useState(() => emptyForm(thisMonday));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemo || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await createClient().from('weekly_reviews').select('*').eq('agency_id', agencyId).order('week_start', { ascending: false });
      if (!cancelled) setReviews(data || []);
    })();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  const hasThisWeek = useMemo(() => reviews.some((r) => r.week_start === thisMonday), [reviews, thisMonday]);

  const openNew = () => { setForm(emptyForm(thisMonday)); setEditing({ new: true }); };
  const openEdit = (r) => {
    setForm({
      week_start: r.week_start,
      headline: r.headline || '',
      wins: arr(r.wins).length ? [...arr(r.wins)] : [''],
      challenges: arr(r.challenges).length ? [...arr(r.challenges)] : [''],
      lessons: arr(r.lessons).length ? [...arr(r.lessons)] : [''],
      next_focus: arr(r.next_focus).length ? [...arr(r.next_focus)] : [''],
    });
    setEditing(r);
  };

  const save = async () => {
    setSaving(true);
    const clean = {
      agency_id: agencyId,
      week_start: form.week_start,
      headline: form.headline.trim() || null,
      wins: form.wins.map((s) => s.trim()).filter(Boolean),
      challenges: form.challenges.map((s) => s.trim()).filter(Boolean),
      lessons: form.lessons.map((s) => s.trim()).filter(Boolean),
      next_focus: form.next_focus.map((s) => s.trim()).filter(Boolean),
      created_by: userProfile?.id || null,
      updated_at: new Date().toISOString(),
    };
    if (!isDemo && agencyId) {
      try {
        const { data } = await createClient().from('weekly_reviews').upsert(clean, { onConflict: 'agency_id,week_start' }).select().maybeSingle();
        if (data) setReviews((rs) => { const rest = rs.filter((r) => r.week_start !== data.week_start); return [data, ...rest].sort((a, b) => (a.week_start < b.week_start ? 1 : -1)); });
      } catch (err) { console.error('[weekly_reviews] save failed', err); }
    } else {
      setReviews((rs) => { const rest = rs.filter((r) => r.week_start !== clean.week_start); return [{ id: clean.week_start, ...clean }, ...rest].sort((a, b) => (a.week_start < b.week_start ? 1 : -1)); });
    }
    setSaving(false);
    setEditing(null);
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = { background: 'var(--color-bg-elevated, rgba(255,255,255,0.03))', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.14))', borderRadius: 16, padding: 20 };

  const sectionBlock = (r, sec) => {
    const items = arr(r[sec.key]);
    if (items.length === 0) return null;
    return (
      <div key={sec.key}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: sec.tint, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
          <sec.Icon size={13} /> {sec.label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: tKey, lineHeight: 1.4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sec.tint, marginTop: 6, flexShrink: 0 }} /><span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 36px 80px', color: tKey }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(78,205,196,0.14)', color: '#4ECDC4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardCheck size={22} /></div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>Weekly review</h1>
            <div style={{ fontSize: 12.5, color: tSub }}>Reflect on the week — wins, challenges, lessons, and next-week focus</div>
          </div>
        </div>
        {canEdit && !hasThisWeek && (
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', border: 'none' }}>
            <Plus size={15} /> Start this week
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: tSub, fontSize: 13.5, padding: '46px 20px' }}>
          No weekly reviews yet.{canEdit ? ' Start this week’s review to begin the ritual.' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map((r, idx) => {
            const isCurrent = r.week_start === thisMonday;
            return (
              <div key={r.id} style={{ ...card, ...(isCurrent ? { border: '1px solid rgba(48,108,236,0.4)', background: 'linear-gradient(135deg, rgba(48,108,236,0.08), rgba(255,255,255,0.02) 60%)' } : {}) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15.5, fontWeight: 800 }}>{weekLabel(r.week_start)}</span>
                      {isCurrent && <span style={{ fontSize: 10, fontWeight: 800, color: '#7EB3FF', background: 'rgba(48,108,236,0.16)', padding: '2px 8px', borderRadius: 999 }}>THIS WEEK</span>}
                      {idx === 0 && !isCurrent && <span style={{ fontSize: 10, fontWeight: 800, color: '#4ECDC4', background: 'rgba(78,205,196,0.14)', padding: '2px 8px', borderRadius: 999 }}>LATEST</span>}
                    </div>
                    {r.headline && <p style={{ margin: '6px 0 0', fontSize: 14, color: tKey, fontWeight: 500 }}>{r.headline}</p>}
                  </div>
                  {canEdit && <button onClick={() => openEdit(r)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, display: 'flex', padding: 4, flexShrink: 0 }}><Pencil size={15} /></button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  {SECTIONS.map((sec) => sectionBlock(r, sec))}
                </div>
                {SECTIONS.every((sec) => arr(r[sec.key]).length === 0) && !r.headline && (
                  <div style={{ fontSize: 13, color: tSub, fontStyle: 'italic' }}>Empty review.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(2,5,12,0.82)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 12 : 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)', margin: '20px 0', background: '#0b1120', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(48,108,236,0.18)' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{editing.new ? 'New weekly review' : `Edit · ${weekLabel(form.week_start)}`}</span>
              <button onClick={() => setEditing(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#D8E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '170px 1fr', gap: 12 }}>
                <Field label="Week starting"><input type="date" className="wr-in" value={form.week_start} disabled={!editing.new} onChange={(e) => setForm((f) => ({ ...f, week_start: iso(mondayOf(e.target.value + 'T00:00:00')) }))} /></Field>
                <Field label="Headline"><input className="wr-in" value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="One-line summary of the week" /></Field>
              </div>
              {SECTIONS.map((sec) => (
                <ListField key={sec.key} label={sec.label} tint={sec.tint} items={form[sec.key]} placeholder={sec.ph} onChange={(v) => setForm((f) => ({ ...f, [sec.key]: v }))} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid rgba(48,108,236,0.18)' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'transparent', color: '#9DB8DD', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={15} /> Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .wr-in { width: 100%; box-sizing: border-box; background: var(--color-bg-tertiary, rgba(255,255,255,0.04)); border: 1px solid var(--color-border-subtle, rgba(48,108,236,0.16)); border-radius: 10px; padding: 9px 12px; font-size: 13.5px; color: var(--color-text-primary, #E2EEFF); font-family: inherit; outline: none; resize: vertical; line-height: 1.5; }
        .wr-in:focus { border-color: rgba(48,108,236,0.55); }
        .wr-in:disabled { opacity: 0.6; }
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

function ListField({ label, items, onChange, placeholder, tint }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: tint || 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 7 }}>
            <input className="wr-in" value={v} onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))} placeholder={`${placeholder}`} />
            <button onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [''])} style={{ width: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: '#8FB4E8', cursor: 'pointer' }}><X size={13} /></button>
          </div>
        ))}
        <button onClick={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.4)', background: 'transparent', color: '#7EB3FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={13} /> Add</button>
      </div>
    </div>
  );
}
