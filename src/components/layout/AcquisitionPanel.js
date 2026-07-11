'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target, Save, Copy, History, ChevronDown, Check, X, RefreshCw,
  Factory, Calendar, DollarSign, Droplets, Scale, TrendingUp,
  Users, Crosshair, UserCheck, BarChart3, ShieldAlert,
  AlertTriangle, CheckCircle2, Clock, Search, Filter, Plus, Pencil, Calculator,
  Undo2, Redo2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useUndoStore } from '@/lib/store/useUndoStore';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

// ── Static data ────────────────────────────────────────────────────────────────

const CRITERIA = [
  { id: 0,  title: 'Industry Focus',           short: 'Industry',    Icon: Factory,     inputType: 'industry-select',   desc: 'Operates within a target industry — services, FMCG, real estate, or agriculture' },
  { id: 1,  title: 'Years in Operation',        short: 'Operating age', Icon: Calendar,  inputType: 'months-input',      desc: 'At least 2 years of stable, documented operating history' },
  { id: 2,  title: 'Revenue & Profitability',   short: 'Revenue',     Icon: DollarSign,  inputType: 'financial-inputs',   desc: 'Enter revenue and total operating spend to calculate net profit and net margin' },
  { id: 3,  title: 'Cash Flow Quality',         short: 'Cash flow',   Icon: Droplets,    inputType: 'toggle',            desc: 'Recurring revenue, operating cash flow, seasonality, and customer concentration' },
  { id: 4,  title: 'Legal & Tax Compliance',    short: 'Compliance',  Icon: Scale,       inputType: 'legal-checks',      desc: 'Registration, tax compliance, licenses/permits, and no active disputes' },
  { id: 5,  title: 'Growth Potential',          short: 'Growth',      Icon: TrendingUp,  inputType: 'toggle',            desc: 'Expansion opportunities, new products/locations, technology leverage' },
  { id: 6,  title: 'Management Capability',     short: 'Management',  Icon: Users,       inputType: 'toggle',            desc: 'Competent team, documented processes, limited owner-dependence' },
  { id: 7,  title: 'Market Position',           short: 'Market',      Icon: Crosshair,   inputType: 'toggle',            desc: 'Competitive advantage, brand strength, location, and barriers to entry' },
  { id: 8,  title: 'Owner Motivation',          short: 'Motivation',  Icon: UserCheck,   inputType: 'motivation-select', desc: 'Reason for sale — indicates deal risk and transition quality' },
  { id: 9,  title: 'Investment Size & Returns', short: 'Returns',     Icon: BarChart3,   inputType: 'investment-inputs',  desc: 'Enter acquisition cost and monthly profit to calculate the payback period' },
  { id: 10, title: 'Risk Assessment',           short: 'Risk',        Icon: ShieldAlert, inputType: 'toggle',            desc: 'Financial, operational, regulatory, supplier, and competitive risks' },
];

const TARGET_INDUSTRIES = [
  { value: 'laundromat',   label: 'Laundromat' },
  { value: 'car-wash',     label: 'Car Wash' },
  { value: 'salon-spa',    label: 'Salon / Spa' },
  { value: 'restaurant',   label: 'Restaurant' },
  { value: 'water-center', label: 'Water Center' },
  { value: 'shortlet',     label: 'Shortlet / Short-stay Rental' },
  { value: 'land',         label: 'Land' },
  { value: 'agriculture',  label: 'Agriculture' },
  { value: 'other',        label: 'Other (not in target list)' },
];

// High-level business sectors for the header "Sector" dropdown
// (mirrors the Industry Focus criterion's target sectors).
const SECTORS = ['Agriculture', 'Real Estate', 'FMCG', 'Services'];

// Postgres rejects non-UUID ids / foreign keys with a 400. Old local evaluations
// can carry demo/mock evaluator ids, so we only ever send real UUIDs to the DB.
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const MOTIVATION_OPTIONS = [
  { value: 'retirement',  label: 'Retirement / Health',  score: 100 },
  { value: 'lifestyle',   label: 'Lifestyle Change',     score: 75  },
  { value: 'partnership', label: 'Partnership Breakup',  score: 75  },
  { value: 'unknown',     label: 'Unknown',              score: 50  },
  { value: 'struggling',  label: 'Business Struggling',  score: 0   },
];

const MONO = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)';

// Brand status tokens (validated ≥3:1 on dark surface; always paired with labels)
const SUCCESS = '#16A36B', WARNING = '#F5A623', ERROR = '#E0485A', ACCENT = '#306CEC';

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(pct) {
  if (pct === null || pct === undefined) return 'var(--color-text-muted)';
  if (pct >= 75) return SUCCESS;
  if (pct >= 50) return WARNING;
  return ERROR;
}

function bandLabel(pct) {
  if (pct === null || pct === undefined) return 'Not scored';
  if (pct >= 75) return 'Met';
  if (pct >= 50) return 'Partly met';
  return 'Not met';
}

function scoreLabel(pct, evaluated) {
  if (evaluated === 0) return 'Not started';
  if (evaluated < 11) return 'In progress';
  if (pct >= 75) return 'Strong Candidate';
  if (pct >= 50) return 'Needs Review';
  return 'Does Not Qualify';
}

function parseFinancialNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateRevenueMetrics(values = {}) {
  const revenue = parseFinancialNumber(values.revenue);
  const totalExpenses = parseFinancialNumber(values.totalExpenses);

  const netProfit = revenue !== null && totalExpenses !== null ? revenue - totalExpenses : null;
  const netMargin = revenue !== null && revenue !== 0 && netProfit !== null ? (netProfit / revenue) * 100 : null;

  const hasAllOperands = revenue !== null && totalExpenses !== null;
  const score = hasAllOperands && revenue !== 0
    ? (() => {
        if (netMargin === null || netMargin < 0) return 0;
        if (netMargin <= 25) return 25;
        if (netMargin <= 50) return 50;
        if (netMargin <= 75) return 75;
        return 100;
      })()
    : null;

  return { netProfit, netMargin, score };
}

function calculateInvestmentMetrics(values = {}) {
  const acquisitionCost = parseFinancialNumber(values.acquisitionCost);
  const monthlyProfit = parseFinancialNumber(values.monthlyProfit);

  const paybackMonths = acquisitionCost !== null && monthlyProfit !== null && monthlyProfit !== 0
    ? acquisitionCost / monthlyProfit
    : null;

  const score = paybackMonths !== null
    ? (paybackMonths <= 12 ? 100 : paybackMonths <= 24 ? 75 : paybackMonths <= 36 ? 50 : paybackMonths <= 48 ? 25 : 0)
    : null;

  return { paybackMonths, score };
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

// ── Valuation (SDE / earnings + asset approach) ─────────────────────────────────

const EMPTY_VALUATION = {
  // Income approach — SDE (earnings) multiple
  netProfit: '', ownerSalary: '', ownerPerks: '', oneOffs: '', depreciation: '', interest: '',
  multipleAuto: true, multiple: '',
  // Market approach — revenue multiple
  annualRevenue: '', revenueMultiple: '',
  // Income approach — discounted cash flow
  dcfCashFlow: '', dcfGrowth: '', dcfDiscount: '', dcfYears: '', dcfTerminal: '',
  // Asset approach — net assets
  assets: '', liabilities: '',
};

const SDE_FIELDS = [
  { key: 'netProfit',    label: 'Net profit (yearly)' },
  { key: 'ownerSalary',  label: "Owner's salary" },
  { key: 'ownerPerks',   label: "Owner's perks / benefits" },
  { key: 'oneOffs',      label: 'One-off / non-recurring costs' },
  { key: 'depreciation', label: 'Depreciation & amortization' },
  { key: 'interest',     label: 'Interest paid' },
];

function clampNum(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Small owner-operated businesses trade ~1.5×–3.0× SDE; a stronger evaluation → higher multiple
function suggestMultiple(score) {
  return Math.round((1.5 + (clampNum(score ?? 0, 0, 100) / 100) * 1.5) * 10) / 10;
}

function calculateValuation(v = {}, { score = 0, monthlyProfit = null } = {}) {
  const n = (x) => parseFinancialNumber(x) ?? 0;
  const num = (x) => parseFinancialNumber(x);

  // ── Income approach: SDE (earnings) multiple ──
  const earningKeys = ['netProfit', 'ownerSalary', 'ownerPerks', 'oneOffs', 'depreciation', 'interest'];
  const anyEarnings = earningKeys.some(k => num(v[k]) !== null);
  const sde = anyEarnings ? earningKeys.reduce((a, k) => a + n(v[k]), 0) : null;
  const suggested = suggestMultiple(score);
  const manual = num(v.multiple);
  const multiple = v.multipleAuto === false && manual !== null && manual > 0 ? manual : suggested;
  const incomeValue = sde !== null && sde > 0 ? Math.round(sde * multiple) : null;

  // ── Market approach: revenue multiple ──
  const annualRevenue = num(v.annualRevenue);
  const revenueMultiple = num(v.revenueMultiple) !== null && num(v.revenueMultiple) > 0 ? num(v.revenueMultiple) : 1.0;
  const marketValue = annualRevenue !== null && annualRevenue > 0 ? Math.round(annualRevenue * revenueMultiple) : null;

  // ── Income approach: discounted cash flow ──
  const cf0 = num(v.dcfCashFlow) !== null ? num(v.dcfCashFlow) : sde;
  const dcfGrowthPct   = num(v.dcfGrowth)   !== null ? num(v.dcfGrowth)   : 5;
  const dcfDiscountPct = num(v.dcfDiscount) !== null ? num(v.dcfDiscount) : 25;
  const dcfYears       = Math.max(1, Math.min(10, Math.round(num(v.dcfYears) !== null ? num(v.dcfYears) : 5)));
  const dcfTerminal    = num(v.dcfTerminal) !== null && num(v.dcfTerminal) > 0 ? num(v.dcfTerminal) : multiple;
  let dcfValue = null;
  if (cf0 !== null && cf0 > 0 && dcfDiscountPct > 0) {
    const g = dcfGrowthPct / 100, r = dcfDiscountPct / 100;
    let pv = 0;
    for (let t = 1; t <= dcfYears; t++) {
      const cft = cf0 * Math.pow(1 + g, t - 1);
      pv += cft / Math.pow(1 + r, t);
    }
    const finalCF = cf0 * Math.pow(1 + g, dcfYears - 1);
    pv += (finalCF * dcfTerminal) / Math.pow(1 + r, dcfYears);
    dcfValue = Math.round(pv);
  }

  // ── Asset approach: net assets ──
  const hasAssets = num(v.assets) !== null || num(v.liabilities) !== null;
  const netAssetValue = hasAssets ? n(v.assets) - n(v.liabilities) : null;

  // ── Reconcile ──
  const methods = [
    { key: 'earnings', label: 'Earnings (SDE)',   value: incomeValue },
    { key: 'revenue',  label: 'Revenue multiple', value: marketValue },
    { key: 'dcf',      label: 'Cash flow (DCF)',  value: dcfValue },
    { key: 'asset',    label: 'Net assets',       value: netAssetValue },
  ];
  const vals = methods.map(m => m.value).filter(x => x !== null);
  const rangeLow  = vals.length ? Math.min(...vals) : null;
  const rangeHigh = vals.length ? Math.max(...vals) : null;

  // Recommended: earnings first (best for owner-run SMEs), then DCF, market, assets — floored at net assets
  let recommended = incomeValue ?? dcfValue ?? marketValue ?? netAssetValue;
  if (recommended !== null && netAssetValue !== null) recommended = Math.max(recommended, netAssetValue);

  let offerLow = null, offerHigh = null;
  if (recommended !== null) {
    if (incomeValue !== null && recommended === incomeValue) {
      const lowMult = Math.max(1.5, Math.round((multiple - 0.5) * 10) / 10);
      offerLow = Math.round(sde * lowMult);
    } else {
      offerLow = Math.round(recommended * 0.9);
    }
    offerHigh = recommended;
  }

  const impliedPaybackMonths = recommended !== null && monthlyProfit && monthlyProfit > 0
    ? recommended / monthlyProfit : null;

  return {
    sde, suggested, multiple, incomeValue,
    annualRevenue, revenueMultiple, marketValue,
    cf0, dcfGrowthPct, dcfDiscountPct, dcfYears, dcfTerminal, dcfValue,
    netAssetValue,
    methods, rangeLow, rangeHigh,
    recommended, estWorth: recommended, offerLow, offerHigh, impliedPaybackMonths,
  };
}

function deriveCriterionScore(id, { scores, industryValue, monthsInOp, legalChecks, customLegalItems = [], ownerMotivation, customMotivations = [], revenueMetrics, investmentMetrics }) {
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
    case 2: {
      const metrics = calculateRevenueMetrics(revenueMetrics);
      return metrics.score;
    }
    case 9: {
      const metrics = calculateInvestmentMetrics(investmentMetrics);
      return metrics.score;
    }
    case 4: {
      const checkedDefaults = Object.values(legalChecks).filter(Boolean).length;
      const checkedCustom   = customLegalItems.filter(i => i.checked).length;
      const total           = 4 + customLegalItems.length;
      return total === 0 ? 0 : Math.round(((checkedDefaults + checkedCustom) / total) * 100);
    }
    case 8:
      if (!ownerMotivation) return null;
      return [...MOTIVATION_OPTIONS, ...customMotivations].find(o => o.value === ownerMotivation)?.score ?? null;
    default:
      return scores[id];
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Chart pieces ───────────────────────────────────────────────────────────────

// Segmented donut (part-to-whole of the 11 criteria) with surface gaps
function SegDonut({ segments, size = 168, stroke = 17, empty }) {
  const r     = (size / 2) - stroke;
  const circ  = 2 * Math.PI * r;
  const cx    = size / 2, cy = size / 2;
  const total = segments.reduce((a, s) => a + s.n, 0);
  const gap   = 3; // px surface gap between segments
  const live  = segments.filter(s => s.n > 0);

  if (total === 0 || live.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={empty} strokeWidth={stroke}/>
      </svg>
    );
  }

  const arcs = [];
  let offset = 0;
  for (const s of live) {
    const frac = s.n / total;
    arcs.push({ key: s.key, col: s.col, len: Math.max(frac * circ - (live.length > 1 ? gap : 0), 2), offset });
    offset += frac * circ;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)', display:'block' }}>
      {arcs.map(a => (
        <circle key={a.key} cx={cx} cy={cy} r={r} fill="none" stroke={a.col} strokeWidth={stroke}
          strokeDasharray={`${a.len} ${circ - a.len}`} strokeDashoffset={-a.offset}
          strokeLinecap={live.length > 1 ? 'butt' : 'round'}
          style={{ transition:'stroke-dasharray .4s ease, stroke-dashoffset .4s ease' }}/>
      ))}
    </svg>
  );
}

// Evaluator identity: avatar (or initial) + name
function EvaluatorChip({ name, avatar }) {
  return (
    <span style={{ display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" style={{ width:22, height:22, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
      ) : (
        <span style={{ width:22, height:22, borderRadius:'50%', background:'var(--color-accent-primary-subtle)', border:'1px solid var(--color-border)', color:'var(--color-text-link)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span style={{ fontSize:12, color:'var(--color-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name || '—'}</span>
    </span>
  );
}

// Money input with a KES prefix
function VMoney({ label, value, onChange, placeholder = '0' }) {
  return (
    <div>
      <label className="acqp-lbl">{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-text-tertiary)', pointerEvents: 'none', fontWeight: 600 }}>KES</span>
        <input className="acqp-input" type="number" inputMode="decimal" step="0.01" placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} style={{ paddingLeft: 42 }}/>
      </div>
    </div>
  );
}

// Plain number input with optional suffix (%, ×, yrs)
function VNum({ label, value, onChange, placeholder = '', suffix, step = '0.1' }) {
  return (
    <div>
      <label className="acqp-lbl">{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="acqp-input" type="number" step={step} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} style={suffix ? { paddingRight: 34 } : undefined}/>
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </div>
  );
}

// One valuation-method card with its own live estimate in the header
function MethodCard({ title, subtitle, value, children }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 13 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>Estimate</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: value != null ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{value != null ? formatCurrency(value) : '—'}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function AcquisitionPanel() {
  const toast = useToast();
  const { userProfile, activeAgencyId, agencies, setCurrentPage, theme } = useWorkspaceStore();
  const isLight = theme === 'light';

  const today = new Date().toISOString().split('T')[0];
  const initScores = Object.fromEntries(CRITERIA.map(c => [c.id, null]));

  const [businessName,    setBusinessName]    = useState('');
  const [businessSector,  setBusinessSector]  = useState('');
  const [evalDate,        setEvalDate]        = useState(today);
  const [scores,          setScores]          = useState(initScores);
  const [notes,           setNotes]           = useState(Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
  const [notesOpen,       setNotesOpen]       = useState({});
  const [industryValue,   setIndustryValue]   = useState('');
  const [monthsInOp,      setMonthsInOp]      = useState('');
  const [opUnit,          setOpUnit]          = useState('months'); // how the operating-age input is entered: 'months' | 'years'
  const [legalChecks,     setLegalChecks]     = useState({ registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
  const [customLegalItems, setCustomLegalItems] = useState([]); // [{ id, label, checked }]
  const [newLegalLabel,   setNewLegalLabel]   = useState('');
  const [ownerMotivation, setOwnerMotivation] = useState('');
  const [customMotivations, setCustomMotivations] = useState([]); // [{ value, label, score, custom }]
  const [newMotivationLabel, setNewMotivationLabel] = useState('');
  const [newMotivationScore, setNewMotivationScore] = useState(75);
  const [revenueMetrics,  setRevenueMetrics]  = useState({ revenue: '', totalExpenses: '' });
  const [investmentMetrics, setInvestmentMetrics] = useState({ acquisitionCost: '', monthlyProfit: '' });
  const [valuation,       setValuation]       = useState(EMPTY_VALUATION);
  const [valuationOpen,   setValuationOpen]   = useState(false);
  const [savedEvals,      setSavedEvals]      = useState([]);
  const [editingEvalId,   setEditingEvalId]   = useState(null); // id of the evaluation being edited (null = new)
  const [undoStack,       setUndoStack]       = useState([]);   // op-log entries: { id, before, after }
  const [redoStack,       setRedoStack]       = useState([]);
  const [localToImport,   setLocalToImport]   = useState([]);   // old browser-local evals waiting to auto-sync
  const [importFailed,    setImportFailed]    = useState(false); // auto-sync errored → show a manual retry
  const [viewedEvalId,    setViewedEvalId]    = useState(null); // business selected from the table to view
  const [historyOpen,     setHistoryOpen]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [copying,         setCopying]         = useState(false);
  const [tip,             setTip]             = useState(null); // { x, y, title, lines: [] }
  const [tableSearch,     setTableSearch]     = useState('');
  const [tableFilter,     setTableFilter]     = useState('all'); // all | strong | review | fail
  const [formOpen,        setFormOpen]        = useState(false); // evaluation form modal
  const panelRef = useRef(null);

  const isAcrAgency = useMemo(() =>
    !!(agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr')),
    [agencies, activeAgencyId]
  );

  const legacyKey      = `ig-${activeAgencyId || 'guest'}-acq-evaluations`;
  const historyUndoKey = `ig-${activeAgencyId || 'guest'}-acq-hist-undo`;
  const historyRedoKey = `ig-${activeAgencyId || 'guest'}-acq-hist-redo`;

  // Load the agency's shared evaluations from Supabase and subscribe to realtime
  // changes so every member sees saves / edits / deletes as they happen.
  useEffect(() => {
    let cancelled = false;
    const sb = createClient();
    const load = async () => {
      const evs = await fetchEvals(sb);
      if (!cancelled) setSavedEvals(evs);
    };

    // Synchronous localStorage reads (legacy import + saved history) in a rAF so
    // the effect body itself stays side-effect-free.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        // Scan EVERY local "…-acq-evaluations" key (not just the current agency's),
        // so previously-saved evaluations are found even if the agency key differs now.
        const seen = new Set();
        const found = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.endsWith('-acq-evaluations')) continue;
          const arr = JSON.parse(localStorage.getItem(k) || '[]');
          if (Array.isArray(arr)) arr.forEach(ev => { if (ev?.id && !seen.has(ev.id)) { seen.add(ev.id); found.push(ev); } });
        }
        setLocalToImport(found);
      } catch { setLocalToImport([]); }
      try {
        setUndoStack(JSON.parse(localStorage.getItem(historyUndoKey) || '[]'));
        setRedoStack(JSON.parse(localStorage.getItem(historyRedoKey) || '[]'));
      } catch { setUndoStack([]); setRedoStack([]); }
      if (!activeAgencyId) setSavedEvals([]);
    });

    let ch = null;
    if (activeAgencyId) {
      load();
      ch = sb.channel(`acq:${activeAgencyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'acquisition_evaluations', filter: `agency_id=eq.${activeAgencyId}` }, () => { load(); })
        .subscribe();
    }
    return () => { cancelled = true; cancelAnimationFrame(raf); if (ch) sb.removeChannel(ch); };
  }, [activeAgencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const derivedScores = useMemo(() =>
    Object.fromEntries(CRITERIA.map(c => [c.id, deriveCriterionScore(c.id, { scores, industryValue, monthsInOp, legalChecks, customLegalItems, ownerMotivation, customMotivations, revenueMetrics, investmentMetrics })])),
    [scores, industryValue, monthsInOp, legalChecks, customLegalItems, ownerMotivation, customMotivations, revenueMetrics, investmentMetrics]
  );

  const totalScore = useMemo(() =>
    Math.round(CRITERIA.reduce((a, c) => a + (derivedScores[c.id] ?? 0), 0) / CRITERIA.length),
    [derivedScores]
  );

  const evaluatedCount = useMemo(() =>
    CRITERIA.filter(c => derivedScores[c.id] !== null).length,
    [derivedScores]
  );

  const dist = useMemo(() => {
    let strong = 0, partial = 0, weak = 0, pending = 0;
    CRITERIA.forEach(c => {
      const s = derivedScores[c.id];
      if (s === null) pending++;
      else if (s >= 75) strong++;
      else if (s >= 50) partial++;
      else weak++;
    });
    return { strong, partial, weak, pending };
  }, [derivedScores]);

  const started   = evaluatedCount > 0;
  const dialColor = started ? scoreColor(totalScore) : 'var(--color-text-muted)';

  // Best saved candidate: highest score → most criteria answered → most recent
  const bestEval = useMemo(() => {
    if (!savedEvals.length) return null;
    return [...savedEvals].sort((a, b) =>
      (b.total - a.total)
      || ((b.evaluatedCount || 0) - (a.evaluatedCount || 0))
      || (new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    )[0];
  }, [savedEvals]);

  // A business explicitly selected from the table (view its evaluation)
  const viewedEval = useMemo(
    () => (viewedEvalId ? savedEvals.find(e => e.id === viewedEvalId) || null : null),
    [viewedEvalId, savedEvals]
  );

  // Has the user meaningfully started a draft? (legal criterion auto-scores, so
  // evaluatedCount alone is not a reliable signal of "started".)
  const hasDraft =
    businessName.trim() !== '' ||
    Object.values(scores).some(v => v !== null) ||
    industryValue !== '' || monthsInOp !== '' || ownerMotivation !== '' ||
    Object.values(legalChecks).some(Boolean) ||
    customLegalItems.length > 0 || customMotivations.length > 0 ||
    revenueMetrics.revenue !== '' || revenueMetrics.totalExpenses !== '' ||
    investmentMetrics.acquisitionCost !== '' || investmentMetrics.monthlyProfit !== '';

  // Snapshot source: a business picked from the table wins; else the live draft
  // while editing; else the best saved candidate by default; else empty.
  const snapSource = viewedEval ? 'viewed' : hasDraft ? 'draft' : bestEval ? 'best' : 'empty';
  const snapEval   = snapSource === 'viewed' ? viewedEval : snapSource === 'best' ? bestEval : null;
  const showBest   = snapSource === 'best';

  const snapScores = useMemo(
    () => (snapEval ? (snapEval.scores || {}) : derivedScores),
    [snapEval, derivedScores]
  );
  const snapTotal     = snapEval ? snapEval.total : totalScore;
  const snapEvaluated = snapEval ? (snapEval.evaluatedCount || 0) : evaluatedCount;
  const snapName      = snapEval ? snapEval.businessName : (businessName.trim() || null);
  const snapNotes     = snapEval ? (snapEval.notes || {}) : notes;
  const snapStarted   = snapEval ? true : started;
  const snapColor     = snapStarted ? scoreColor(snapTotal) : 'var(--color-text-muted)';
  const snapDist = useMemo(() => {
    let strong = 0, partial = 0, weak = 0, pending = 0;
    CRITERIA.forEach(c => {
      const s = snapScores[c.id];
      if (s === null || s === undefined) pending++;
      else if (s >= 75) strong++;
      else if (s >= 50) partial++;
      else weak++;
    });
    return { strong, partial, weak, pending };
  }, [snapScores]);

  const valuationResult = useMemo(
    () => calculateValuation(valuation, { score: totalScore, monthlyProfit: parseFinancialNumber(investmentMetrics.monthlyProfit) }),
    [valuation, totalScore, investmentMetrics]
  );

  // Open valuation, pre-filling figures from the evaluation where still blank
  function openValuation() {
    setValuation(prev => {
      const next = { ...prev };
      const rev = parseFinancialNumber(revenueMetrics.revenue);
      const exp = parseFinancialNumber(revenueMetrics.totalExpenses);
      const netProfit = rev !== null && exp !== null ? rev - exp : null;
      if (next.netProfit === '' && netProfit !== null) next.netProfit = String(netProfit);
      if (next.annualRevenue === '' && rev !== null) next.annualRevenue = String(rev);
      if (next.dcfCashFlow === '' && netProfit !== null) next.dcfCashFlow = String(netProfit);
      return next;
    });
    setValuationOpen(true);
  }

  // Recent-evaluations table: newest first, searchable, filterable by verdict band
  const tableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return [...savedEvals]
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
      .filter(ev => {
        if (q && !(`${ev.businessName} ${ev.sector || ''}`.toLowerCase().includes(q))) return false;
        if (tableFilter === 'strong') return ev.total >= 75;
        if (tableFilter === 'review') return ev.total >= 50 && ev.total < 75;
        if (tableFilter === 'fail')   return ev.total < 50;
        return true;
      });
  }, [savedEvals, tableSearch, tableFilter]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleToggle(id, val) {
    setScores(prev => ({ ...prev, [id]: prev[id] === val ? null : val }));
  }

  // ── Shared evaluations (Supabase) + undo history ────────────────────────────
  async function fetchEvals(sb) {
    if (!activeAgencyId) return [];
    const { data, error } = await sb.from('acquisition_evaluations')
      .select('id, data').eq('agency_id', activeAgencyId)
      .order('created_at', { ascending: true });
    if (error) console.error('[acq] load failed:', error);
    return (data || []).map(r => ({ ...(r.data || {}), id: r.id }));
  }

  function persistHistory(undo, redo) {
    try {
      localStorage.setItem(historyUndoKey, JSON.stringify(undo.slice(-50)));
      localStorage.setItem(historyRedoKey, JSON.stringify(redo.slice(-50)));
    } catch {}
  }

  // Apply a single-evaluation change to the shared space + local list.
  //   value = object → create/replace that evaluation; value = null → delete it.
  function applyEvalChange(id, value) {
    const sb = createClient();
    if (value == null) {
      setSavedEvals(prev => prev.filter(e => e.id !== id));
      sb.from('acquisition_evaluations').delete().eq('id', id)
        .then(({ error }) => { if (error) { console.error('[acq] delete failed:', error); toast.error('Sync failed', error.message || 'That change may not be saved for the team.'); } });
    } else if (!activeAgencyId) {
      toast.error('No agency', 'Open an agency workspace before saving.');
    } else {
      setSavedEvals(prev => (prev.some(e => e.id === id) ? prev.map(e => (e.id === id ? value : e)) : [...prev, value]));
      const row = {
        id, agency_id: activeAgencyId,
        // created_by is DB attribution only; the display author lives in data.evaluator.
        created_by: isUuid(userProfile?.id) ? userProfile.id : null,
        data: value, updated_at: new Date().toISOString(),
      };
      sb.from('acquisition_evaluations').upsert(row)
        .then(({ error }) => { if (error) { console.error('[acq] upsert failed:', error, 'row:', { id: row.id, agency_id: row.agency_id, created_by: row.created_by }); toast.error('Sync failed', error.message || 'That change may not be saved for the team.'); } });
    }
  }

  function pushHistory(entry) {
    const nextUndo = [...undoStack, entry].slice(-50);
    setUndoStack(nextUndo);
    setRedoStack([]);
    persistHistory(nextUndo, []);
  }

  function undoEvals() {
    if (!undoStack.length) return;
    const entry = undoStack[undoStack.length - 1];
    const nextUndo = undoStack.slice(0, -1);
    const nextRedo = [...redoStack, entry].slice(-50);
    setUndoStack(nextUndo); setRedoStack(nextRedo);
    persistHistory(nextUndo, nextRedo);
    applyEvalChange(entry.id, entry.before);          // revert to how it was before the change
    if (entry.before == null && viewedEvalId === entry.id) setViewedEvalId(null);
  }

  function redoEvals() {
    if (!redoStack.length) return;
    const entry = redoStack[redoStack.length - 1];
    const nextRedo = redoStack.slice(0, -1);
    const nextUndo = [...undoStack, entry].slice(-50);
    setRedoStack(nextRedo); setUndoStack(nextUndo);
    persistHistory(nextUndo, nextRedo);
    applyEvalChange(entry.id, entry.after);           // re-apply the change
    if (entry.after == null && viewedEvalId === entry.id) setViewedEvalId(null);
  }

  // One-off: move any old browser-local evaluations into the shared agency space.
  function importLocalEvals() {
    if (!activeAgencyId || !localToImport.length) return;
    const sb = createClient();
    const rows = localToImport.map(ev => {
      const id = isUuid(ev.id) ? ev.id : crypto.randomUUID();
      return {
        id,
        agency_id: activeAgencyId,
        created_by: isUuid(userProfile?.id) ? userProfile.id : null,
        data: { ...ev, id }, updated_at: new Date().toISOString(),
      };
    });
    sb.from('acquisition_evaluations').upsert(rows).then(async ({ error }) => {
      if (error) { console.error('[acq] import failed:', error, 'agency_id:', activeAgencyId, 'rows:', rows.length); setImportFailed(true); toast.error('Sync failed', error.message || 'Could not sync your local evaluations.'); return; }
      // Clear every local "…-acq-evaluations" key now that they live in the shared space.
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.endsWith('-acq-evaluations')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
      setImportFailed(false);
      setLocalToImport([]);
      const evs = await fetchEvals(sb); setSavedEvals(evs);
      toast.success('Synced', `${rows.length} local evaluation(s) added to the shared space.`);
    });
  }

  // Auto-sync any browser-local evaluations into the shared space (no click needed).
  useEffect(() => {
    if (!activeAgencyId || !localToImport.length || importFailed) return;
    importLocalEvals();
  }, [activeAgencyId, localToImport, importFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Let the top-bar Undo/Redo buttons drive evaluation history while this panel is open.
  useEffect(() => {
    useUndoStore.getState().setController({
      undo: undoEvals,
      redo: redoEvals,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    });
    return () => useUndoStore.getState().clearController();
  }, [undoStack, redoStack]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!businessName.trim()) return;
    if (!activeAgencyId) { toast.error('No agency', 'Open an agency workspace to save evaluations.'); return; }
    setSaving(true);
    try {
      // Reuse the existing id when editing so the original record is replaced, not duplicated.
      const id = editingEvalId || crypto.randomUUID();
      const existing = editingEvalId ? savedEvals.find(e => e.id === editingEvalId) : null;
      const obj = {
        id,
        businessName: businessName.trim(), sector: businessSector, date: evalDate,
        agencyId: activeAgencyId,
        evaluator: existing?.evaluator || {
          id: userProfile?.id || null,
          name: userProfile?.full_name || userProfile?.email || 'Guest',
          avatar: userProfile?.avatar_url || null,
        },
        scores: Object.fromEntries(CRITERIA.map(c => [c.id, derivedScores[c.id]])),
        notes: { ...notes }, industryValue, monthsInOp,
        legalChecks: { ...legalChecks }, customLegalItems: customLegalItems.map(i => ({ ...i })),
        ownerMotivation, customMotivations: customMotivations.map(m => ({ ...m })),
        revenueMetrics, investmentMetrics, valuation: { ...valuation },
        total: totalScore, evaluatedCount,
        createdAt: existing?.createdAt || existing?.savedAt || new Date().toISOString(),
        savedAt: new Date().toISOString(),
      };
      pushHistory({ id, before: existing || null, after: obj });
      applyEvalChange(id, obj);
      setViewedEvalId(id);       // show the just-saved business on the dashboard
      setEditingEvalId(null);    // back to "new" mode
      toast.success(editingEvalId ? 'Updated' : 'Saved', `"${businessName}" evaluation ${editingEvalId ? 'updated' : 'saved'} for the whole agency.`);
      setFormOpen(false);
    } catch { toast.error('Save Failed', 'Could not save the evaluation.'); }
    finally   { setSaving(false); }
  }

  function handleDeleteEval(id) {
    const target = savedEvals.find(e => e.id === id);
    if (!target) return;
    pushHistory({ id, before: target, after: null });
    applyEvalChange(id, null);
    if (viewedEvalId === id) setViewedEvalId(null);
    if (editingEvalId === id) setEditingEvalId(null);
    toast.info?.('Deleted', `"${target.businessName}" removed — use Undo to restore.`);
  }

  function handleLoadEval(ev) {
    setBusinessName(ev.businessName || ''); setBusinessSector(ev.sector || '');
    setEvalDate(ev.date || today);
    const raw = Object.fromEntries(CRITERIA.map(c => [c.id, null]));
    [2,3,5,6,7,9,10].forEach(id => { raw[id] = ev.scores?.[id] ?? null; });
    setScores(raw);
    setNotes(ev.notes || Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
    setIndustryValue(ev.industryValue || ''); setMonthsInOp(ev.monthsInOp || '');
    setLegalChecks(ev.legalChecks || { registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
    setCustomLegalItems(Array.isArray(ev.customLegalItems) ? ev.customLegalItems.map(i => ({ ...i })) : []);
    setOwnerMotivation(ev.ownerMotivation || '');
    setCustomMotivations(Array.isArray(ev.customMotivations) ? ev.customMotivations.map(m => ({ ...m })) : []);
    setRevenueMetrics(ev.revenueMetrics || { revenue: '', totalExpenses: '' });
    setInvestmentMetrics(ev.investmentMetrics || { acquisitionCost: '', monthlyProfit: '' });
    setValuation(ev.valuation ? { ...EMPTY_VALUATION, ...ev.valuation } : EMPTY_VALUATION);
    setEditingEvalId(ev.id); // saving will REPLACE this record, not create a duplicate
    setViewedEvalId(null);
    setHistoryOpen(false);
    setFormOpen(true);
  }

  // Open a blank form for a brand-new evaluation.
  function startNewEvaluation() {
    handleReset();
    setFormOpen(true);
  }

  function handleReset() {
    setBusinessName(''); setBusinessSector(''); setEvalDate(today);
    setScores(initScores);
    setNotes(Object.fromEntries(CRITERIA.map(c => [c.id, ''])));
    setNotesOpen({}); setIndustryValue(''); setMonthsInOp(''); setOpUnit('months');
    setLegalChecks({ registration: false, taxCompliance: false, licensesPermits: false, noDisputes: false });
    setCustomLegalItems([]); setNewLegalLabel('');
    setOwnerMotivation('');
    setCustomMotivations([]); setNewMotivationLabel(''); setNewMotivationScore(75);
    setRevenueMetrics({ revenue: '', totalExpenses: '' });
    setInvestmentMetrics({ acquisitionCost: '', monthlyProfit: '' });
    setValuation(EMPTY_VALUATION);
    setViewedEvalId(null);
    setEditingEvalId(null);
  }

  function handleCopy() {
    const lines = [
      'ACQUISITION EVALUATION SUMMARY', '================================',
      `Business : ${businessName || '(unnamed)'}`, `Sector   : ${businessSector || '—'}`,
      `Date     : ${evalDate}`,
      `Score    : ${totalScore}%  (${evaluatedCount}/11 criteria evaluated)`,
      `Result   : ${scoreLabel(totalScore, evaluatedCount)}`, '',
      'CRITERIA BREAKDOWN', '------------------',
      ...CRITERIA.map(c => {
        const s = derivedScores[c.id];
        const n = notes[c.id]?.trim() ? `\n         Note: ${notes[c.id].trim()}` : '';
        return `${String(c.id + 1).padStart(2, '0')}. ${c.title}: ${s === null ? 'Not evaluated' : `${s}%`}${n}`;
      }),
    ];
    const val = calculateValuation(valuation, { score: totalScore, monthlyProfit: parseFinancialNumber(investmentMetrics.monthlyProfit) });
    if (val.recommended !== null) {
      lines.push('', 'VALUATION', '---------',
        `Earnings (SDE ${val.multiple}x) : ${val.incomeValue !== null ? formatCurrency(val.incomeValue) : 'n/a'}`,
        `Revenue multiple        : ${val.marketValue !== null ? formatCurrency(val.marketValue) : 'n/a'}`,
        `Discounted cash flow     : ${val.dcfValue !== null ? formatCurrency(val.dcfValue) : 'n/a'}`,
        `Net assets               : ${val.netAssetValue !== null ? formatCurrency(val.netAssetValue) : 'n/a'}`,
        `Recommended estimate     : ${formatCurrency(val.recommended)}`,
        `Suggested offer          : ${formatCurrency(val.offerLow)} – ${formatCurrency(val.offerHigh)}`,
      );
    }
    lines.push('', 'Generated by ImpactGrid · ACR Acquisition Evaluator');
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => { setCopying(true); setTimeout(() => setCopying(false), 2200); toast.success('Copied!', 'Summary copied to clipboard.'); })
      .catch(() => toast.error('Copy Failed', 'Could not access clipboard.'));
  }

  // Tooltip helpers — position relative to the panel wrapper
  function showTip(e, title, lines) {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: Math.min(e.clientX - rect.left + 14, rect.width - 210),
      y: e.clientY - rect.top + 14,
      title, lines,
    });
  }
  const hideTip = () => setTip(null);

  // ── ACR guard ────────────────────────────────────────────────────────────────

  if (userProfile && !isAcrAgency) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:14, textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:14, background:'var(--color-accent-primary-subtle)', border:'1px solid var(--color-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Target size={24} style={{ color:'var(--color-text-tertiary)' }} />
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--color-text-primary)' }}>Acquisition Evaluator</div>
        <div style={{ fontSize:13, color:'var(--color-text-tertiary)', maxWidth:320, lineHeight:1.6 }}>This tool is restricted to ACR Agency members.</div>
        <button onClick={() => setCurrentPage(null)} style={{ marginTop:4, padding:'9px 22px', borderRadius:'var(--radius-lg)', background:'var(--color-accent-primary)', border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Back to Home
        </button>
      </div>
    );
  }

  // ── Control renderers (worksheet inputs) ────────────────────────────────────

  const renderControl = (c) => {
    const s = derivedScores[c.id];

    if (c.inputType === 'financial-inputs') {
      const metrics = calculateRevenueMetrics(revenueMetrics);
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:640 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:10 }}>
            <div>
              <label className="acqp-lbl">Revenue</label>
              <input
                className="acqp-input"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={revenueMetrics.revenue}
                onChange={e => setRevenueMetrics(prev => ({ ...prev, revenue: e.target.value }))}
                placeholder="e.g. 500000"
              />
            </div>
            <div>
              <label className="acqp-lbl">Total operating spend / expenses</label>
              <input
                className="acqp-input"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={revenueMetrics.totalExpenses}
                onChange={e => setRevenueMetrics(prev => ({ ...prev, totalExpenses: e.target.value }))}
                placeholder="e.g. 400000"
              />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:10 }}>
            <div style={{ padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)' }}>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:4 }}>Net profit</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(metrics.netProfit)}</div>
            </div>
            <div style={{ padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)' }}>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:4 }}>Net margin</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>{formatPercent(metrics.netMargin)}</div>
            </div>
          </div>

          <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5 }}>
            Net profit = revenue − all operating spend/expenses. The score is banded by net margin: below 25% is poor, 25%–50% is average, 50%–75% is good, and above 75% is excellent.
          </div>
        </div>
      );
    }

    if (c.inputType === 'investment-inputs') {
      const metrics = calculateInvestmentMetrics(investmentMetrics);
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:640 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:10 }}>
            <div>
              <label className="acqp-lbl">Acquisition cost</label>
              <input
                className="acqp-input"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={investmentMetrics.acquisitionCost}
                onChange={e => setInvestmentMetrics(prev => ({ ...prev, acquisitionCost: e.target.value }))}
                placeholder="e.g. 3000000"
              />
            </div>
            <div>
              <label className="acqp-lbl">Monthly profit</label>
              <input
                className="acqp-input"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={investmentMetrics.monthlyProfit}
                onChange={e => setInvestmentMetrics(prev => ({ ...prev, monthlyProfit: e.target.value }))}
                placeholder="e.g. 150000"
              />
            </div>
          </div>

          <div style={{ padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)', maxWidth:320 }}>
            <div style={{ fontSize:11, color:'var(--color-text-tertiary)', fontWeight:700, marginBottom:4 }}>Payback period</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>
              {metrics.paybackMonths === null ? '—' : `${metrics.paybackMonths.toFixed(1)} months`}
            </div>
          </div>

          <div style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5 }}>
            Payback period = acquisition cost ÷ monthly profit.
          </div>
        </div>
      );
    }

    if (c.inputType === 'toggle') {
      const opts = [
        { val: 0,   label: 'No',      col: ERROR },
        { val: 50,  label: c.id === 3 ? 'Seasonal' : 'Partly', col: WARNING },
        { val: 100, label: 'Yes',     col: SUCCESS },
      ];
      return (
        <div style={{ display:'inline-flex', borderRadius:'var(--radius-lg)', border:'1px solid var(--color-border)', overflow:'hidden', background:'var(--color-bg-tertiary)' }}>
          {opts.map((o, i) => {
            const active = s === o.val;
            return (
              <button key={o.val} onClick={() => handleToggle(c.id, o.val)}
                style={{
                  padding:'6px 15px', fontSize:12.5, fontWeight: active ? 700 : 500, fontFamily:'inherit',
                  cursor:'pointer', border:'none', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                  background: active ? `${o.col}22` : 'transparent',
                  color: active ? o.col : 'var(--color-text-secondary)', transition:'all .12s',
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (c.inputType === 'industry-select') {
      return (
        <div style={{ position:'relative', maxWidth:320 }}>
          <select className="acqp-select" value={industryValue}
            onChange={e => {
              setIndustryValue(e.target.value);
              const found = TARGET_INDUSTRIES.find(i => i.value === e.target.value);
              if (found && found.value !== 'other') setBusinessSector(found.label);
            }}>
            <option value="">Select target industry…</option>
            {TARGET_INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
          <ChevronDown size={13} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
        </div>
      );
    }

    if (c.inputType === 'months-input') {
      // monthsInOp is always stored in MONTHS (canonical); the picker just lets the
      // user type in months or years. Requirement: at least 2 years (24 months).
      const mo = parseInt(monthsInOp, 10);
      const hasVal = monthsInOp !== '' && !isNaN(mo);
      const fieldValue = !hasVal ? '' : (opUnit === 'years' ? Math.round((mo / 12) * 10) / 10 : mo);
      const onFieldChange = (raw) => {
        if (raw === '') { setMonthsInOp(''); return; }
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) return;
        setMonthsInOp(String(opUnit === 'years' ? Math.round(num * 12) : Math.round(num)));
      };
      const meetsRequirement = hasVal && mo >= 24;
      return (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <input
            className="acqp-input" type="number" min="0" step={opUnit === 'years' ? '0.5' : '1'}
            placeholder={opUnit === 'years' ? 'e.g. 2.5' : 'e.g. 30'}
            value={fieldValue} onChange={e => onFieldChange(e.target.value)}
            style={{ width:110 }}
          />
          <div style={{ position:'relative', width:104 }}>
            <select className="acqp-select" value={opUnit} onChange={e => setOpUnit(e.target.value)}>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
            <ChevronDown size={13} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
          </div>
          {hasVal && (
            <span style={{ fontSize:12, color:'var(--color-text-secondary)', fontVariantNumeric:'tabular-nums' }}>
              = {Math.floor(mo / 12)}y {mo % 12}m
            </span>
          )}
          <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, fontWeight:600,
            background: meetsRequirement ? `${SUCCESS}1F` : 'var(--color-bg-tertiary)',
            color: meetsRequirement ? SUCCESS : 'var(--color-text-tertiary)',
            border:`1px solid ${meetsRequirement ? `${SUCCESS}44` : 'var(--color-border)'}` }}>
            {meetsRequirement ? '✓ Meets 2-year minimum' : 'Needs at least 2 years'}
          </span>
        </div>
      );
    }

    if (c.inputType === 'legal-checks') {
      const rows = [
        { key:'registration',    label:'Registered with relevant authority' },
        { key:'taxCompliance',   label:'Tax filings current & compliant' },
        { key:'licensesPermits', label:'Licenses & permits in place' },
        { key:'noDisputes',      label:'No active legal disputes' },
      ];
      const addLegal = () => {
        const label = newLegalLabel.trim();
        if (!label) return;
        setCustomLegalItems(prev => [...prev, { id: crypto.randomUUID(), label, checked: false }]);
        setNewLegalLabel('');
      };
      const box = (on) => (
        <div style={{ width:18, height:18, borderRadius:6, border:`1.5px solid ${on ? SUCCESS : 'var(--color-border)'}`, background: on ? `${SUCCESS}22` : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
          {on && <Check size={11} color={SUCCESS} strokeWidth={3}/>}
        </div>
      );
      return (
        <div style={{ maxWidth:540, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px 18px' }}>
            {rows.map(({ key, label }) => {
              const on = legalChecks[key];
              return (
                <div key={key} onClick={() => setLegalChecks(p => ({ ...p, [key]: !p[key] }))}
                  style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}>
                  {box(on)}
                  <span style={{ fontSize:12.5, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: on ? 500 : 400, transition:'color .12s' }}>{label}</span>
                </div>
              );
            })}
            {customLegalItems.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div onClick={() => setCustomLegalItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', flex:1, minWidth:0 }}>
                  {box(item.checked)}
                  <span style={{ fontSize:12.5, color: item.checked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: item.checked ? 500 : 400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
                </div>
                <button onClick={() => setCustomLegalItems(prev => prev.filter(i => i.id !== item.id))} title="Remove" style={{ border:'none', background:'none', color:'var(--color-text-muted)', cursor:'pointer', display:'flex', padding:2, flexShrink:0 }}><X size={12}/></button>
              </div>
            ))}
          </div>

          {/* Add a requirement */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              className="acqp-input" value={newLegalLabel}
              onChange={e => setNewLegalLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLegal(); } }}
              placeholder="Add another requirement — e.g. Environmental permit"
              style={{ height:34, flex:1 }}
            />
            <button onClick={addLegal} disabled={!newLegalLabel.trim()} style={{ display:'flex', alignItems:'center', gap:5, padding:'0 14px', height:34, borderRadius:10, border:'none', background:'var(--color-accent-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor: newLegalLabel.trim() ? 'pointer' : 'not-allowed', opacity: newLegalLabel.trim() ? 1 : .5, fontFamily:'inherit', flexShrink:0 }}>
              <Plus size={13}/> Add
            </button>
          </div>
        </div>
      );
    }

    if (c.inputType === 'motivation-select') {
      const allOptions = [...MOTIVATION_OPTIONS, ...customMotivations];
      const riskLevels = [
        { label: 'Low risk', score: 100 },
        { label: 'Moderate', score: 75 },
        { label: 'Neutral',  score: 50 },
        { label: 'Red flag', score: 0 },
      ];
      const addMotivation = () => {
        const label = newMotivationLabel.trim();
        if (!label) return;
        const value = `custom-${crypto.randomUUID()}`;
        setCustomMotivations(prev => [...prev, { value, label, score: newMotivationScore, custom: true }]);
        setOwnerMotivation(value);
        setNewMotivationLabel(''); setNewMotivationScore(75);
      };
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:11, maxWidth:580 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {allOptions.map(({ value, label, score:ms, custom }) => {
              const active = ownerMotivation === value;
              const mc = ms >= 75 ? SUCCESS : ms >= 50 ? WARNING : ERROR;
              return (
                <span key={value} style={{ display:'inline-flex', alignItems:'center', position:'relative' }}>
                  <button onClick={() => setOwnerMotivation(active ? '' : value)}
                    style={{ padding: custom ? '6px 26px 6px 14px' : '6px 14px', borderRadius:99, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${active ? mc + '66' : 'var(--color-border)'}`, background: active ? `${mc}1F` : 'var(--color-bg-tertiary)', color: active ? mc : 'var(--color-text-secondary)', fontSize:12, fontWeight: active ? 700 : 500, transition:'all .12s' }}>
                    {label}
                  </button>
                  {custom && (
                    <button onClick={() => { setCustomMotivations(prev => prev.filter(m => m.value !== value)); if (ownerMotivation === value) setOwnerMotivation(''); }}
                      title="Remove" style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', color: active ? mc : 'var(--color-text-muted)', cursor:'pointer', display:'flex', padding:0 }}>
                      <X size={11}/>
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          {/* Add a reason for sale */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'10px 12px', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)' }}>
            <input
              className="acqp-input" value={newMotivationLabel}
              onChange={e => setNewMotivationLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMotivation(); } }}
              placeholder="Add another reason for sale…"
              style={{ height:34, flex:1, minWidth:170 }}
            />
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'var(--color-text-tertiary)', fontWeight:700 }}>Risk</span>
              <div style={{ position:'relative' }}>
                <select className="acqp-select" value={newMotivationScore} onChange={e => setNewMotivationScore(Number(e.target.value))} style={{ height:34, width:140 }}>
                  {riskLevels.map(r => <option key={r.score} value={r.score}>{r.label}</option>)}
                </select>
                <ChevronDown size={12} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
              </div>
            </div>
            <button onClick={addMotivation} disabled={!newMotivationLabel.trim()} style={{ display:'flex', alignItems:'center', gap:5, padding:'0 14px', height:34, borderRadius:10, border:'none', background:'var(--color-accent-primary)', color:'#fff', fontSize:12, fontWeight:700, cursor: newMotivationLabel.trim() ? 'pointer' : 'not-allowed', opacity: newMotivationLabel.trim() ? 1 : .5, fontFamily:'inherit', flexShrink:0 }}>
              <Plus size={13}/> Add
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  // ── KPI tiles ───────────────────────────────────────────────────────────────

  const verdictIcon = !started ? Clock : totalScore >= 75 ? CheckCircle2 : totalScore >= 50 ? AlertTriangle : X;
  const VerdictIcon = verdictIcon;
  const SnapVerdictIcon = !snapStarted ? Clock : snapTotal >= 75 ? CheckCircle2 : snapTotal >= 50 ? AlertTriangle : X;

  const ghostBtn = {
    display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:12,
    fontSize:12.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
    border:'1px solid var(--color-border)',
    background: isLight ? '#FFFFFF' : 'var(--color-bg-elevated)',
    color:'var(--color-text-secondary)',
    boxShadow: isLight ? '0 1px 2px rgba(16,24,40,0.05)' : 'none',
    transition:'all .15s',
  };

  // Clean SaaS card: white, rounded, soft shadow (light) / elevated glass (dark)
  const card = {
    background: isLight ? '#FFFFFF' : 'var(--color-bg-elevated)',
    border: `1px solid ${isLight ? 'rgba(16,24,40,0.06)' : 'var(--color-border)'}`,
    borderRadius: 16,
    boxShadow: isLight ? '0 1px 3px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.05)' : 'none',
  };

  const EMPTY_SEG = isLight ? '#EDF0F7' : 'rgba(48,108,236,0.16)';

  const distSegs = [
    { key: 'strong',  n: dist.strong,  label: 'Met',        col: SUCCESS },
    { key: 'partial', n: dist.partial, label: 'Partly met', col: WARNING },
    { key: 'weak',    n: dist.weak,    label: 'Not met',    col: ERROR },
    { key: 'pending', n: dist.pending, label: 'Not scored', col: EMPTY_SEG },
  ];

  // Snapshot distribution (best candidate by default) — drives the donut + tiles
  const snapDistSegs = [
    { key: 'strong',  n: snapDist.strong,  label: 'Met',        col: SUCCESS },
    { key: 'partial', n: snapDist.partial, label: 'Partly met', col: WARNING },
    { key: 'weak',    n: snapDist.weak,    label: 'Not met',    col: ERROR },
    { key: 'pending', n: snapDist.pending, label: 'Not scored', col: EMPTY_SEG },
  ];

  // Pipeline stats for the KPI tiles
  const qualifiedCount = savedEvals.filter(e => e.total >= 75).length;
  const reviewCount    = savedEvals.filter(e => e.total >= 50 && e.total < 75).length;

  // Pastel KPI tiles (reference look): tinted card, solid circular icon
  const kpiTiles = [
    {
      key:'score', Icon: Target, label: snapSource === 'best' ? 'Best candidate' : snapSource === 'viewed' ? 'Selected business' : 'Current score',
      value: snapStarted ? `${snapTotal}%` : '—',
      sub: scoreLabel(snapTotal, snapEvaluated),
      subColor: snapStarted ? scoreColor(snapTotal) : 'var(--color-text-tertiary)',
      tileBg: isLight ? '#EFECFF' : 'rgba(124,92,252,0.10)',  iconBg:'#7C5CFC',
    },
    {
      key:'qualified', Icon: CheckCircle2, label:'Qualified businesses',
      value: `${qualifiedCount}`,
      sub: `of ${savedEvals.length} evaluated`, subColor:'var(--color-text-tertiary)',
      tileBg: isLight ? '#E6F7EF' : 'rgba(22,163,107,0.10)',  iconBg: SUCCESS,
    },
    {
      key:'review', Icon: AlertTriangle, label:'Needs review',
      value: `${reviewCount}`,
      sub: 'scored 50–74%', subColor:'var(--color-text-tertiary)',
      tileBg: isLight ? '#FFF2E4' : 'rgba(245,166,35,0.10)',  iconBg: WARNING,
    },
    {
      key:'progress', Icon: Search, label:'Questions answered',
      value: `${snapEvaluated}/11`,
      progress: (snapEvaluated / 11) * 100,
      sub: snapName || 'current evaluation',
      subColor:'var(--color-text-tertiary)',
      tileBg: isLight ? '#E8F1FF' : 'rgba(48,108,236,0.10)',  iconBg: ACCENT,
    },
  ];

  return (
    <>
      <style>{`
        .acqp-input {
          width:100%; background:var(--color-bg-tertiary); border:1px solid var(--color-border);
          border-radius:var(--radius-lg); height:40px; padding:0 13px;
          font-size:13px; color:var(--color-text-primary); font-family:inherit; outline:none; transition:.12s;
          font-variant-numeric:tabular-nums;
        }
        .acqp-input::placeholder { color:var(--color-text-tertiary); }
        .acqp-input:focus { border-color:var(--color-border-active); box-shadow:0 0 0 3px rgba(48,108,236,.15); }
        .acqp-select {
          width:100%; background:var(--color-bg-tertiary); border:1px solid var(--color-border);
          border-radius:var(--radius-lg); height:40px; padding:0 34px 0 13px;
          font-size:13px; color:var(--color-text-primary); font-family:inherit; outline:none;
          cursor:pointer; appearance:none; transition:.12s;
        }
        .acqp-select:focus { border-color:var(--color-border-active); box-shadow:0 0 0 3px rgba(48,108,236,.15); }
        .acqp-lbl {
          font-size:9.5px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase;
          letter-spacing:.1em; display:block; margin-bottom:6px;
        }
        .acqp-ghost:hover { color:var(--color-text-primary); border-color:var(--color-border-hover); background:var(--color-bg-hover); }
        .acqp-row:hover { background:var(--color-bg-hover); }
        .acqp-bar-row:hover { background:var(--color-bg-hover); }
        @keyframes acqpUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width: 1100px) {
          .acqp-kpirow { grid-template-columns: 1fr 1fr !important; }
          .acqp-two { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .acqp-root { padding: 16px 12px 80px !important; }
          .acqp-kpirow { grid-template-columns: 1fr 1fr !important; }
          .acqp-header3 { grid-template-columns: 1fr !important; }
          .acqp-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: isLight ? '#F5F6FB' : 'transparent', minHeight:'100%' }}>
      <div ref={panelRef} className="acqp-root" style={{ maxWidth:1220, margin:'0 auto', padding:'26px 36px 96px', fontFamily:'var(--font-sans)', position:'relative' }}>

        {/* Auto-sync happens on load; this only appears if that sync failed. */}
        {importFailed && localToImport.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16, padding:'12px 16px', borderRadius:12, background:'rgba(224,72,90,0.10)', border:'1px solid rgba(224,72,90,0.30)' }}>
            <span style={{ fontSize:12.5, color:'var(--color-text-secondary)' }}>
              ⚠️ Couldn&apos;t auto-sync <strong style={{ color:'var(--color-text-primary)' }}>{localToImport.length}</strong> evaluation(s) saved on this device to the shared space.
            </span>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button onClick={() => setLocalToImport([])} style={{ ...ghostBtn }}>Dismiss</button>
              <button onClick={() => setImportFailed(false)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:'var(--radius-lg)', background:'var(--color-accent-gradient)', border:'none', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Retry sync</button>
            </div>
          </div>
        )}

        {/* ── Greeting header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:22 }}>
          <div>
            <h1 className="display" style={{ fontSize:24, fontWeight:800, color:'var(--color-text-primary)', letterSpacing:'-.015em', margin:0, lineHeight:1.15 }}>
              {greeting()}, {userProfile?.full_name?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p style={{ fontSize:13, color:'var(--color-text-tertiary)', margin:'4px 0 0' }}>
              Here&apos;s what&apos;s happening with your acquisition pipeline today.
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ ...ghostBtn, cursor:'default' }}>
              <Calendar size={13}/> {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
            </span>
            <button onClick={() => setHistoryOpen(true)} className="acqp-ghost" style={{ ...ghostBtn, color: savedEvals.length ? 'var(--color-text-link)' : 'var(--color-text-secondary)' }}>
              <History size={13}/> History
              {savedEvals.length > 0 && <span style={{ background:'var(--color-accent-primary)', color:'#fff', fontSize:10, fontWeight:700, borderRadius:99, padding:'1px 6px', fontVariantNumeric:'tabular-nums' }}>{savedEvals.length}</span>}
            </button>
            <button onClick={handleCopy} className="acqp-ghost" style={ghostBtn}><Copy size={13}/> {copying ? 'Copied' : 'Copy'}</button>
            <button onClick={openValuation} className="acqp-ghost" style={ghostBtn}><Calculator size={13}/> Valuation</button>
            <button onClick={startNewEvaluation} style={{
              display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:12,
              background:'var(--color-accent-gradient)', border:'none', color:'#fff',
              cursor:'pointer', fontSize:12.5, fontWeight:700, fontFamily:'inherit',
              boxShadow:'0 4px 14px rgba(48,108,236,0.35)', transition:'all .15s',
            }}>
              <Plus size={14}/> New Evaluation
            </button>
          </div>
        </div>

        {/* ── Currently-shown business ── */}
        {snapName && (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <span style={{ width:34, height:34, borderRadius:'50%', background:'var(--color-accent-gradient)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>
              {snapName.charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:17, fontWeight:800, color:'var(--color-text-primary)', letterSpacing:'-.01em', lineHeight:1.15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{snapName}</div>
              <div style={{ fontSize:11.5, color:'var(--color-text-tertiary)', marginTop:1 }}>
                {snapSource === 'best' ? 'Your top candidate — best match so far'
                  : snapSource === 'viewed' ? 'Selected from your pipeline'
                  : 'Current evaluation'}
              </div>
            </div>
            {snapStarted && (
              <span style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:99, background:`${snapColor}16`, border:`1px solid ${snapColor}33`, fontSize:12.5, fontWeight:700, color:snapColor }}>
                <SnapVerdictIcon size={13}/> {snapTotal}% · {scoreLabel(snapTotal, snapEvaluated)}
              </span>
            )}
            {snapSource === 'viewed' && bestEval && (
              <button onClick={() => setViewedEvalId(null)} className="acqp-ghost" style={{ ...ghostBtn, padding:'6px 12px' }}>
                ← Top candidate
              </button>
            )}
          </div>
        )}

        {/* ── Pastel KPI tiles ── */}
        <div className="acqp-kpirow" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:14 }}>
          {kpiTiles.map((t, i) => (
            <div key={t.key} style={{
              background: t.tileBg,
              border: `1px solid ${isLight ? 'rgba(16,24,40,0.04)' : 'var(--color-border-subtle)'}`,
              borderRadius: 16, padding: '16px 18px',
              boxShadow: isLight ? '0 1px 2px rgba(16,24,40,0.04)' : 'none',
              animation: `acqpUp .16s ease ${i * 0.04}s both`,
            }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:t.iconBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:`0 4px 10px ${t.iconBg}55` }}>
                <t.Icon size={17} color="#fff" strokeWidth={2.2}/>
              </div>
              <div style={{ fontSize:12, color:'var(--color-text-tertiary)', fontWeight:600, marginBottom:4 }}>{t.label}</div>
              <div style={{ fontSize:26, fontWeight:800, color:'var(--color-text-primary)', letterSpacing:'-.02em', lineHeight:1.1 }}>{t.value}</div>
              {t.progress !== undefined ? (
                <div style={{ marginTop:9 }}>
                  <div style={{ height:6, borderRadius:99, background: isLight ? 'rgba(16,24,40,0.07)' : 'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${t.progress}%`, borderRadius:99, background:t.iconBg, transition:'width .4s ease' }}/>
                  </div>
                  <div style={{ fontSize:11, color:t.subColor, fontWeight:600, marginTop:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.sub}</div>
                </div>
              ) : (
                <div style={{ fontSize:11.5, color:t.subColor, fontWeight:700, marginTop:7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Donut + criteria chart row ── */}
        <div className="acqp-two" style={{ display:'grid', gridTemplateColumns:'370px 1fr', gap:14, marginBottom:14, alignItems:'stretch' }}>

          {/* Criteria breakdown — segmented donut with legend */}
          <div style={{ ...card, padding:'18px 20px', animation:'acqpUp .16s ease both', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)' }}>Criteria breakdown</div>
              {showBest && <span style={{ fontSize:10, fontWeight:700, color: SUCCESS, background:`${SUCCESS}1C`, border:`1px solid ${SUCCESS}33`, borderRadius:99, padding:'2px 9px' }}>Best candidate</span>}
            </div>
            <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {snapName ? snapName : "This evaluation's 11 answers"}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:14, flexWrap:'wrap' }}>
              <div style={{ position:'relative', width:168, height:168, flexShrink:0 }}>
                <SegDonut segments={snapDistSegs} empty={EMPTY_SEG} size={168} stroke={17}/>
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:28, fontWeight:800, color:'var(--color-text-primary)', letterSpacing:'-.02em', lineHeight:1 }}>
                    {snapStarted ? `${snapTotal}%` : '—'}
                  </span>
                  <span style={{ fontSize:10.5, fontWeight:600, color:'var(--color-text-tertiary)', marginTop:3 }}>Total score</span>
                </div>
              </div>

              <div style={{ flex:1, minWidth:140, display:'flex', flexDirection:'column', gap:10 }}>
                {snapDistSegs.map(sg => (
                  <div key={sg.key} style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <span style={{ width:9, height:9, borderRadius:3, background:sg.col, flexShrink:0 }}/>
                    <span style={{ fontSize:12.5, color:'var(--color-text-secondary)', flex:1 }}>{sg.label}</span>
                    <span style={{ fontSize:12.5, fontWeight:800, color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>{sg.n}</span>
                    <span style={{ fontSize:11.5, color:'var(--color-text-tertiary)', width:38, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{Math.round((sg.n / 11) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verdict footer chip */}
            <div style={{ marginTop:'auto', paddingTop:14 }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:10,
                background: snapStarted ? `${snapColor}16` : (isLight ? '#F2F4F9' : 'var(--color-bg-tertiary)'),
                border: `1px solid ${snapStarted ? `${snapColor}33` : 'var(--color-border-subtle)'}`,
                fontSize:12, fontWeight:700, color: snapStarted ? snapColor : 'var(--color-text-secondary)',
              }}>
                <SnapVerdictIcon size={13}/>
                Verdict: {scoreLabel(snapTotal, snapEvaluated)}
                <span style={{ fontWeight:500, color:'var(--color-text-tertiary)' }}>· 75%+ qualifies</span>
              </span>
            </div>
          </div>

          {/* ── Criteria chart — how each answer scored ── */}
          <div style={{ ...card, padding:'18px 20px', animation:'acqpUp .18s ease both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4, flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--color-text-primary)' }}>How each criterion scored</div>
                <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2 }}>Bars that reach the 75% line count as fully met</div>
              </div>
              {/* Status legend */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[{ l:'Met', c:SUCCESS }, { l:'Partly met', c:WARNING }, { l:'Not met', c:ERROR }, { l:'Not scored', c:EMPTY_SEG }].map(({ l, c }) => (
                  <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:'var(--color-text-tertiary)', fontWeight:600 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:c }}/> {l}
                  </span>
                ))}
              </div>
            </div>

            {/* Chart body */}
            <div style={{ position:'relative', marginTop:12 }}>
              {/* 75% qualifying hairline spanning the bar track zone */}
              <div style={{ position:'absolute', top:0, bottom:18, left:`calc(178px + (100% - 178px - 48px) * 0.75)`, width:1, background:'var(--color-border-hover)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:0, left:`calc(178px + (100% - 178px - 48px) * 0.75)`, transform:'translateX(-50%)', fontSize:9.5, color:'var(--color-text-muted)', fontWeight:700, letterSpacing:'.05em', pointerEvents:'none' }}>75% needed</div>

              {CRITERIA.map((c) => {
                const s = snapScores[c.id] ?? null;
                const col = scoreColor(s);
                const scored = s !== null;
                return (
                  <div key={c.id} className="acqp-bar-row"
                    onMouseMove={(e) => showTip(e, c.title, [
                      scored ? `Score: ${s}% — ${bandLabel(s)}` : 'Not evaluated yet',
                      snapNotes[c.id]?.trim() ? 'Has evaluator note' : null,
                    ].filter(Boolean))}
                    onMouseLeave={hideTip}
                    style={{ display:'grid', gridTemplateColumns:'170px 1fr 40px', gap:8, alignItems:'center', padding:'4px 4px', borderRadius:6, cursor:'default' }}>
                    {/* Label — text token, never series color */}
                    <span style={{ fontSize:11.5, color: scored ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
                    {/* Track + bar: ≤24px thick, rounded data-end, square baseline */}
                    <div style={{ height:12, borderRadius:'0 4px 4px 0', background:'rgba(48,108,236,0.10)', position:'relative', overflow:'hidden' }}>
                      {scored && s > 0 && (
                        <div style={{ position:'absolute', inset:'0 auto 0 0', width:`${s}%`, background:col, borderRadius: s >= 100 ? '0 4px 4px 0' : '0 4px 4px 0', transition:'width .45s cubic-bezier(.4,0,.2,1)' }}/>
                      )}
                      {scored && s === 0 && (
                        <div style={{ position:'absolute', inset:'0 auto 0 0', width:3, background:col }}/>
                      )}
                    </div>
                    {/* Value at the tip column — tabular for alignment */}
                    <span style={{ fontSize:11.5, fontWeight:700, color: scored ? 'var(--color-text-primary)' : 'var(--color-text-muted)', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      {scored ? `${s}%` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Recent evaluations — records table ── */}
        <div style={{ ...card, overflow:'hidden', marginBottom:14, animation:'acqpUp .2s ease both' }}>

          {/* Card header: title + search + filter */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
            padding:'14px 18px', borderBottom:'1px solid var(--color-border-subtle)',
          }}>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--color-text-primary)', letterSpacing:'-.01em' }}>Recent Evaluations</span>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ position:'relative' }}>
                <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
                <input
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Search"
                  style={{
                    width:190, height:32, borderRadius:10, border:'1px solid var(--color-border)',
                    background:'var(--color-bg-tertiary)', color:'var(--color-text-primary)', outline:'none',
                    padding:'0 12px 0 31px', fontSize:12.5, fontFamily:'inherit',
                  }}
                />
              </div>
              <div style={{ position:'relative' }}>
                <Filter size={12} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
                <select
                  value={tableFilter}
                  onChange={e => setTableFilter(e.target.value)}
                  style={{
                    height:32, borderRadius:10, border:'1px solid var(--color-border)',
                    background:'var(--color-bg-tertiary)', color:'var(--color-text-primary)', outline:'none',
                    padding:'0 28px 0 29px', fontSize:12.5, fontFamily:'inherit', cursor:'pointer', appearance:'none',
                  }}
                >
                  <option value="all">Filter by</option>
                  <option value="strong">Strong ≥75%</option>
                  <option value="review">Review 50–74%</option>
                  <option value="fail">Below 50%</option>
                </select>
                <ChevronDown size={12} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
              </div>
              <button onClick={undoEvals} disabled={undoStack.length === 0} title="Undo last change (restore deleted / previous)" style={{
                width:32, height:32, borderRadius:10, border:'1px solid var(--color-border)', flexShrink:0,
                background:'var(--color-bg-tertiary)', color: undoStack.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                cursor: undoStack.length ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Undo2 size={15}/>
              </button>
              <button onClick={redoEvals} disabled={redoStack.length === 0} title="Redo" style={{
                width:32, height:32, borderRadius:10, border:'1px solid var(--color-border)', flexShrink:0,
                background:'var(--color-bg-tertiary)', color: redoStack.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                cursor: redoStack.length ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Redo2 size={15}/>
              </button>
              <button onClick={startNewEvaluation} title="New evaluation" style={{
                width:32, height:32, borderRadius:10, border:'none',
                background:'var(--color-accent-primary)', color:'#fff', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'opacity .15s',
                boxShadow:'0 2px 8px rgba(48,108,236,0.35)',
              }}>
                <Plus size={15}/>
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth:860 }}>
              {/* Head */}
              <div style={{ display:'grid', gridTemplateColumns:'1.4fr .85fr 1.05fr .75fr .6fr 1fr 96px', gap:10, padding:'10px 18px', borderBottom:'1px solid var(--color-border)' }}>
                {['Business','Sector','Evaluated by','Date','Score','Verdict',''].map((h, i) => (
                  <span key={i} style={{ fontSize:10, fontWeight:800, color:'var(--color-text-primary)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</span>
                ))}
              </div>

              {/* Saved rows */}
              {tableRows.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 0', color:'var(--color-text-tertiary)', fontSize:12.5 }}>
                  {savedEvals.length === 0 ? (
                    <>No evaluations yet — click <button onClick={startNewEvaluation} style={{ background:'none', border:'none', padding:0, color:'var(--color-text-link)', fontWeight:700, cursor:'pointer', fontSize:12.5, fontFamily:'inherit' }}>+ New Evaluation</button> to score your first business.</>
                  ) : 'No evaluations match the current search/filter.'}
                </div>
              ) : tableRows.map((ev, i) => {
                const col = scoreColor(ev.total);
                const selected = ev.id === viewedEvalId;
                return (
                  <div key={ev.id} className="acqp-row" onClick={() => setViewedEvalId(ev.id)} title="Click to view this evaluation"
                    style={{ display:'grid', gridTemplateColumns:'1.4fr .85fr 1.05fr .75fr .6fr 1fr 96px', gap:10, padding:'10px 18px', alignItems:'center', cursor:'pointer', borderLeft:`3px solid ${selected ? ACCENT : 'transparent'}`, background: selected ? 'var(--color-accent-primary-subtle)' : 'transparent', borderBottom: i < tableRows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', transition:'background .12s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                      <span style={{ width:26, height:26, borderRadius:'50%', background:'var(--color-accent-primary-subtle)', border:'1px solid var(--color-border)', color:'var(--color-text-link)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                        {(ev.businessName || '?').charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontSize:12.5, fontWeight:700, color:'var(--color-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.businessName}</span>
                    </div>
                    <span style={{ fontSize:12, color:'var(--color-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.sector || '—'}</span>
                    <EvaluatorChip name={ev.evaluator?.name} avatar={ev.evaluator?.avatar}/>
                    <span style={{ fontSize:12, color:'var(--color-text-secondary)', fontVariantNumeric:'tabular-nums' }}>{ev.date}</span>
                    <span style={{ fontSize:12.5, fontWeight:800, color: col, fontVariantNumeric:'tabular-nums' }}>{ev.total}%</span>
                    <span>
                      <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:99, background:`${scoreColor(ev.total)}1C`, border:`1px solid ${scoreColor(ev.total)}44`, color: scoreColor(ev.total) }}>
                        {scoreLabel(ev.total, ev.evaluatedCount)}
                      </span>
                    </span>
                    <span style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleLoadEval(ev); }} title="Edit evaluation" style={{ padding:'4px 6px', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text-link)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Pencil size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEval(ev.id); }} title="Delete" style={{ padding:'4px 6px', borderRadius:'var(--radius-md)', border:'none', background:'transparent', color:'var(--color-text-muted)', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={12}/></button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Evaluation form — opened by the + buttons ── */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editingEvalId ? 'Edit Business Evaluation' : 'Business Evaluation'}
          maxWidth="760px"
          footer={(
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', width:'100%' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background: started ? scoreColor(totalScore) : 'var(--color-text-muted)', flexShrink:0 }}/>
                <span style={{ fontSize:14, fontWeight:800, color: started ? scoreColor(totalScore) : 'var(--color-text-secondary)', fontVariantNumeric:'tabular-nums' }}>
                  {started ? `${totalScore}%` : '—'}
                </span>
                <span style={{ fontSize:12.5, fontWeight:600, color:'var(--color-text-secondary)' }}>{scoreLabel(totalScore, evaluatedCount)}</span>
                <span style={{ fontSize:11.5, color:'var(--color-text-muted)', fontVariantNumeric:'tabular-nums' }}>· {evaluatedCount}/11 scored</span>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleReset} className="acqp-ghost" style={ghostBtn}><RefreshCw size={12}/> Reset</button>
                <button onClick={handleSave} disabled={saving || !businessName.trim()} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'8px 20px', borderRadius:'var(--radius-lg)',
                  background: businessName.trim() ? 'var(--color-accent-gradient)' : 'var(--color-bg-tertiary)',
                  border: businessName.trim() ? 'none' : '1px solid var(--color-border)',
                  color: businessName.trim() ? '#fff' : 'var(--color-text-muted)',
                  cursor: businessName.trim() ? 'pointer' : 'not-allowed', fontSize:13, fontWeight:700, fontFamily:'inherit',
                  boxShadow: businessName.trim() ? '0 4px 14px rgba(48,108,236,0.35)' : 'none', transition:'all .15s',
                }}>
                  <Save size={13}/> {saving ? 'Saving…' : (editingEvalId ? 'Update Evaluation' : 'Save Evaluation')}
                </button>
              </div>
            </div>
          )}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* How it works */}
              <p style={{ margin:0, fontSize:12, color:'var(--color-text-tertiary)', lineHeight:1.6 }}>
                Name the business, then answer each question below. The score and verdict update automatically — nothing else to set.
              </p>

              {/* Business details */}
              <div className="acqp-header3" style={{ display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr', gap:14, alignItems:'end' }}>
                <div>
                  <label className="acqp-lbl">Business Name *</label>
                  <input className="acqp-input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Sunshine Laundromat"/>
                </div>
                <div>
                  <label className="acqp-lbl">Sector</label>
                  <div style={{ position:'relative' }}>
                    <select className="acqp-select" value={businessSector} onChange={e => setBusinessSector(e.target.value)}>
                      <option value="">Select sector…</option>
                      {/* Keep any previously-saved sector that isn't in the list */}
                      {businessSector && !SECTORS.includes(businessSector) && (
                        <option value={businessSector}>{businessSector}</option>
                      )}
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-tertiary)', pointerEvents:'none' }}/>
                  </div>
                </div>
                <div>
                  <label className="acqp-lbl">Date</label>
                  <input className="acqp-input" type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)}/>
                </div>
              </div>

              {/* Criteria worksheet */}
              <div style={{ border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid var(--color-border-subtle)', background:'var(--color-bg-tertiary)' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)' }}>Criteria worksheet</div>
                  <div style={{ fontSize:11.5, color:'var(--color-text-tertiary)', fontVariantNumeric:'tabular-nums' }}>{evaluatedCount} of 11 scored</div>
                </div>

                {CRITERIA.map((c, idx) => {
            const s      = derivedScores[c.id];
            const col    = scoreColor(s);
            const scored = s !== null;
            const Icon   = c.Icon;
            return (
              <div key={c.id} className="acqp-row" style={{ display:'grid', gridTemplateColumns:'40px 1fr 68px', gap:13, padding:'15px 20px', borderBottom: idx < CRITERIA.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', transition:'background .12s' }}>

                {/* Icon chip */}
                <div style={{ width:36, height:36, borderRadius:'var(--radius-lg)', background: scored ? `${col}1C` : 'var(--color-bg-tertiary)', border:`1px solid ${scored ? `${col}33` : 'var(--color-border-subtle)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .2s' }}>
                  <Icon size={16} style={{ color: scored ? col : 'var(--color-text-secondary)' }} strokeWidth={2}/>
                </div>

                {/* Content */}
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:10.5, fontWeight:700, color:'var(--color-text-muted)', fontFamily: MONO }}>{String(c.id + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize:13, fontWeight:650, color:'var(--color-text-primary)', letterSpacing:'-.005em' }}>{c.title}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:3, lineHeight:1.5 }}>{c.desc}</div>
                  <div style={{ marginTop:11 }}>{renderControl(c)}</div>

                  {/* Note */}
                  <div style={{ marginTop:9 }}>
                    <button onClick={() => setNotesOpen(p => ({ ...p, [c.id]: !p[c.id] }))}
                      style={{ background:'none', border:'none', cursor:'pointer', color: notes[c.id] ? 'var(--color-text-link)' : 'var(--color-text-muted)', fontSize:10.5, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4, padding:0, fontWeight:600 }}>
                      <ChevronDown size={10} style={{ transform: notesOpen[c.id] ? 'rotate(180deg)' : 'none', transition:'transform .12s' }}/>
                      {notes[c.id] ? `Note (${notes[c.id].split(/\s+/).filter(Boolean).length}w)` : 'Add note'}
                    </button>
                    {notesOpen[c.id] && (
                      <textarea value={notes[c.id]} onChange={e => setNotes(p => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="Observations, red flags, supporting context…" rows={2}
                        style={{ marginTop:7, width:'100%', maxWidth:520, background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)', padding:'8px 11px', color:'var(--color-text-primary)', fontSize:12, fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.55 }}/>
                    )}
                  </div>
                </div>

                {/* Score cell */}
                <div style={{ textAlign:'right', paddingTop:2 }}>
                  <div style={{ fontSize:17, fontWeight:800, color: scored ? col : 'var(--color-text-muted)', fontVariantNumeric:'tabular-nums', letterSpacing:'-.02em', lineHeight:1 }}>
                    {scored ? s : '—'}{scored && <span style={{ fontSize:10, fontWeight:600 }}>%</span>}
                  </div>
                  <div style={{ fontSize:9.5, fontWeight:600, color: scored ? col : 'var(--color-text-muted)', marginTop:4 }}>{bandLabel(s)}</div>
                </div>
              </div>
            );
          })}
              </div>
          </div>
        </Modal>

        {/* ── Tooltip layer ── */}
        {tip && (
          <div style={{
            position:'absolute', left:tip.x, top:tip.y, zIndex:60, pointerEvents:'none',
            background:'var(--color-surface)', border:'1px solid var(--color-border-hover)',
            borderRadius:'var(--radius-lg)', padding:'8px 11px', maxWidth:220,
            boxShadow:'var(--shadow-lg)', backdropFilter:'blur(12px)',
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--color-text-primary)', marginBottom:2 }}>{tip.title}</div>
            {tip.lines.map((l, i) => (
              <div key={i} style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.5 }}>{l}</div>
            ))}
          </div>
        )}

        {/* ── Valuation modal ── */}
        <Modal isOpen={valuationOpen} onClose={() => setValuationOpen(false)} title="Business Valuation" maxWidth="720px">
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <p style={{ margin:0, fontSize:12.5, color:'var(--color-text-tertiary)', lineHeight:1.6 }}>
              Value {businessName.trim() ? <strong style={{ color:'var(--color-text-secondary)' }}>{businessName.trim()}</strong> : 'the business'} four ways — earnings, revenue, cash flow, and assets. Fill what you have; each method estimates independently and we reconcile them below. Estimates only — confirm with due diligence.
            </p>

            {/* Recommended banner */}
            <div style={{ borderRadius:'var(--radius-xl)', border:`1px solid ${ACCENT}44`, background:`${ACCENT}0F`, padding:'16px 18px' }}>
              {valuationResult.recommended === null ? (
                <div style={{ fontSize:12.5, color:'var(--color-text-tertiary)', lineHeight:1.6 }}>Fill any method below to see an estimate.</div>
              ) : (
                <>
                  <div style={{ fontSize:10.5, fontWeight:700, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.09em' }}>Recommended estimate</div>
                  <div style={{ fontSize:30, fontWeight:800, color:'var(--color-text-primary)', letterSpacing:'-.02em', lineHeight:1.1, marginTop:4 }}>{formatCurrency(valuationResult.recommended)}</div>
                  <div style={{ fontSize:12.5, color:'var(--color-text-secondary)', marginTop:6 }}>
                    Suggested offer: <strong style={{ color:'var(--color-text-primary)' }}>{formatCurrency(valuationResult.offerLow)} – {formatCurrency(valuationResult.offerHigh)}</strong>
                    {valuationResult.rangeLow !== valuationResult.rangeHigh && (
                      <span style={{ color:'var(--color-text-tertiary)' }}> · methods span {formatCurrency(valuationResult.rangeLow)}–{formatCurrency(valuationResult.rangeHigh)}</span>
                    )}
                  </div>
                  {/* Method chips */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                    {valuationResult.methods.map(m => (
                      <span key={m.key} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:99, background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border-subtle)', fontSize:11.5, color:'var(--color-text-secondary)', fontWeight:600 }}>
                        {m.label} <span style={{ color: m.value != null ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{m.value != null ? formatCurrency(m.value) : '—'}</span>
                      </span>
                    ))}
                  </div>
                  {valuationResult.impliedPaybackMonths !== null && (
                    <div style={{ fontSize:11.5, color:'var(--color-text-tertiary)', marginTop:10 }}>
                      Pays itself back in <strong style={{ color:'var(--color-text-secondary)' }}>{valuationResult.impliedPaybackMonths.toFixed(0)} months</strong> at the recommended price.
                    </div>
                  )}
                  {valuationResult.netAssetValue !== null && valuationResult.incomeValue !== null && valuationResult.netAssetValue > valuationResult.incomeValue && (
                    <div style={{ marginTop:11, fontSize:12, color:WARNING, display:'flex', alignItems:'center', gap:6, lineHeight:1.5 }}>
                      <AlertTriangle size={14} style={{ flexShrink:0 }}/> Assets are worth more than earnings justify — lean on the asset value here.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* A — Earnings (SDE) */}
            <MethodCard title="Earnings method — SDE × multiple" subtitle="Income approach · best for owner-run businesses" value={valuationResult.incomeValue}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'11px 14px' }}>
                {SDE_FIELDS.map(f => (
                  <VMoney key={f.key} label={f.label} value={valuation[f.key]} onChange={val => setValuation(v => ({ ...v, [f.key]: val }))}/>
                ))}
              </div>
              <div style={{ marginTop:11, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 13px', borderRadius:'var(--radius-lg)', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)' }}>Seller&apos;s Discretionary Earnings (SDE)</span>
                <span style={{ fontSize:14, fontWeight:800, color:'var(--color-text-primary)', fontVariantNumeric:'tabular-nums' }}>{formatCurrency(valuationResult.sde)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginTop:12 }}>
                <div style={{ display:'inline-flex', borderRadius:'var(--radius-lg)', border:'1px solid var(--color-border)', overflow:'hidden', background:'var(--color-bg-tertiary)' }}>
                  {[{ k:true, l:`Auto (${valuationResult.suggested}×)` }, { k:false, l:'Set manually' }].map((o, i) => {
                    const on = valuation.multipleAuto === o.k;
                    return (
                      <button key={String(o.k)} onClick={() => setValuation(v => ({ ...v, multipleAuto: o.k }))}
                        style={{ padding:'7px 15px', fontSize:12, fontWeight: on ? 700 : 500, border:'none', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none', background: on ? 'var(--color-accent-primary-subtle)' : 'transparent', color: on ? 'var(--color-text-link)' : 'var(--color-text-secondary)', cursor:'pointer', fontFamily:'inherit' }}>
                        {o.l}
                      </button>
                    );
                  })}
                </div>
                {!valuation.multipleAuto && (
                  <div style={{ position:'relative', width:104 }}>
                    <input className="acqp-input" type="number" step="0.1" min="0" placeholder={String(valuationResult.suggested)}
                      value={valuation.multiple} onChange={e => setValuation(v => ({ ...v, multiple: e.target.value }))} style={{ paddingRight:26 }}/>
                    <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--color-text-tertiary)', pointerEvents:'none' }}>×</span>
                  </div>
                )}
                <span style={{ fontSize:11.5, color:'var(--color-text-tertiary)', lineHeight:1.5 }}>
                  Using <strong style={{ color:'var(--color-text-secondary)' }}>{valuationResult.multiple}×</strong> · suggested from the {started ? `${totalScore}%` : '—'} score
                </span>
              </div>
            </MethodCard>

            {/* B — Revenue multiple */}
            <MethodCard title="Revenue method — revenue × multiple" subtitle="Market approach · rough, useful cross-check" value={valuationResult.marketValue}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <VMoney label="Yearly revenue (turnover)" value={valuation.annualRevenue} onChange={val => setValuation(v => ({ ...v, annualRevenue: val }))} placeholder="e.g. 4000000"/>
                <VNum label="Revenue multiple" value={valuation.revenueMultiple} onChange={val => setValuation(v => ({ ...v, revenueMultiple: val }))} placeholder="1.0" suffix="×"/>
              </div>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:9, lineHeight:1.5 }}>Small service businesses usually sell for 0.5×–1.5× of yearly revenue. Defaults to 1.0× if left blank.</div>
            </MethodCard>

            {/* C — DCF */}
            <MethodCard title="Discounted cash flow (DCF)" subtitle="Income approach · projects future cash, discounted to today" value={valuationResult.dcfValue}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'11px 14px' }}>
                <VMoney label="Yearly cash flow / profit" value={valuation.dcfCashFlow} onChange={val => setValuation(v => ({ ...v, dcfCashFlow: val }))} placeholder="e.g. 1200000"/>
                <VNum label="Yearly growth" value={valuation.dcfGrowth} onChange={val => setValuation(v => ({ ...v, dcfGrowth: val }))} placeholder="5" suffix="%"/>
                <VNum label="Discount rate (risk)" value={valuation.dcfDiscount} onChange={val => setValuation(v => ({ ...v, dcfDiscount: val }))} placeholder="25" suffix="%"/>
                <VNum label="Years projected" value={valuation.dcfYears} onChange={val => setValuation(v => ({ ...v, dcfYears: val }))} placeholder="5" suffix="yrs" step="1"/>
              </div>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:9, lineHeight:1.5 }}>
                Defaults: 5% growth, 25% discount (typical risk for a small business), 5 years, exit at the {valuationResult.dcfTerminal}× multiple.
              </div>
            </MethodCard>

            {/* D — Assets */}
            <MethodCard title="Asset method — net assets" subtitle="Asset approach · sets the floor price" value={valuationResult.netAssetValue}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <VMoney label="Assets at market value" value={valuation.assets} onChange={val => setValuation(v => ({ ...v, assets: val }))} placeholder="equipment, property, stock"/>
                <VMoney label="Liabilities / debts" value={valuation.liabilities} onChange={val => setValuation(v => ({ ...v, liabilities: val }))} placeholder="loans, arrears"/>
              </div>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:9, lineHeight:1.5 }}>A business is rarely worth less than its assets minus its debts — this is the walk-away floor.</div>
            </MethodCard>
          </div>
        </Modal>

        {/* ── History modal ── */}
        <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Saved Evaluations" maxWidth="560px">
          {savedEvals.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--color-text-tertiary)', fontSize:14 }}>
              <History size={26} style={{ opacity:.3, marginBottom:10 }}/>
              <div>No saved evaluations yet.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:420, overflowY:'auto', paddingRight:2 }}>
              {[...savedEvals].reverse().map(ev => {
                const col = scoreColor(ev.total);
                return (
                  <div key={ev.id} style={{ padding:'11px 14px', borderRadius:'var(--radius-lg)', background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.businessName}</div>
                      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2, fontVariantNumeric:'tabular-nums' }}>{ev.sector && <>{ev.sector} · </>}{ev.date} · {ev.evaluatedCount}/11 scored{ev.evaluator?.name && <> · by {ev.evaluator.name}</>}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color: col, fontVariantNumeric:'tabular-nums' }}>{ev.total}%</div>
                      <div style={{ fontSize:9.5, color:'var(--color-text-muted)' }}>{scoreLabel(ev.total, ev.evaluatedCount)}</div>
                    </div>
                    <button onClick={() => handleLoadEval(ev)} style={{ padding:'5px 12px', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text-link)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Load</button>
                    <button onClick={() => handleDeleteEval(ev.id)} style={{ padding:'5px 7px', borderRadius:'var(--radius-md)', border:'none', background:'transparent', color:'var(--color-text-muted)', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={13}/></button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      </div>
      </div>
    </>
  );
}
