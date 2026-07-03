'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Target, Building2, Save, Copy, History,
  ChevronDown, Check, X,
} from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Modal from '@/components/ui/Modal';

// ── Static data ────────────────────────────────────────────────────────────────

const CRITERIA = [
  { id: 0,  title: 'Industry Focus',           icon: '🏭', inputType: 'industry-select',   description: 'Operates within a target industry (services, FMCG, real estate, agriculture)' },
  { id: 1,  title: 'Years in Operation',        icon: '📅', inputType: 'months-input',      description: 'At least 12 months of stable operating history' },
  { id: 2,  title: 'Revenue & Profitability',   icon: '💰', inputType: 'toggle',            description: 'Annual revenue, profit margin, EBITDA positive, positive earnings trend' },
  { id: 3,  title: 'Cash Flow Quality',         icon: '💧', inputType: 'toggle',            description: 'Recurring revenue, operating cash flow, seasonality, customer concentration' },
  { id: 4,  title: 'Legal & Tax Compliance',    icon: '⚖️', inputType: 'legal-checks',     description: 'Business registration, tax compliance, licenses/permits, no active disputes' },
  { id: 5,  title: 'Growth Potential',          icon: '📈', inputType: 'toggle',            description: 'Expansion opportunities, new products/locations, technology leverage' },
  { id: 6,  title: 'Management Capability',     icon: '👥', inputType: 'toggle',            description: 'Competent team, documented processes, limited owner-dependence' },
  { id: 7,  title: 'Market Position',           icon: '🎯', inputType: 'toggle',            description: 'Competitive advantage, brand strength, location, barriers to entry' },
  { id: 8,  title: 'Owner Motivation',          icon: '🤝', inputType: 'motivation-select', description: 'Reason for sale — indicates deal risk and transition quality' },
  { id: 9,  title: 'Investment Size & Returns', icon: '📊', inputType: 'toggle',            description: 'Purchase price, required capex, expected ROI, payback period' },
  { id: 10, title: 'Risk Assessment',           icon: '🛡️', inputType: 'toggle',           description: 'Financial, operational, regulatory, supplier, and competitive risks' },
];

const TARGET_INDUSTRIES = [
  { value: 'laundromat',  label: 'Laundromat' },
  { value: 'car-wash',    label: 'Car Wash' },
  { value: 'salon-spa',   label: 'Salon / Spa' },
  { value: 'restaurant',  label: 'Restaurant' },
  { value: 'water-center',label: 'Water Center' },
  { value: 'shortlet',    label: 'Shortlet / Short-stay Rental' },
  { value: 'land',        label: 'Land' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'other',       label: 'Other (not in target list)' },
];

const MOTIVATION_OPTIONS = [
  { value: 'retirement',  label: 'Retirement / Health',  score: 100 },
  { value: 'lifestyle',   label: 'Lifestyle Change',     score: 75  },
  { value: 'partnership', label: 'Partnership Breakup',  score: 75  },
  { value: 'unknown',     label: 'Unknown',              score: 50  },
  { value: 'struggling',  label: 'Business Struggling',  score: 0   },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(pct) {
  if (pct === null) return '#3D5A8A';
  if (pct >= 75) return '#16A36B';
  if (pct >= 50) return '#F5A623';
  return '#E0485A';
}

function scoreBg(pct) {
  if (pct === null) return 'rgba(48,108,236,0.08)';
  if (pct >= 75) return 'rgba(22,163,107,0.12)';
  if (pct >= 50) return 'rgba(245,166,35,0.12)';
  return 'rgba(224,72,90,0.12)';
}

function scoreLabel(pct, evaluated) {
  if (evaluated < 11) return 'Incomplete';
  if (pct >= 75) return 'Strong Candidate';
  if (pct >= 50) return 'Needs Review';
  return 'Does Not Qualify';
}

function deriveCriterionScore(id, { scores, industryValue, monthsInOp, legalChecks, ownerMotivation }) {
  switch (id) {
    case 0:
      if (!industryValue) return null;
      return industryValue === 'other' ? 0 : 100;
    case 1: {
      const m = parseInt(monthsInOp, 10);
      if (!monthsInOp || isNaN(m)) return null;
      if (m < 12) return 0;
      if (m < 24) return 50;
      return 100;
    }
    case 4: {
      const checked = Object.values(legalChecks).filter(Boolean).length;
      return Math.round((checked / 4) * 100);
    }
    case 8:
      if (!ownerMotivation) return null;
      return MOTIVATION_OPTIONS.find(o => o.value === ownerMotivation)?.score ?? null;
    default:
      return scores[id];
  }
}

// ── SVG dial ──────────────────────────────────────────────────────────────────

function ScoreDial({ pct, color }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(48,108,236,0.15)" strokeWidth={10} />
      <circle
        cx={65} cy={65} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .4s ease, stroke .3s ease' }}
      />
    </svg>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function AcquisitionContent() {
  const router = useRouter();
  const toast  = useToast();
  const { userProfile, activeAgencyId, agencies, theme } = useWorkspaceStore();
  const isLight = theme === 'light';

  // Business info
  const today = new Date().toISOString().split('T')[0];
  const [businessName,   setBusinessName]   = useState('');
  const [businessSector, setBusinessSector] = useState('');
  const [evalDate,       setEvalDate]       = useState(today);

  // Per-criterion toggles (null | 0 | 50 | 100)
  const initScores = Object.fromEntries(CRITERIA.map(c => [c.id, null]));
  const [scores, setScores] = useState(initScores);

  // Per-criterion notes
  const [notes,     setNotes]     = useState(Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
  const [notesOpen, setNotesOpen] = useState({});

  // Structured inputs
  const [industryValue,   setIndustryValue]   = useState('');
  const [monthsInOp,      setMonthsInOp]      = useState('');
  const [legalChecks,     setLegalChecks]     = useState({ registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
  const [ownerMotivation, setOwnerMotivation] = useState('');

  // UI
  const [savedEvals,  setSavedEvals]  = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [copying,     setCopying]     = useState(false);

  // ACR guard
  const isAcrAgency = useMemo(() =>
    !!(agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr')),
    [agencies, activeAgencyId]
  );

  // Storage key
  const storageKey = `ig-${activeAgencyId || 'guest'}-acq-evaluations`;

  // Load saved evals on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setSavedEvals(stored);
    } catch {}
  }, [storageKey]);

  // Derived scores (memoized)
  const derivedScores = useMemo(() =>
    Object.fromEntries(CRITERIA.map(c => [c.id, deriveCriterionScore(c.id, { scores, industryValue, monthsInOp, legalChecks, ownerMotivation })])),
    [scores, industryValue, monthsInOp, legalChecks, ownerMotivation]
  );

  const totalScore = useMemo(() => {
    const sum = CRITERIA.reduce((acc, c) => acc + (derivedScores[c.id] ?? 0), 0);
    return Math.round(sum / CRITERIA.length);
  }, [derivedScores]);

  const evaluatedCount = useMemo(() =>
    CRITERIA.filter(c => derivedScores[c.id] !== null).length,
    [derivedScores]
  );

  const dialColor = scoreColor(totalScore);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleToggle(id, val) {
    setScores(prev => ({ ...prev, [id]: prev[id] === val ? null : val }));
  }

  function handleSave() {
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      const evalObj = {
        id: crypto.randomUUID(),
        businessName: businessName.trim(),
        sector: businessSector,
        date: evalDate,
        agencyId: activeAgencyId || 'guest',
        scores: { ...Object.fromEntries(CRITERIA.map(c => [c.id, derivedScores[c.id]])) },
        notes: { ...notes },
        industryValue, monthsInOp, legalChecks: { ...legalChecks }, ownerMotivation,
        total: totalScore,
        evaluatedCount,
        savedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [...existing, evalObj];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setSavedEvals(updated);
      toast.success('Saved', `"${businessName}" evaluation saved.`);
    } catch {
      toast.error('Save Failed', 'Could not write to storage.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteEval(id) {
    try {
      const updated = savedEvals.filter(e => e.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setSavedEvals(updated);
    } catch {}
  }

  function handleLoadEval(ev) {
    setBusinessName(ev.businessName || '');
    setBusinessSector(ev.sector || '');
    setEvalDate(ev.date || today);
    const rawScores = {};
    CRITERIA.forEach(c => { rawScores[c.id] = null; });
    // Restore toggle scores for non-auto criteria
    [2,3,5,6,7,9,10].forEach(id => { rawScores[id] = ev.scores?.[id] ?? null; });
    setScores(rawScores);
    setNotes(ev.notes || Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
    setIndustryValue(ev.industryValue || '');
    setMonthsInOp(ev.monthsInOp || '');
    setLegalChecks(ev.legalChecks || { registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
    setOwnerMotivation(ev.ownerMotivation || '');
    setHistoryOpen(false);
  }

  function handleReset() {
    setBusinessName(''); setBusinessSector(''); setEvalDate(today);
    setScores(initScores); setNotes(Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
    setNotesOpen({}); setIndustryValue(''); setMonthsInOp('');
    setLegalChecks({ registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
    setOwnerMotivation('');
  }

  function handleCopy() {
    const lines = [
      'ACQUISITION EVALUATION SUMMARY',
      '================================',
      `Business : ${businessName || '(unnamed)'}`,
      `Sector   : ${businessSector || '—'}`,
      `Date     : ${evalDate}`,
      `Score    : ${totalScore}%  (${evaluatedCount}/11 criteria evaluated)`,
      `Result   : ${scoreLabel(totalScore, evaluatedCount)}`,
      '',
      'CRITERIA BREAKDOWN',
      '------------------',
      ...CRITERIA.map(c => {
        const s = derivedScores[c.id];
        const noteText = notes[c.id]?.trim() ? `\n         Note: ${notes[c.id].trim()}` : '';
        return `${String(c.id + 1).padStart(2, ' ')}. ${c.title}: ${s === null ? 'Not evaluated' : `${s}%`}${noteText}`;
      }),
      '',
      'Generated by ImpactGrid · Acquisition Evaluator',
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
      toast.success('Copied!', 'Summary copied to clipboard.');
    }).catch(() => toast.error('Copy Failed', 'Could not access clipboard.'));
  }

  // Colours for cards/UI that flip in light mode
  const bg        = isLight ? '#F5F7FF' : '#000';
  const cardBg    = isLight ? '#FFFFFF' : 'rgba(255,255,255,0.02)';
  const cardBdr   = isLight ? 'rgba(0,0,0,0.09)' : 'rgba(48,108,236,0.20)';
  const navBg     = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(0,0,0,0.96)';
  const navBdr    = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(48,108,236,0.18)';
  const txtPrim   = isLight ? '#0F1C38' : '#E2EEFF';
  const txtSec    = isLight ? '#7A8EB0' : '#3D5A8A';
  const txtLink   = isLight ? '#1A56D6' : '#7EB3FF';
  const inputBg   = isLight ? 'rgba(20,33,61,0.05)' : 'rgba(48,108,236,0.08)';
  const inputBdr  = isLight ? 'rgba(20,33,61,0.15)' : 'rgba(48,108,236,0.30)';
  const inputClr  = isLight ? '#0F1C38' : '#C8DEFF';
  const pillInact = isLight ? 'rgba(20,33,61,0.07)' : 'rgba(255,255,255,0.02)';

  // ── ACR guard ──────────────────────────────────────────────────────────────

  if (userProfile && !isAcrAgency) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, color: txtSec, gap: 16, fontFamily: 'var(--font-sans,system-ui)' }}>
        <Target size={48} style={{ opacity: 0.25, color: txtPrim }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: txtPrim }}>Acquisition Evaluator</div>
        <div style={{ fontSize: 14 }}>This tool is only available for the ACR Agency.</div>
        <button onClick={() => router.back()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 50, background: '#306CEC', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Go Back
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .acq-input {
          width:100%; background:${inputBg}; border:1.5px solid ${inputBdr};
          border-radius:10px; height:40px; padding:0 12px;
          font-size:13px; color:${inputClr}; font-family:inherit;
          box-sizing:border-box; transition:.15s; outline:none;
        }
        .acq-input::placeholder { color:rgba(148,180,255,0.35); }
        .acq-input:focus { border-color:rgba(91,155,255,0.80); box-shadow:0 0 0 3px rgba(48,108,236,0.15); }
        .acq-select {
          width:100%; background:${inputBg}; border:1.5px solid ${inputBdr};
          border-radius:10px; height:40px; padding:0 12px;
          font-size:13px; color:${inputClr}; font-family:inherit;
          cursor:pointer; transition:.15s; outline:none; appearance:none;
        }
        .acq-select:focus { border-color:rgba(91,155,255,0.80); box-shadow:0 0 0 3px rgba(48,108,236,0.15); }
        .acq-select option { background:${isLight ? '#fff' : '#0d1b38'}; color:${inputClr}; }
        .acq-label { font-size:10.5px; font-weight:700; color:${txtSec}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; display:block; }
        .acq-bar-fill { height:100%; border-radius:99px; transition:width .35s ease, background .3s; }
      `}</style>

      <div style={{ minHeight: '100dvh', background: bg, fontFamily: 'var(--font-sans,system-ui)', color: txtPrim }}>

        {/* ── Top bar ── */}
        <div style={{
          height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', borderBottom: `1px solid ${navBdr}`,
          background: navBg, backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#306CEC', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 7 }}>
              <ArrowLeft size={15} /> Back
            </button>
            <div style={{ width: 1, height: 18, background: isLight ? 'rgba(0,0,0,0.10)' : 'rgba(48,108,236,0.25)' }} />
            <Target size={16} style={{ color: '#5B9BFF' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: txtPrim }}>Acquisition Evaluator</span>
            {businessName && (
              <span style={{ fontSize: 12, color: txtLink, background: isLight ? 'rgba(48,108,236,0.08)' : 'rgba(48,108,236,0.12)', border: `1px solid ${isLight ? 'rgba(48,108,236,0.15)' : 'rgba(48,108,236,0.25)'}`, borderRadius: 6, padding: '2px 9px' }}>
                {businessName}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'none', border: `1px solid ${navBdr}`, borderRadius: 50, color: txtSec, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              <X size={12} /> Reset
            </button>
            <button onClick={() => setHistoryOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: isLight ? 'rgba(20,33,61,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${navBdr}`, borderRadius: 50, color: txtLink, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              <History size={13} /> History
              {savedEvals.length > 0 && (
                <span style={{ background: '#306CEC', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{savedEvals.length}</span>
              )}
            </button>
            <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: isLight ? 'rgba(20,33,61,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${navBdr}`, borderRadius: 50, color: txtLink, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              <Copy size={13} /> {copying ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleSave} disabled={saving || !businessName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px', background: businessName.trim() ? '#306CEC' : 'rgba(48,108,236,0.30)', border: 'none', borderRadius: 50, color: '#fff', cursor: businessName.trim() ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Two-column grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 370px', gap: 20, padding: '20px 20px 80px', maxWidth: 1380, margin: '0 auto', alignItems: 'start' }}>

          {/* LEFT: scrollable criteria stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Business info card */}
            <div style={{ background: cardBg, border: `1.5px solid ${isLight ? 'rgba(48,108,236,0.25)' : 'rgba(48,108,236,0.40)'}`, borderTop: `2px solid #306CEC`, borderRadius: 18, padding: '18px 22px', boxShadow: isLight ? '0 2px 12px rgba(20,33,61,0.07)' : '0 8px 32px rgba(0,0,0,0.40)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Building2 size={16} style={{ color: '#5B9BFF' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: txtPrim }}>Business Information</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="acq-label">Business Name *</label>
                  <input className="acq-input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Sunshine Laundromat" />
                </div>
                <div>
                  <label className="acq-label">Sector</label>
                  <input className="acq-input" value={businessSector} onChange={e => setBusinessSector(e.target.value)} placeholder="e.g. Laundromat" />
                </div>
                <div>
                  <label className="acq-label">Evaluation Date</label>
                  <input className="acq-input" type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Criterion cards */}
            {CRITERIA.map(c => {
              const s = derivedScores[c.id];
              const isAuto = ['industry-select','months-input','legal-checks','motivation-select'].includes(c.inputType);
              const borderColor = s === null
                ? cardBdr
                : s >= 75 ? 'rgba(22,163,107,0.35)'
                : s >= 50 ? 'rgba(245,166,35,0.30)'
                : 'rgba(224,72,90,0.28)';

              return (
                <div key={c.id} style={{ background: cardBg, border: `1.5px solid ${borderColor}`, borderRadius: 16, padding: '16px 18px', boxShadow: isLight ? '0 1px 6px rgba(20,33,61,0.06)' : '0 4px 16px rgba(0,0,0,0.30)', transition: 'border-color .2s' }}>

                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: isLight ? 'rgba(48,108,236,0.10)' : 'rgba(48,108,236,0.15)', border: `1px solid ${isLight ? 'rgba(48,108,236,0.20)' : 'rgba(48,108,236,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#306CEC', flexShrink: 0 }}>{c.id + 1}</span>
                      <span style={{ fontSize: 17 }}>{c.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: txtPrim }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: txtSec, marginTop: 1 }}>{c.description}</div>
                      </div>
                    </div>
                    {s !== null && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s), background: scoreBg(s), border: `1px solid ${scoreColor(s)}33`, borderRadius: 20, padding: '2px 10px', flexShrink: 0 }}>
                        {s}%
                      </span>
                    )}
                  </div>

                  {/* Toggle (for non-auto criteria) */}
                  {!isAuto && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {[
                        { val: 0,   emoji: '❌', label: 'Not Met',   col: '#E0485A', bg: 'rgba(224,72,90,0.12)',  bdr: 'rgba(224,72,90,0.35)' },
                        { val: 50,  emoji: '⚠️', label: 'Partial',   col: '#F5A623', bg: 'rgba(245,166,35,0.12)',bdr: 'rgba(245,166,35,0.35)' },
                        { val: 100, emoji: '✅', label: 'Fully Met', col: '#16A36B', bg: 'rgba(22,163,107,0.12)', bdr: 'rgba(22,163,107,0.35)' },
                      ].map(({ val, emoji, label, col, bg: pbg, bdr }) => (
                        <button
                          key={val}
                          onClick={() => handleToggle(c.id, val)}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                            border: `1.5px solid ${s === val ? bdr : isLight ? 'rgba(0,0,0,0.10)' : 'rgba(48,108,236,0.18)'}`,
                            background: s === val ? pbg : pillInact,
                            color: s === val ? col : txtSec,
                            fontSize: 12, fontWeight: s === val ? 700 : 500,
                            fontFamily: 'inherit', transition: 'all .15s',
                          }}
                        >
                          {emoji} {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Industry select */}
                  {c.inputType === 'industry-select' && (
                    <div style={{ position: 'relative' }}>
                      <select
                        className="acq-select"
                        value={industryValue}
                        onChange={e => {
                          setIndustryValue(e.target.value);
                          const found = TARGET_INDUSTRIES.find(i => i.value === e.target.value);
                          if (found && found.value !== 'other') setBusinessSector(found.label);
                        }}
                      >
                        <option value="">— Select industry —</option>
                        {TARGET_INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Months input */}
                  {c.inputType === 'months-input' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        className="acq-input"
                        type="number" min="0" placeholder="e.g. 24"
                        value={monthsInOp}
                        onChange={e => setMonthsInOp(e.target.value)}
                        style={{ width: 130 }}
                      />
                      <span style={{ fontSize: 12.5, color: txtSec }}>months in operation</span>
                      {monthsInOp && !isNaN(parseInt(monthsInOp, 10)) && (
                        <span style={{ fontSize: 11, color: '#5B9BFF' }}>
                          ({Math.floor(parseInt(monthsInOp, 10) / 12)}y {parseInt(monthsInOp, 10) % 12}m)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Legal checkboxes */}
                  {c.inputType === 'legal-checks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { key: 'registration',    label: 'Business registered with relevant authority' },
                        { key: 'taxCompliance',   label: 'Tax filings current and compliant' },
                        { key: 'licensesPermits', label: 'All required licenses and permits in place' },
                        { key: 'noDisputes',      label: 'No active legal disputes or litigation' },
                      ].map(({ key, label }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                          onClick={() => setLegalChecks(prev => ({ ...prev, [key]: !prev[key] }))}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `1.5px solid ${legalChecks[key] ? '#306CEC' : isLight ? 'rgba(0,0,0,0.18)' : 'rgba(48,108,236,0.35)'}`,
                            background: legalChecks[key] ? 'rgba(48,108,236,0.18)' : pillInact,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                          }}>
                            {legalChecks[key] && <Check size={11} color="#5B9BFF" />}
                          </div>
                          <span style={{ fontSize: 12.5, color: legalChecks[key] ? txtPrim : txtSec }}>{label}</span>
                        </label>
                      ))}
                      <div style={{ fontSize: 11, color: txtSec, marginTop: 2 }}>
                        {Object.values(legalChecks).filter(Boolean).length} / 4 checks passed
                      </div>
                    </div>
                  )}

                  {/* Owner motivation pills */}
                  {c.inputType === 'motivation-select' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {MOTIVATION_OPTIONS.map(({ value, label, score: ms }) => {
                        const active = ownerMotivation === value;
                        const col = scoreColor(ms);
                        return (
                          <button
                            key={value}
                            onClick={() => setOwnerMotivation(active ? '' : value)}
                            style={{
                              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                              border: `1.5px solid ${active ? col + '88' : isLight ? 'rgba(0,0,0,0.10)' : 'rgba(48,108,236,0.20)'}`,
                              background: active ? scoreBg(ms) : pillInact,
                              color: active ? col : txtSec,
                              fontSize: 12, fontWeight: active ? 700 : 500,
                              fontFamily: 'inherit', transition: 'all .15s',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Collapsible notes */}
                  <div style={{ marginTop: isAuto ? 12 : 0 }}>
                    <button
                      onClick={() => setNotesOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: notes[c.id] ? txtLink : txtSec, fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0 0', marginTop: 4 }}
                    >
                      <ChevronDown size={12} style={{ transform: notesOpen[c.id] ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                      {notes[c.id] ? `Notes (${notes[c.id].length} chars)` : 'Add notes'}
                    </button>
                    {notesOpen[c.id] && (
                      <textarea
                        value={notes[c.id]}
                        onChange={e => setNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Observations, red flags, context…"
                        rows={3}
                        style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', background: inputBg, border: `1.5px solid ${inputBdr}`, borderRadius: 10, padding: '10px 12px', color: inputClr, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: sticky score panel */}
          <div style={{ position: 'sticky', top: 70, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: cardBg, border: `1.5px solid ${isLight ? 'rgba(48,108,236,0.25)' : 'rgba(48,108,236,0.35)'}`, borderTop: `3px solid ${dialColor}`, borderRadius: 20, padding: '22px 18px', boxShadow: isLight ? '0 2px 16px rgba(20,33,61,0.09)' : '0 8px 32px rgba(0,0,0,0.50)' }}>

              {/* Dial */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 130, height: 130 }}>
                  <ScoreDial pct={totalScore} color={dialColor} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 30, fontWeight: 900, color: dialColor, lineHeight: 1 }}>{totalScore}%</span>
                    <span style={{ fontSize: 10, color: txtSec, letterSpacing: '.05em', textTransform: 'uppercase', marginTop: 3 }}>Score</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: dialColor, textAlign: 'center' }}>
                  {scoreLabel(totalScore, evaluatedCount)}
                </div>
                <div style={{ fontSize: 11, color: txtSec, marginTop: 4 }}>
                  {evaluatedCount} of 11 criteria evaluated
                </div>
              </div>

              {/* Per-criterion bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
                {CRITERIA.map(c => {
                  const s = derivedScores[c.id];
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: txtSec, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{c.icon}</span> {c.title}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s === null ? txtSec : scoreColor(s) }}>
                          {s === null ? '—' : `${s}%`}
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: isLight ? 'rgba(20,33,61,0.08)' : 'rgba(48,108,236,0.15)', overflow: 'hidden' }}>
                        <div className="acq-bar-fill" style={{ width: `${s ?? 0}%`, background: s === null ? 'transparent' : scoreColor(s) }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handleSave} disabled={!businessName.trim()} style={{ width: '100%', height: 42, background: businessName.trim() ? 'linear-gradient(135deg,#1E4FB8,#306CEC)' : 'rgba(48,108,236,0.28)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: businessName.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'opacity .15s' }}>
                  <Save size={14} /> Save Evaluation
                </button>
                <button onClick={handleCopy} style={{ width: '100%', height: 40, background: isLight ? 'rgba(20,33,61,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(48,108,236,0.25)'}`, borderRadius: 12, color: txtLink, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                  <Copy size={14} /> {copying ? 'Copied!' : 'Copy Summary'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── History modal ── */}
        <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Saved Evaluations" maxWidth="560px">
          {savedEvals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: txtSec, fontSize: 14 }}>
              No saved evaluations yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {[...savedEvals].reverse().map(ev => (
                <div key={ev.id} style={{ padding: '12px 16px', borderRadius: 12, background: isLight ? 'rgba(48,108,236,0.06)' : 'rgba(48,108,236,0.08)', border: `1px solid ${isLight ? 'rgba(48,108,236,0.15)' : 'rgba(48,108,236,0.20)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: txtPrim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.businessName}</div>
                    <div style={{ fontSize: 11, color: txtSec, marginTop: 3 }}>
                      {ev.sector && `${ev.sector} · `}{ev.date} · {ev.evaluatedCount}/11 evaluated
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(ev.total) }}>{ev.total}%</span>
                    <button onClick={() => handleLoadEval(ev)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid rgba(48,108,236,0.30)`, background: 'rgba(48,108,236,0.12)', color: '#7EB3FF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Load
                    </button>
                    <button onClick={() => handleDeleteEval(ev.id)} style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: 'rgba(224,72,90,0.10)', color: '#E0485A', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>

      </div>
    </>
  );
}

export default function AcquisitionPage() {
  return (
    <ToastProvider>
      <AcquisitionContent />
    </ToastProvider>
  );
}
