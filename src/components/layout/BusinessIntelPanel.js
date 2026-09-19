'use client';

import { useEffect, useMemo, useState, useContext, createContext } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import {
  Sparkles, Lock, Save, RefreshCw, ChevronLeft,
  Plus, Trash2, User, ShoppingBag, Wrench, DollarSign, AlertTriangle,
  Rocket, CheckCircle2, Circle, Info, MapPin, TrendingUp, Eye, Pencil,
} from 'lucide-react';

// Whether the detail page is being shown read-only ('view') or editable
// ('edit') — read by Field/InfraRow so every field call site doesn't need
// its own readOnly prop.
const ViewModeContext = createContext(false);

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Three fleshed-out sample businesses (demo mode only) so the registry isn't
// empty on first look — a range of completeness and verification mix.
function buildSampleEntries() {
  const now = new Date().toISOString();
  const mk = (fields) => ({ id: crypto.randomUUID(), agency_id: null, created_at: now, updated_at: now, ...fields });
  return [
    mk({
      name: 'Sunshine Laundromat',
      industry: 'Laundry & garment care',
      location: 'Kilimani, Nairobi',
      data: {
        identity: {
          ownerName: 'Grace Wanjiru', ownerPhone: '0722 445 981', ownerEmail: 'grace.wanjiru@sunshinelaundry.co.ke',
          country: 'Kenya', city: 'Nairobi',
          yearEstablished: '2021', registrationStatus: 'Registered Business Name', businessPhone: '0722 445 981', businessEmail: 'hello@sunshinelaundry.co.ke',
        },
        operations: {
          productsServices: 'Wash & fold, dry cleaning, ironing, and a subscription pickup/delivery service for households and small hotels.',
          employeeCount: '4 full-time, 2 part-time', locationCount: '1', operatingModel: 'Owner-operated',
          suppliers: 'Detergent Africa Ltd (wholesale detergent), local hardware store for equipment parts',
          customerSegments: 'Middle-income households within 3km, two boutique hotels on standing contracts',
          currentSystems: 'WhatsApp Business for orders, a physical logbook for daily revenue, M-Pesa for payments',
        },
        performance: {
          revenueRange: 'KES 200K–500K/mo', customerVolume: '~350 orders/month',
          revenueStreams: 'Wash & fold (60%), dry cleaning (25%), hotel contracts (15%)',
          operatingExpenses: 'Rent, water & electricity, detergent/supplies, staff wages',
          growthTrend: 'Growing', financialChallenges: 'Water bills spike in dry season; no working capital buffer for a second machine',
        },
        infrastructure: {
          operations: { level: 'basic', note: 'Daily task list on a whiteboard, no shift scheduling software' },
          finance: { level: 'informal', note: 'M-Pesa statements + a notebook, no bookkeeping software' },
          marketing: { level: 'informal', note: 'Word of mouth and a WhatsApp status; no paid ads' },
          sales: { level: 'basic', note: 'WhatsApp Business catalogue with price list' },
          technology: { level: 'none', note: '' },
          hr: { level: 'none', note: 'No written contracts on file for part-time staff' },
          governance: { level: 'informal', note: 'Owner makes all decisions; no advisory input' },
          customerMgmt: { level: 'basic', note: 'WhatsApp broadcast list for regulars' },
          recordKeeping: { level: 'informal', note: 'Handwritten logbook, photographed weekly as backup' },
        },
        challenges: { selected: ['Cash flow', 'Capital', 'Technology'], other: 'Needs a second washing machine to keep up with weekend demand.' },
        growthNeeds: { selected: ['iTekTechnology', 'impactFund'], notes: 'A simple POS/bookkeeping tool would fix the record-keeping gap; financing for a second machine would unlock weekend capacity.' },
        verification: {
          'identity.ownerName': 'observed', 'identity.ownerPhone': 'owner_reported', 'identity.ownerEmail': 'owner_reported',
          'identity.yearEstablished': 'owner_reported', 'identity.registrationStatus': 'document_verified', 'identity.businessPhone': 'observed', 'identity.businessEmail': 'owner_reported',
          'operations.productsServices': 'observed', 'operations.employeeCount': 'observed', 'operations.locationCount': 'observed', 'operations.operatingModel': 'observed',
          'operations.suppliers': 'owner_reported', 'operations.customerSegments': 'owner_reported', 'operations.currentSystems': 'observed',
          'performance.revenueRange': 'owner_reported', 'performance.customerVolume': 'owner_reported', 'performance.revenueStreams': 'owner_reported',
          'performance.operatingExpenses': 'owner_reported', 'performance.growthTrend': 'owner_reported', 'performance.financialChallenges': 'owner_reported',
          'infrastructure.operations': 'observed', 'infrastructure.finance': 'observed', 'infrastructure.marketing': 'observed', 'infrastructure.sales': 'observed',
          'infrastructure.hr': 'observed', 'infrastructure.governance': 'owner_reported', 'infrastructure.customerMgmt': 'observed', 'infrastructure.recordKeeping': 'observed',
        },
        internalNotes: 'Strong growth candidate — disciplined owner, clean cash flow, just needs equipment financing and a lightweight digital record-keeping tool.',
      },
    }),
    mk({
      name: 'Fresh Grocers Ltd',
      industry: 'Grocery retail / FMCG',
      location: 'Nyali, Mombasa',
      data: {
        identity: {
          ownerName: 'Hassan Mwakio', ownerPhone: '0733 210 764', ownerEmail: 'hassan@freshgrocers.co.ke',
          country: 'Kenya', city: 'Mombasa',
          yearEstablished: '2018', registrationStatus: 'Limited Company', businessPhone: '0733 210 764', businessEmail: 'info@freshgrocers.co.ke',
        },
        operations: {
          productsServices: 'Fresh produce, packaged groceries and household essentials across two mini-mart branches.',
          employeeCount: '12 full-time, 3 part-time', locationCount: '2', operatingModel: 'Manager-run',
          suppliers: 'Local produce farmers (direct), Bidco, Unga Group, regional wholesalers',
          customerSegments: 'Nearby households, small hotels and eateries buying in bulk',
          currentSystems: 'A basic POS system at each till, Excel for stock reconciliation',
        },
        performance: {
          revenueRange: 'KES 1M–5M/mo', customerVolume: '~1,200 transactions/week across both branches',
          revenueStreams: 'Fresh produce (35%), packaged groceries (45%), household goods (20%)',
          operatingExpenses: 'Stock/inventory, rent for two premises, salaries, transport for produce runs',
          growthTrend: 'Stable', financialChallenges: 'Spoilage losses on fresh produce, and slow-moving stock tying up cash',
        },
        infrastructure: {
          operations: { level: 'established', note: 'Branch managers run daily opening/closing checklists' },
          finance: { level: 'basic', note: 'POS reports reconciled in Excel weekly; no accounting software' },
          marketing: { level: 'informal', note: 'In-store signage and occasional Facebook posts' },
          sales: { level: 'established', note: 'POS at both tills, loyalty punch cards for regulars' },
          technology: { level: 'basic', note: 'POS hardware, no inventory management software' },
          hr: { level: 'basic', note: 'Written contracts on file, no formal HR policies' },
          governance: { level: 'basic', note: 'Owner + two branch managers meet monthly' },
          customerMgmt: { level: 'informal', note: 'No CRM, loyalty tracked on paper punch cards' },
          recordKeeping: { level: 'basic', note: 'POS exports + Excel, no cloud backup' },
        },
        challenges: { selected: ['Cash flow', 'Technology', 'Distribution'], other: 'Losing an estimated 8–10% of fresh produce to spoilage monthly.' },
        growthNeeds: { selected: ['iTekTechnology', 'i3Launchpad'], notes: 'Needs inventory management to cut spoilage losses, and operational systems support to standardize both branches.' },
        verification: {
          'identity.ownerName': 'observed', 'identity.ownerPhone': 'owner_reported', 'identity.ownerEmail': 'owner_reported',
          'identity.yearEstablished': 'document_verified', 'identity.registrationStatus': 'document_verified', 'identity.businessPhone': 'observed', 'identity.businessEmail': 'owner_reported',
          'operations.productsServices': 'observed', 'operations.employeeCount': 'owner_reported', 'operations.locationCount': 'observed', 'operations.operatingModel': 'observed',
          'operations.suppliers': 'owner_reported', 'operations.customerSegments': 'owner_reported', 'operations.currentSystems': 'observed',
          'performance.revenueRange': 'owner_reported', 'performance.customerVolume': 'system_verified', 'performance.revenueStreams': 'owner_reported',
          'performance.operatingExpenses': 'owner_reported', 'performance.growthTrend': 'owner_reported', 'performance.financialChallenges': 'owner_reported',
          'infrastructure.operations': 'observed', 'infrastructure.finance': 'observed', 'infrastructure.sales': 'system_verified', 'infrastructure.technology': 'observed',
          'infrastructure.hr': 'document_verified', 'infrastructure.governance': 'owner_reported', 'infrastructure.recordKeeping': 'observed',
        },
        internalNotes: 'Two-branch operation with real POS data — good candidate for a system-verified performance baseline once we get direct POS export access.',
      },
    }),
    mk({
      name: 'GreenAcre Farms',
      industry: 'Horticulture / Agriculture',
      location: 'Elementaita, Nakuru',
      data: {
        identity: {
          ownerName: 'Samuel Kiptoo', ownerPhone: '0711 908 233', ownerEmail: '',
          country: 'Kenya', city: 'Nakuru',
          yearEstablished: '2016', registrationStatus: 'Sole Proprietorship', businessPhone: '0711 908 233', businessEmail: '',
        },
        operations: {
          productsServices: 'French beans and snow peas for export, plus a small poultry unit for local sale.',
          employeeCount: '6 permanent, up to 20 seasonal during harvest', locationCount: '1 (12-acre farm)', operatingModel: 'Family-run',
          suppliers: 'Agrovet for seeds/inputs, a local exporter aggregator for produce pickup',
          customerSegments: 'Export aggregator (bulk), local market traders for poultry',
          currentSystems: 'None — all planning done by memory and a paper planting calendar',
        },
        performance: {
          revenueRange: 'KES 50K–200K/mo', customerVolume: '',
          revenueStreams: 'Export produce (80%), poultry (20%)',
          operatingExpenses: 'Seasonal labor, seeds and fertilizer, transport to aggregator',
          growthTrend: 'Seasonal / Fluctuating', financialChallenges: 'Cash is tight between planting and first harvest payout; export price swings',
        },
        infrastructure: {
          operations: { level: 'informal', note: "Planting/harvest timing kept in the owner's head and a paper calendar" },
          finance: { level: 'none', note: 'No separation between farm and household money' },
          marketing: { level: 'none', note: '' },
          sales: { level: 'informal', note: 'Single buyer relationship, no other outlets explored' },
          technology: { level: 'none', note: '' },
          hr: { level: 'informal', note: 'Seasonal workers paid in cash daily, no records' },
          governance: { level: 'informal', note: 'Family decision-making, no formal structure' },
          customerMgmt: { level: 'none', note: '' },
          recordKeeping: { level: 'none', note: 'No records of yields or costs kept' },
        },
        challenges: { selected: ['Cash flow', 'Capital', 'Market access', 'Management'], other: 'Entirely dependent on one export aggregator — no pricing power.' },
        growthNeeds: { selected: ['impactFund', 'i3Launchpad', 'i3xEvents'], notes: 'Needs basic record-keeping and cash flow planning, plus access to more than one buyer to reduce price risk.' },
        verification: {
          'identity.ownerName': 'owner_reported', 'identity.ownerPhone': 'owner_reported', 'identity.yearEstablished': 'owner_reported',
          'identity.registrationStatus': 'owner_reported', 'identity.businessPhone': 'owner_reported',
          'operations.productsServices': 'owner_reported', 'operations.employeeCount': 'owner_reported', 'operations.locationCount': 'owner_reported', 'operations.operatingModel': 'owner_reported',
          'operations.suppliers': 'owner_reported', 'operations.customerSegments': 'owner_reported', 'operations.currentSystems': 'owner_reported',
          'performance.revenueRange': 'owner_reported', 'performance.revenueStreams': 'owner_reported', 'performance.operatingExpenses': 'owner_reported',
          'performance.growthTrend': 'owner_reported', 'performance.financialChallenges': 'owner_reported',
          'infrastructure.operations': 'owner_reported', 'infrastructure.sales': 'owner_reported', 'infrastructure.hr': 'owner_reported', 'infrastructure.governance': 'owner_reported',
        },
        internalNotes: 'Not yet site-visited — everything here is from an intake call. Flagging for a field visit to verify yields and firm up the finance picture.',
      },
    }),
  ];
}

const REG_STATUS = ['Unregistered', 'Sole Proprietorship', 'Registered Business Name', 'Limited Company', 'Cooperative', 'NGO / Non-profit', 'Other'];
const OPERATING_MODELS = ['Owner-operated', 'Manager-run', 'Franchise', 'Family-run', 'Remote / Online', 'Hybrid'];
const REVENUE_RANGES = ['Pre-revenue', 'Under KES 50K/mo', 'KES 50K–200K/mo', 'KES 200K–500K/mo', 'KES 500K–1M/mo', 'KES 1M–5M/mo', 'Over KES 5M/mo', 'Prefer not to share'];

// Country/city are structured (select) fields so the registry can be filtered
// reliably — starting with Kenya's major cities/towns; add more countries here
// as TOIG's roster grows beyond Kenya.
const COUNTRIES = ['Kenya'];
const CITIES_BY_COUNTRY = {
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale', 'Garissa', 'Kakamega', 'Nyeri', 'Machakos', 'Meru', 'Naivasha', 'Kericho'],
};
const citiesFor = (country) => CITIES_BY_COUNTRY[country] || [];

// Legacy rows (and any entry saved without a country/city pick) fall back to
// Kenya — the registry has only ever tracked Kenyan businesses so far — and to
// the trailing ", City" part of the free-text location, if there is one.
const effectiveCountry = (entry) => entry?.data?.identity?.country || 'Kenya';
const effectiveCity = (entry) => {
  const c = entry?.data?.identity?.city;
  if (c) return c;
  const parts = (entry?.location || '').split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : '';
};
const GROWTH_TRENDS = ['Growing', 'Stable', 'Declining', 'Seasonal / Fluctuating', 'Too early to tell'];

const INFRA_AREAS = [
  { key: 'operations', label: 'Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'sales', label: 'Sales' },
  { key: 'technology', label: 'Technology' },
  { key: 'hr', label: 'Human Resources' },
  { key: 'governance', label: 'Governance' },
  { key: 'customerMgmt', label: 'Customer Management' },
  { key: 'recordKeeping', label: 'Record Keeping' },
];
const INFRA_LEVELS = [
  { key: 'none', label: 'None' },
  { key: 'informal', label: 'Informal' },
  { key: 'basic', label: 'Basic tools' },
  { key: 'established', label: 'Established' },
];

const CHALLENGES = ['Customer acquisition', 'Cash flow', 'Operations', 'Staffing', 'Technology', 'Marketing', 'Distribution', 'Capital', 'Management', 'Compliance', 'Market access'];

const GROWTH_NEEDS = [
  { key: 'i3Launchpad', name: 'I3 Launchpad', desc: 'Business growth and operational systems' },
  { key: 'iPlusMarketing', name: 'I+ Marketing', desc: 'Marketing and customer acquisition' },
  { key: 'iTekTechnology', name: 'iTek Technology', desc: 'Technology, automation and digital systems' },
  { key: 'i3Studios', name: 'I3 Studios', desc: 'Creative and media production' },
  { key: 'i3xEvents', name: 'I3X Africa Events', desc: 'Connections, platforms and market access' },
  { key: 'impactFund', name: 'ImpactFund', desc: 'Capital readiness and financing opportunities' },
  { key: 'impact360', name: 'Impact360', desc: 'Ecosystem access and decentralized opportunities' },
];

// Verification tiers borrow the app's semantic tokens (warning/info/success)
// plus one indigo for the highest-trust tier, which has no existing token.
const VERIFICATION = [
  { key: 'owner_reported', label: 'Owner-Reported', varColor: 'var(--color-warning)' },
  { key: 'observed', label: 'Observed', varColor: 'var(--color-info)' },
  { key: 'document_verified', label: 'Document-Verified', varColor: 'var(--color-success)' },
  { key: 'system_verified', label: 'System-Verified', varColor: '#6366F1' },
];
const verificationOf = (key) => VERIFICATION.find((v) => v.key === key) || VERIFICATION[0];

// Six hues pulled from tints already used elsewhere in ACR (see BusinessesPanel's
// SECTOR_TINT) plus two siblings, so record avatars feel native to the app.
const AVATAR_HUES = ['#5B9BFF', '#F5A623', '#9B8CFF', '#4ECDC4', '#F0709A', '#6EE7B7'];
const hashOf = (str) => { let h = 0; for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const avatarTint = (name) => AVATAR_HUES[hashOf(name || '?') % AVATAR_HUES.length];

const SECTIONS = [
  { key: 'identity', num: '01', label: 'Identity', icon: User },
  { key: 'operations', num: '02', label: 'Operations', icon: ShoppingBag },
  { key: 'performance', num: '03', label: 'Performance', icon: DollarSign },
  { key: 'infrastructure', num: '04', label: 'Infrastructure', icon: Wrench },
  { key: 'challenges', num: '05', label: 'Challenges', icon: AlertTriangle },
  { key: 'growth', num: '06', label: 'Growth Needs', icon: Rocket },
];

// Business name / industry / location are counted as part of Identity (they
// display in Section 1, in the order the brief lists them) even though they
// are stored as their own top-level registry columns, not inside `data`.
const IDENTITY_FIELD_COUNT = 12;
const OPERATIONS_FIELD_COUNT = 7;
const PERFORMANCE_FIELD_COUNT = 6;
const PROFILE_TOTAL_FIELDS = IDENTITY_FIELD_COUNT + OPERATIONS_FIELD_COUNT + PERFORMANCE_FIELD_COUNT + INFRA_AREAS.length + 1 + 1;

const emptyProfile = () => ({
  identity: { ownerName: '', ownerPhone: '', ownerEmail: '', country: '', city: '', yearEstablished: '', registrationStatus: '', businessPhone: '', businessEmail: '' },
  operations: { productsServices: '', employeeCount: '', locationCount: '', operatingModel: '', suppliers: '', customerSegments: '', currentSystems: '' },
  performance: { revenueRange: '', customerVolume: '', revenueStreams: '', operatingExpenses: '', growthTrend: '', financialChallenges: '' },
  infrastructure: Object.fromEntries(INFRA_AREAS.map((a) => [a.key, { level: '', note: '' }])),
  challenges: { selected: [], other: '' },
  growthNeeds: { selected: [], notes: '' },
  verification: {},
  internalNotes: '',
});

// The full edit buffer for one business: name/industry/location (their own
// registry columns) alongside the JSONB profile fields — one flat object so
// the whole thing is a single form.
const blankDraft = () => ({ name: '', industry: '', location: '', ...emptyProfile() });
const topLevelFilled = (obj) => [obj?.name, obj?.industry, obj?.location].filter((v) => (v || '').toString().trim()).length;

// Defensive merge so a profile saved before a schema change (a new field, a new
// infrastructure area) doesn't blow up — unknown saved keys are kept, missing
// ones fall back to the empty shape.
function mergeProfile(saved) {
  const base = emptyProfile();
  if (!saved || typeof saved !== 'object') return base;
  return {
    identity: { ...base.identity, ...(saved.identity || {}) },
    operations: { ...base.operations, ...(saved.operations || {}) },
    performance: { ...base.performance, ...(saved.performance || {}) },
    infrastructure: Object.fromEntries(INFRA_AREAS.map((a) => [a.key, { ...base.infrastructure[a.key], ...((saved.infrastructure || {})[a.key] || {}) }])),
    challenges: { ...base.challenges, ...(saved.challenges || {}) },
    growthNeeds: { ...base.growthNeeds, ...(saved.growthNeeds || {}) },
    verification: { ...(saved.verification || {}) },
    internalNotes: saved.internalNotes || '',
  };
}

const filledCount = (obj) => Object.values(obj).filter((v) => (v || '').toString().trim()).length;

// entry = { name, industry, location, data } — either a registry row or the
// live edit buffer, both shaped the same way.
function profileCompleteness(entry) {
  const p = mergeProfile(entry?.data);
  const infraFilled = INFRA_AREAS.filter((a) => p.infrastructure[a.key]?.level).length;
  const filled = topLevelFilled(entry) + filledCount(p.identity) + filledCount(p.operations) + filledCount(p.performance) + infraFilled
    + (p.challenges.selected.length > 0 ? 1 : 0)
    + (p.growthNeeds.selected.length > 0 ? 1 : 0);
  return { filled, total: PROFILE_TOTAL_FIELDS, pct: PROFILE_TOTAL_FIELDS ? Math.round((filled / PROFILE_TOTAL_FIELDS) * 100) : 0 };
}

function Avatar({ name, size = 38 }) {
  const tint = avatarTint(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 700, fontFamily: 'var(--font-display)',
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// Circular completeness gauge — a single instance per page (detail view only)
// so the gradient id never collides.
function CompletenessRing({ pct, size = 76, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#biz-ring-grad)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 300ms ease' }}
      />
      <defs>
        <linearGradient id="biz-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E4FB8" />
          <stop offset="100%" stopColor="#5B9BFF" />
        </linearGradient>
      </defs>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight="700" fill="var(--color-text-primary)" fontFamily="var(--font-mono)">
        {pct}%
      </text>
    </svg>
  );
}

function VerificationBadge({ value, onChange }) {
  const v = verificationOf(value);
  return (
    <select
      value={value || 'owner_reported'}
      onChange={(e) => onChange(e.target.value)}
      title="Data verification level"
      onClick={(e) => e.stopPropagation()}
      className="biz-verify"
      style={{ color: v.varColor, background: `color-mix(in srgb, ${v.varColor} 14%, transparent)`, borderColor: `color-mix(in srgb, ${v.varColor} 40%, transparent)` }}
    >
      {VERIFICATION.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

// Non-interactive stand-in for VerificationBadge, used on the read-only view.
function VerificationTag({ value }) {
  const v = verificationOf(value);
  return (
    <span
      className="biz-verify"
      style={{ color: v.varColor, background: `color-mix(in srgb, ${v.varColor} 14%, transparent)`, borderColor: `color-mix(in srgb, ${v.varColor} 40%, transparent)`, cursor: 'default', display: 'inline-block' }}
    >
      {v.label}
    </span>
  );
}

// A single property row: fixed-width mono label on the left, control on the
// right, verification badge trailing when the field has a value. Rows share
// one hairline rhythm instead of each field living in its own boxed tile.
function Field({ label, value, onChange, verification, onVerify, type = 'text', options, placeholder, rows, hint }) {
  const readOnly = useContext(ViewModeContext);
  const hasValue = (value || '').toString().trim().length > 0;
  return (
    <div className="biz-row">
      <label className="biz-row-label">{label}</label>
      <div className="biz-row-control">
        {readOnly ? (
          <div className="biz-static">{hasValue ? value : <span className="biz-static-empty">Not recorded</span>}</div>
        ) : type === 'select' ? (
          <select className="biz-input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea className="biz-input biz-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows || 2} />
        ) : (
          <input className="biz-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        )}
        {hint && !readOnly && <div className="biz-hint">{hint}</div>}
      </div>
      {onVerify && hasValue && (readOnly ? <VerificationTag value={verification} /> : <VerificationBadge value={verification} onChange={onVerify} />)}
    </div>
  );
}

function InfraRow({ area, value, onChange, verification, onVerify }) {
  const readOnly = useContext(ViewModeContext);
  const v = value || { level: '', note: '' };
  const levelLabel = INFRA_LEVELS.find((lv) => lv.key === v.level)?.label;
  return (
    <div className="biz-row">
      <label className="biz-row-label">{area.label}</label>
      <div className="biz-row-control">
        {readOnly ? (
          <div className="biz-static">
            {levelLabel || <span className="biz-static-empty">Not recorded</span>}
            {v.note ? ` — ${v.note}` : ''}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INFRA_LEVELS.map((lv) => (
                <button key={lv.key} type="button" onClick={() => onChange({ ...v, level: lv.key })} className={`biz-pill ${v.level === lv.key ? 'active' : ''}`}>
                  {lv.label}
                </button>
              ))}
            </div>
            <input className="biz-input" style={{ marginTop: 8 }} placeholder="What do they use, if anything? (optional)" value={v.note} onChange={(e) => onChange({ ...v, note: e.target.value })} />
          </>
        )}
      </div>
      {v.level && (readOnly ? <VerificationTag value={verification} /> : <VerificationBadge value={verification} onChange={onVerify} />)}
    </div>
  );
}

export default function BusinessIntelPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();

  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const isAcr = isDemo || !!agencies?.find((a) => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));
  const demoKey = `demo-toig-registry-${agencyId || 'x'}`;

  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [view, setView] = useState('registry'); // 'registry' | 'detail'
  const [selectedId, setSelectedId] = useState('');
  const [detailMode, setDetailMode] = useState('view'); // 'view' | 'edit'

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [profile, setProfile] = useState(blankDraft());
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('identity');

  // Registry-list filters — country first (just Kenya for now), city narrows
  // within it. Both apply to the list, the insight cards, and the count below.
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const filteredEntries = useMemo(() => entries.filter((e) =>
    (!filterCountry || effectiveCountry(e) === filterCountry) &&
    (!filterCity || effectiveCity(e) === filterCity)
  ), [entries, filterCountry, filterCity]);

  const activeEntry = useMemo(() => entries.find((e) => e.id === selectedId), [entries, selectedId]);

  // Three top-line reads on the registry itself — where these businesses sit
  // financially, whether they're trending up, and what kind of TOIG support
  // they need most. The registry's counterpart to the Revenue/Expenses/Profit
  // snapshot on the home page, just drawn from profile data instead of daily
  // finance entries (this roster has no numeric revenue of its own).
  const registryInsights = useMemo(() => {
    const profiles = filteredEntries.map((e) => mergeProfile(e.data));

    const revenueCounts = new Map();
    profiles.forEach((p) => {
      if (p.performance.revenueRange) revenueCounts.set(p.performance.revenueRange, (revenueCounts.get(p.performance.revenueRange) || 0) + 1);
    });
    let topRevenue = null, topRevenueCount = 0;
    revenueCounts.forEach((count, band) => { if (count > topRevenueCount) { topRevenue = band; topRevenueCount = count; } });
    const revenueTotal = [...revenueCounts.values()].reduce((a, b) => a + b, 0);

    const trends = profiles.map((p) => p.performance.growthTrend).filter(Boolean);
    const growingCount = trends.filter((t) => t === 'Growing').length;
    const growingPct = trends.length ? Math.round((growingCount / trends.length) * 100) : null;

    const needCounts = new Map();
    profiles.forEach((p) => p.growthNeeds.selected.forEach((k) => needCounts.set(k, (needCounts.get(k) || 0) + 1)));
    let topNeedKey = null, topNeedCount = 0;
    needCounts.forEach((count, key) => { if (count > topNeedCount) { topNeedKey = key; topNeedCount = count; } });
    const topNeedName = topNeedKey ? GROWTH_NEEDS.find((n) => n.key === topNeedKey)?.name : null;

    return { topRevenue, topRevenueCount, revenueTotal, growingCount, growingPct, trendTotal: trends.length, topNeedName, topNeedCount };
  }, [filteredEntries]);

  // Reset the edit buffer when a different entry is opened — adjusted during
  // render (not an effect) so it lands in the same commit as the id change.
  // '__new__' is a not-yet-saved draft; it never matches an entry, so this
  // guard naturally leaves its blank buffer alone.
  const [loadedForId, setLoadedForId] = useState('');
  if (selectedId && selectedId !== loadedForId && activeEntry) {
    setLoadedForId(selectedId);
    const merged = mergeProfile(activeEntry.data);
    // location is stored as the combined "Area, City" display string — strip the
    // ", City" suffix back off so the Area field doesn't duplicate identity.city.
    const citySuffix = merged.identity.city ? `, ${merged.identity.city}` : '';
    const area = citySuffix && (activeEntry.location || '').endsWith(citySuffix)
      ? activeEntry.location.slice(0, -citySuffix.length)
      : (activeEntry.location || '');
    setProfile({ name: activeEntry.name || '', industry: activeEntry.industry || '', location: area, ...merged });
    setActiveSection('identity');
  }

  // Load the registry — its own roster, unrelated to ACR's `businesses` table.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingEntries(true);
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(demoKey); list = raw ? JSON.parse(raw) : []; } catch (_) {}
        if (!cancelled) { setEntries(list); setLoadingEntries(false); }
        return;
      }
      if (!agencyId) { if (!cancelled) { setEntries([]); setLoadingEntries(false); } return; }
      try {
        const { data } = await createClient().from('toig_business_registry').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
        if (!cancelled) { setEntries(data || []); setLoadingEntries(false); }
      } catch (err) { console.error(err); if (!cancelled) setLoadingEntries(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [agencyId, isDemo, demoKey]);

  const persistDemoEntries = (next) => { try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const openEntry = (id, mode = 'view') => { setSelectedId(id); setDetailMode(mode); setView('detail'); };
  const backToRegistry = () => { setView('registry'); setSelectedId(''); setLoadedForId(''); };

  // Opens straight into a blank profile page — nothing is created in the
  // registry until Save is pressed, so there's just one form, not a quick-add
  // step followed by a separate detail page.
  const startNewBusiness = () => {
    setProfile(blankDraft());
    setSelectedId('__new__');
    setLoadedForId('__new__');
    setActiveSection('identity');
    setDetailMode('edit');
    setView('detail');
  };

  // Demo mode only — three fleshed-out sample businesses so the registry
  // isn't empty on first look. Never touches the real database.
  const loadSampleData = () => {
    if (!isDemo) return;
    const sample = buildSampleEntries();
    const next = [...entries, ...sample];
    setEntries(next);
    persistDemoEntries(next);
    toast.success('Sample data loaded', `Added ${sample.length} sample businesses to the registry.`);
  };

  const removeEntry = async (id) => {
    setConfirmDeleteId(null);
    if (selectedId === id) backToRegistry();
    if (isDemo) {
      const next = entries.filter((e) => e.id !== id);
      setEntries(next); persistDemoEntries(next);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try { await createClient().from('toig_business_registry').delete().eq('id', id); } catch (err) { console.error(err); }
  };

  const setField = (section, key, value) => setProfile((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
  const setVerify = (path, level) => setProfile((p) => ({ ...p, verification: { ...p.verification, [path]: level } }));
  const setInfra = (areaKey, value) => setProfile((p) => ({ ...p, infrastructure: { ...p.infrastructure, [areaKey]: value } }));
  const toggleChallenge = (key) => setProfile((p) => {
    const has = p.challenges.selected.includes(key);
    return { ...p, challenges: { ...p.challenges, selected: has ? p.challenges.selected.filter((k) => k !== key) : [...p.challenges.selected, key] } };
  });
  const toggleGrowthNeed = (key) => setProfile((p) => {
    const has = p.growthNeeds.selected.includes(key);
    return { ...p, growthNeeds: { ...p.growthNeeds, selected: has ? p.growthNeeds.selected.filter((k) => k !== key) : [...p.growthNeeds.selected, key] } };
  });

  const isNewDraft = selectedId === '__new__';
  const isViewOnly = detailMode === 'view' && !isNewDraft;

  const handleSaveProfile = async () => {
    const name = profile.name.trim();
    if (!name) return;
    if (!isDemo && !agencyId) return;
    setSaving(true);
    // location keeps its old "Area, City" display shape (used in the record list
    // and rail) even though City is now its own structured, filterable field.
    const displayLocation = [profile.location.trim(), profile.identity.city].filter(Boolean).join(', ');
    const base = { agency_id: agencyId, name, industry: profile.industry.trim() || null, location: displayLocation || null };
    const dataPayload = {
      identity: profile.identity, operations: profile.operations, performance: profile.performance,
      infrastructure: profile.infrastructure, challenges: profile.challenges, growthNeeds: profile.growthNeeds,
      verification: profile.verification, internalNotes: profile.internalNotes,
    };
    try {
      if (isDemo) {
        if (isNewDraft) {
          const created = { ...base, id: crypto.randomUUID(), data: dataPayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          const next = [...entries, created];
          setEntries(next); persistDemoEntries(next);
          setSelectedId(created.id); setLoadedForId(created.id);
          toast.success('Business registered', `"${name}" added to the registry.`);
        } else {
          const next = entries.map((e) => (e.id === selectedId ? { ...e, ...base, data: dataPayload, updated_at: new Date().toISOString() } : e));
          setEntries(next); persistDemoEntries(next);
          toast.success('Profile saved', `Growth profile for "${name}" saved locally.`);
        }
      } else {
        const sb = createClient();
        if (isNewDraft) {
          const { data, error } = await sb.from('toig_business_registry')
            .insert({ ...base, data: dataPayload, created_by: isUuid(userProfile?.id) ? userProfile.id : null })
            .select('*').maybeSingle();
          if (error) throw error;
          if (data) { setEntries((prev) => [...prev, data]); setSelectedId(data.id); setLoadedForId(data.id); }
          toast.success('Business registered', `"${name}" added to the registry.`);
        } else {
          const { data, error } = await sb.from('toig_business_registry')
            .update({ ...base, data: dataPayload, updated_by: isUuid(userProfile?.id) ? userProfile.id : null })
            .eq('id', selectedId).select('*').maybeSingle();
          if (error) throw error;
          if (data) setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
          toast.success('Profile saved', `Growth profile for "${name}" synced with the team.`);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Save failed', err.message || 'Could not save the profile — try again.');
    } finally {
      setSaving(false);
    }
  };

  const identityFilled = topLevelFilled(profile) + filledCount(profile.identity);
  const opsFilled = filledCount(profile.operations);
  const perfFilled = filledCount(profile.performance);
  const infraFilled = INFRA_AREAS.filter((a) => profile.infrastructure[a.key]?.level).length;
  const challengesFilled = profile.challenges.selected.length > 0 ? 1 : 0;
  const growthFilled = profile.growthNeeds.selected.length > 0 ? 1 : 0;

  const sectionCounts = {
    identity: { filled: identityFilled, total: IDENTITY_FIELD_COUNT },
    operations: { filled: opsFilled, total: OPERATIONS_FIELD_COUNT },
    performance: { filled: perfFilled, total: PERFORMANCE_FIELD_COUNT },
    infrastructure: { filled: infraFilled, total: INFRA_AREAS.length },
    challenges: { filled: challengesFilled, total: 1 },
    growth: { filled: growthFilled, total: 1 },
  };

  const completeness = useMemo(() => {
    const filled = identityFilled + opsFilled + perfFilled + infraFilled + challengesFilled + growthFilled;
    return { filled, total: PROFILE_TOTAL_FIELDS, pct: PROFILE_TOTAL_FIELDS ? Math.round((filled / PROFILE_TOTAL_FIELDS) * 100) : 0 };
  }, [identityFilled, opsFilled, perfFilled, infraFilled, challengesFilled, growthFilled]);

  const lastUpdatedLabel = useMemo(() => {
    const ts = activeEntry?.updated_at;
    if (!ts) return null;
    try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return null; }
  }, [activeEntry?.updated_at]);

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--color-error-bg)', color: 'var(--color-error)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Lock size={24} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>Restricted</div>
        <div style={{ fontSize: 13 }}>The Data Registry is available to managers and admins in ACR.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: view === 'detail' ? 1120 : 960, margin: '0 auto', padding: isMobile ? '14px 12px 60px' : '16px 16px 60px' }}>
      {view === 'registry' ? (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <div className="biz-eyebrow"><Sparkles size={11} /> TOIG Business Intelligence</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-.02em', fontFamily: 'var(--font-display)', marginTop: 2 }}>Data Registry</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 4 }}>TOIG&apos;s own roster of the businesses it works with — separate from ACR&apos;s managed businesses</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isDemo && <button className="biz-btn ghost" onClick={loadSampleData}><Sparkles size={14} /> Load sample data</button>}
              <button className="biz-btn primary" onClick={startNewBusiness}><Plus size={15} /> Register business</button>
            </div>
          </div>

          {!loadingEntries && entries.length > 0 && (
            <div className="biz-filter-row">
              <select
                className="biz-input biz-filter-select"
                value={filterCountry}
                onChange={(e) => { setFilterCountry(e.target.value); setFilterCity(''); }}
              >
                <option value="">All countries</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="biz-input biz-filter-select"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
              >
                <option value="">All cities</option>
                {citiesFor(filterCountry || 'Kenya').map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {(filterCountry || filterCity) && (
                <button className="biz-btn ghost sm" onClick={() => { setFilterCountry(''); setFilterCity(''); }}>Clear filters</button>
              )}
              <span className="biz-filter-count mono">{filteredEntries.length} / {entries.length} businesses</span>
            </div>
          )}

          {!loadingEntries && entries.length > 0 && (
            <div className="biz-insight-row">
              <div className="biz-insight-card">
                <DollarSign size={22} style={{ color: '#5B9BFF' }} />
                <div className="biz-insight-value">{registryInsights.topRevenue || '—'}</div>
                <div className="biz-insight-label">
                  Most common revenue band{registryInsights.revenueTotal > 0 ? ` · ${registryInsights.topRevenueCount}/${registryInsights.revenueTotal}` : ''}
                </div>
              </div>
              <div className="biz-insight-card">
                <TrendingUp size={22} style={{ color: '#22C55E' }} />
                <div className="biz-insight-value">{registryInsights.growingPct != null ? `${registryInsights.growingPct}%` : '—'}</div>
                <div className="biz-insight-label">
                  On a growth trajectory{registryInsights.trendTotal > 0 ? ` · ${registryInsights.growingCount}/${registryInsights.trendTotal}` : ''}
                </div>
              </div>
              <div className="biz-insight-card">
                <Rocket size={22} style={{ color: '#F5A623' }} />
                <div className="biz-insight-value">{registryInsights.topNeedName || '—'}</div>
                <div className="biz-insight-label">
                  Most requested support{registryInsights.topNeedCount > 0 ? ` · needed by ${registryInsights.topNeedCount}` : ''}
                </div>
              </div>
            </div>
          )}

          {loadingEntries ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 24 }}>Loading registry…</div>
          ) : entries.length === 0 ? (
            <div className="biz-panel" style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>Registry is empty</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>Register the first business TOIG is building a profile for.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="biz-btn primary" onClick={startNewBusiness}><Plus size={15} /> Register business</button>
                {isDemo && <button className="biz-btn ghost" onClick={loadSampleData}><Sparkles size={14} /> Load sample data</button>}
              </div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="biz-panel" style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>No businesses match these filters</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>Try a different country or city, or clear the filters.</div>
              <button className="biz-btn ghost" onClick={() => { setFilterCountry(''); setFilterCity(''); }}>Clear filters</button>
            </div>
          ) : (
            <div className="biz-panel biz-record-list">
              {filteredEntries.map((entry) => {
                const c = profileCompleteness(entry);
                const needNames = mergeProfile(entry.data).growthNeeds.selected
                  .map((k) => GROWTH_NEEDS.find((n) => n.key === k)?.name)
                  .filter(Boolean)
                  .slice(0, 2);
                return (
                  <div key={entry.id}>
                    <div className="biz-record-row" onClick={() => openEntry(entry.id, 'view')}>
                      <Avatar name={entry.name} />
                      <div className="biz-record-main">
                        <div className="biz-record-name">{entry.name}</div>
                        <div className="biz-record-meta">
                          <span>{entry.industry || 'No industry set'}</span>
                          {entry.location && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{entry.location}</span></>}
                        </div>
                      </div>
                      <div className="biz-record-needs">
                        {needNames.map((n) => <span key={n} className="biz-need-tag">{n}</span>)}
                      </div>
                      <div className="biz-record-pct mono">{c.pct}%</div>
                      <div className="biz-record-actions">
                        <button className="biz-icon" title="View" onClick={(e) => { e.stopPropagation(); openEntry(entry.id, 'view'); }}><Eye size={13} /></button>
                        <button className="biz-icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEntry(entry.id, 'edit'); }}><Pencil size={13} /></button>
                        <button className="biz-icon" title="Delete" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(entry.id); }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {confirmDeleteId === entry.id && (
                      <div className="biz-inline-confirm">
                        <span>Delete &quot;{entry.name}&quot; and its profile?</span>
                        <button className="biz-btn danger sm" onClick={() => removeEntry(entry.id)}>Delete</button>
                        <button className="biz-btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Detail top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="biz-back" onClick={backToRegistry}><ChevronLeft size={15} /> Registry</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isNewDraft && <button className="biz-icon" title="Delete business" onClick={() => setConfirmDeleteId(selectedId)}><Trash2 size={15} /></button>}
              {isViewOnly ? (
                <button className="biz-btn primary" onClick={() => setDetailMode('edit')}><Pencil size={14} /> Edit</button>
              ) : (
                <button className="biz-btn primary" onClick={handleSaveProfile} disabled={saving || !profile.name.trim()}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : isNewDraft ? <Plus size={14} /> : <Save size={14} />} {isNewDraft ? 'Register Business' : 'Save Profile'}
                </button>
              )}
            </div>
          </div>

          {!isNewDraft && confirmDeleteId === selectedId && (
            <div className="biz-inline-confirm" style={{ marginBottom: 14 }}>
              <span>Delete &quot;{profile.name}&quot; and its profile? This can&apos;t be undone.</span>
              <button className="biz-btn danger sm" onClick={() => removeEntry(selectedId)}>Delete</button>
              <button className="biz-btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
            </div>
          )}

          {!isViewOnly && !profile.name.trim() && (
            <div className="biz-notice">Give it a business name in the Identity tab before you can save.</div>
          )}

          <ViewModeContext.Provider value={isViewOnly}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left: identity rail */}
            <div className="biz-panel biz-rail" style={{ position: isMobile ? 'static' : 'sticky', top: 12 }}>
              <Avatar name={profile.name || '?'} size={52} />
              <div className="biz-rail-name">{profile.name || 'New business'}</div>
              <div className="biz-rail-meta">{profile.industry || 'No industry set'}</div>
              {profile.location && <div className="biz-rail-meta"><MapPin size={11} /> {profile.location}</div>}
              <div className="biz-rail-ring"><CompletenessRing pct={completeness.pct} /></div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>{completeness.filled} / {completeness.total} fields</div>
              {lastUpdatedLabel && <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 8 }}>Updated {lastUpdatedLabel}</div>}
            </div>

            {/* Right: tabbed sections */}
            <div className="biz-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="biz-tabstrip">
                {SECTIONS.map((s) => {
                  const cnt = sectionCounts[s.key];
                  const done = cnt.total > 0 && cnt.filled === cnt.total;
                  return (
                    <button key={s.key} className={`biz-tab ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>
                      <s.icon size={13} />
                      <span>{s.label}</span>
                      <span className={`biz-tab-count mono ${done ? 'done' : ''}`}>{cnt.filled}/{cnt.total}</span>
                    </button>
                  );
                })}
              </div>

              {/* Verification legend */}
              <div className="biz-legend">
                <Info size={11} /> Verification:
                {VERIFICATION.map((v) => (
                  <span key={v.key} className="biz-legend-tag" style={{ color: v.varColor, background: `color-mix(in srgb, ${v.varColor} 14%, transparent)` }}>{v.label}</span>
                ))}
              </div>

              <div className="biz-tabpanel">
                {activeSection === 'identity' && (
                  <div className="biz-proplist">
                    <Field label="Business name" value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} verification={profile.verification['identity.businessName']} onVerify={(v) => setVerify('identity.businessName', v)} placeholder="e.g. Sunshine Laundromat" />
                    <Field label="Owner / founder" value={profile.identity.ownerName} onChange={(v) => setField('identity', 'ownerName', v)} verification={profile.verification['identity.ownerName']} onVerify={(v) => setVerify('identity.ownerName', v)} placeholder="Full name" />
                    <Field label="Owner phone" value={profile.identity.ownerPhone} onChange={(v) => setField('identity', 'ownerPhone', v)} verification={profile.verification['identity.ownerPhone']} onVerify={(v) => setVerify('identity.ownerPhone', v)} placeholder="e.g. 07xx xxx xxx" />
                    <Field label="Owner email" value={profile.identity.ownerEmail} onChange={(v) => setField('identity', 'ownerEmail', v)} verification={profile.verification['identity.ownerEmail']} onVerify={(v) => setVerify('identity.ownerEmail', v)} placeholder="owner@example.com" />
                    <Field
                      label="Country" type="select" options={COUNTRIES} value={profile.identity.country}
                      onChange={(v) => setProfile((p) => ({ ...p, identity: { ...p.identity, country: v, city: citiesFor(v).includes(p.identity.city) ? p.identity.city : '' } }))}
                      verification={profile.verification['identity.country']} onVerify={(v) => setVerify('identity.country', v)}
                    />
                    <Field
                      label="City" type="select" options={citiesFor(profile.identity.country || 'Kenya')} value={profile.identity.city}
                      onChange={(v) => setField('identity', 'city', v)}
                      verification={profile.verification['identity.city']} onVerify={(v) => setVerify('identity.city', v)}
                    />
                    <Field label="Area / Neighbourhood" value={profile.location} onChange={(v) => setProfile((p) => ({ ...p, location: v }))} verification={profile.verification['identity.location']} onVerify={(v) => setVerify('identity.location', v)} placeholder="e.g. Westlands" />
                    <Field label="Industry" value={profile.industry} onChange={(v) => setProfile((p) => ({ ...p, industry: v }))} verification={profile.verification['identity.industry']} onVerify={(v) => setVerify('identity.industry', v)} placeholder="e.g. Laundry & garment care" />
                    <Field label="Year established" value={profile.identity.yearEstablished} onChange={(v) => setField('identity', 'yearEstablished', v)} verification={profile.verification['identity.yearEstablished']} onVerify={(v) => setVerify('identity.yearEstablished', v)} placeholder="e.g. 2021" />
                    <Field label="Registration status" type="select" options={REG_STATUS} value={profile.identity.registrationStatus} onChange={(v) => setField('identity', 'registrationStatus', v)} verification={profile.verification['identity.registrationStatus']} onVerify={(v) => setVerify('identity.registrationStatus', v)} />
                    <Field label="Business phone" value={profile.identity.businessPhone} onChange={(v) => setField('identity', 'businessPhone', v)} verification={profile.verification['identity.businessPhone']} onVerify={(v) => setVerify('identity.businessPhone', v)} placeholder="General business line" />
                    <Field label="Business email" value={profile.identity.businessEmail} onChange={(v) => setField('identity', 'businessEmail', v)} verification={profile.verification['identity.businessEmail']} onVerify={(v) => setVerify('identity.businessEmail', v)} placeholder="General business email" />
                  </div>
                )}

                {activeSection === 'operations' && (
                  <div className="biz-proplist">
                    <Field label="Products & services" type="textarea" value={profile.operations.productsServices} onChange={(v) => setField('operations', 'productsServices', v)} verification={profile.verification['operations.productsServices']} onVerify={(v) => setVerify('operations.productsServices', v)} placeholder="What does the business sell or offer?" />
                    <Field label="Employees" value={profile.operations.employeeCount} onChange={(v) => setField('operations', 'employeeCount', v)} verification={profile.verification['operations.employeeCount']} onVerify={(v) => setVerify('operations.employeeCount', v)} placeholder="e.g. 5 full-time, 2 part-time" />
                    <Field label="Locations" value={profile.operations.locationCount} onChange={(v) => setField('operations', 'locationCount', v)} verification={profile.verification['operations.locationCount']} onVerify={(v) => setVerify('operations.locationCount', v)} placeholder="e.g. 1" />
                    <Field label="Operating model" type="select" options={OPERATING_MODELS} value={profile.operations.operatingModel} onChange={(v) => setField('operations', 'operatingModel', v)} verification={profile.verification['operations.operatingModel']} onVerify={(v) => setVerify('operations.operatingModel', v)} />
                    <Field label="Suppliers" type="textarea" value={profile.operations.suppliers} onChange={(v) => setField('operations', 'suppliers', v)} verification={profile.verification['operations.suppliers']} onVerify={(v) => setVerify('operations.suppliers', v)} placeholder="Key suppliers or vendors relied on" />
                    <Field label="Customer segments" type="textarea" value={profile.operations.customerSegments} onChange={(v) => setField('operations', 'customerSegments', v)} verification={profile.verification['operations.customerSegments']} onVerify={(v) => setVerify('operations.customerSegments', v)} placeholder="Who buys from this business?" />
                    <Field label="Current tech & systems" type="textarea" value={profile.operations.currentSystems} onChange={(v) => setField('operations', 'currentSystems', v)} verification={profile.verification['operations.currentSystems']} onVerify={(v) => setVerify('operations.currentSystems', v)} placeholder="Any tools/software used day to day (POS, bookkeeping app, etc.)" />
                  </div>
                )}

                {activeSection === 'performance' && (
                  <div className="biz-proplist">
                    <Field label="Revenue range" type="select" options={REVENUE_RANGES} value={profile.performance.revenueRange} onChange={(v) => setField('performance', 'revenueRange', v)} verification={profile.verification['performance.revenueRange']} onVerify={(v) => setVerify('performance.revenueRange', v)} />
                    <Field label="Customer volume" value={profile.performance.customerVolume} onChange={(v) => setField('performance', 'customerVolume', v)} verification={profile.verification['performance.customerVolume']} onVerify={(v) => setVerify('performance.customerVolume', v)} placeholder="e.g. ~200 customers/month" />
                    <Field label="Major revenue streams" type="textarea" value={profile.performance.revenueStreams} onChange={(v) => setField('performance', 'revenueStreams', v)} verification={profile.verification['performance.revenueStreams']} onVerify={(v) => setVerify('performance.revenueStreams', v)} />
                    <Field label="Major operating expenses" type="textarea" value={profile.performance.operatingExpenses} onChange={(v) => setField('performance', 'operatingExpenses', v)} verification={profile.verification['performance.operatingExpenses']} onVerify={(v) => setVerify('performance.operatingExpenses', v)} />
                    <Field label="Growth trend" type="select" options={GROWTH_TRENDS} value={profile.performance.growthTrend} onChange={(v) => setField('performance', 'growthTrend', v)} verification={profile.verification['performance.growthTrend']} onVerify={(v) => setVerify('performance.growthTrend', v)} />
                    <Field label="Financial challenges" type="textarea" value={profile.performance.financialChallenges} onChange={(v) => setField('performance', 'financialChallenges', v)} verification={profile.verification['performance.financialChallenges']} onVerify={(v) => setVerify('performance.financialChallenges', v)} />
                  </div>
                )}

                {activeSection === 'infrastructure' && (
                  <div className="biz-proplist">
                    {INFRA_AREAS.map((area) => (
                      <InfraRow
                        key={area.key} area={area} value={profile.infrastructure[area.key]}
                        onChange={(v) => setInfra(area.key, v)}
                        verification={profile.verification[`infrastructure.${area.key}`]}
                        onVerify={(v) => setVerify(`infrastructure.${area.key}`, v)}
                      />
                    ))}
                  </div>
                )}

                {activeSection === 'challenges' && (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CHALLENGES.map((c) => {
                        const active = profile.challenges.selected.includes(c);
                        return (
                          <button key={c} type="button" disabled={isViewOnly} onClick={() => toggleChallenge(c)} className={`biz-chip ${active ? 'active' : ''}`}>
                            {active ? <CheckCircle2 size={13} /> : <Circle size={13} />} {c}
                          </button>
                        );
                      })}
                    </div>
                    <div className="biz-proplist" style={{ marginTop: 8 }}>
                      <Field label="Other / details" type="textarea" value={profile.challenges.other} onChange={(v) => setProfile((p) => ({ ...p, challenges: { ...p.challenges, other: v } }))} placeholder="Anything not covered above, or more detail on the ones selected" />
                    </div>
                  </div>
                )}

                {activeSection === 'growth' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
                      {GROWTH_NEEDS.map((need) => {
                        const active = profile.growthNeeds.selected.includes(need.key);
                        return (
                          <button key={need.key} type="button" disabled={isViewOnly} onClick={() => toggleGrowthNeed(need.key)} className={`biz-need-card ${active ? 'active' : ''}`}>
                            {active ? <CheckCircle2 size={17} color="var(--color-accent-primary)" style={{ flexShrink: 0 }} /> : <Circle size={17} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{need.name}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{need.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="biz-proplist" style={{ marginTop: 12 }}>
                      <Field label="Growth notes" type="textarea" value={profile.growthNeeds.notes} onChange={(v) => setProfile((p) => ({ ...p, growthNeeds: { ...p.growthNeeds, notes: v } }))} placeholder="Opportunities, partnerships or next steps to explore with this business" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="biz-panel" style={{ marginTop: 12 }}>
            <div className="biz-proplist">
              <Field label="Internal notes" type="textarea" rows={3} value={profile.internalNotes} onChange={(v) => setProfile((p) => ({ ...p, internalNotes: v }))} placeholder="Anything else worth recording — not shared with the business (TOIG team only)" />
            </div>
          </div>
          </ViewModeContext.Provider>

          {!isViewOnly && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="biz-btn primary" onClick={handleSaveProfile} disabled={saving || !profile.name.trim()}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save Profile
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        :global(.biz-panel) {
          background: var(--color-bg-elevated); border: 1px solid var(--color-border);
          border-radius: var(--radius-xl, 14px); box-shadow: var(--shadow-xs);
        }
        :global(.biz-eyebrow) {
          display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono);
          font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          color: var(--color-accent-secondary);
        }
        :global(.biz-input) {
          width: 100%; padding: 8px 11px; border-radius: var(--radius-md, 8px); font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: var(--font-sans); outline: none; transition: var(--transition-fast, .12s);
        }
        :global(.biz-input::placeholder) { color: var(--color-text-tertiary); }
        :global(.biz-input:focus) { border-color: var(--color-border-active); box-shadow: 0 0 0 3px var(--color-accent-primary-subtle); }
        :global(.biz-textarea) { resize: vertical; min-height: 40px; line-height: 1.5; }
        :global(.biz-hint) { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
        :global(.biz-btn) {
          display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 15px; border-radius: var(--radius-lg, 10px);
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; white-space: nowrap; transition: var(--transition-fast, .12s);
        }
        :global(.biz-btn.sm) { height: 28px; padding: 0 10px; font-size: 11.5px; border-radius: var(--radius-md, 8px); }
        :global(.biz-btn:hover) { border-color: var(--color-border-active); }
        :global(.biz-btn.primary) { background: var(--color-accent-gradient); border: none; color: #fff; }
        :global(.biz-btn.primary:disabled) { opacity: .5; cursor: not-allowed; }
        :global(.biz-btn.ghost) { background: transparent; }
        :global(.biz-btn.danger) { background: var(--color-error); border: none; color: #fff; }
        :global(.biz-back) {
          display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer;
          color: var(--color-text-secondary); font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); padding: 4px 2px;
        }
        :global(.biz-back:hover) { color: var(--color-text-primary); }
        :global(.biz-icon) {
          width: 30px; height: 30px; border-radius: var(--radius-md, 8px); border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
          color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition-fast, .12s); flex-shrink: 0;
        }
        :global(.biz-icon:hover) { color: var(--color-error); border-color: var(--color-error); }

        /* Registry filter bar */
        :global(.biz-filter-row) { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        :global(.biz-filter-select) { width: auto; min-width: 140px; }
        :global(.biz-filter-count) { font-size: 11.5px; color: var(--color-text-tertiary); margin-left: auto; }

        /* Registry insight cards */
        :global(.biz-insight-row) { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        :global(.biz-insight-card) {
          background: var(--color-bg-elevated); border: 1px solid var(--color-border);
          border-radius: var(--radius-xl, 14px); box-shadow: var(--shadow-xs); padding: 16px;
        }
        :global(.biz-insight-value) {
          font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--color-text-primary);
          letter-spacing: -.01em; margin-top: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        :global(.biz-insight-label) { font-size: 11px; color: var(--color-text-tertiary); margin-top: 3px; }
        @media (max-width: 640px) { :global(.biz-insight-row) { grid-template-columns: 1fr; } }

        /* Registry record list */
        :global(.biz-record-list) { overflow: hidden; }
        :global(.biz-record-row) {
          display: flex; align-items: center; gap: 12px; padding: 13px 16px; cursor: pointer; transition: background var(--transition-fast, .12s);
          border-top: 1px solid var(--color-border);
        }
        :global(.biz-record-list > div:first-child .biz-record-row) { border-top: none; }
        :global(.biz-record-row:hover) { background: var(--color-bg-hover); }
        :global(.biz-record-main) { min-width: 0; flex: 1; }
        :global(.biz-record-name) { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        :global(.biz-record-meta) { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 2px; flex-wrap: wrap; }
        :global(.biz-record-needs) { display: flex; gap: 6px; flex-shrink: 0; }
        :global(.biz-need-tag) {
          font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap;
          background: var(--color-accent-primary-subtle); color: var(--color-accent-secondary);
        }
        :global(.biz-record-pct) { font-size: 12px; font-weight: 700; color: var(--color-text-secondary); width: 34px; text-align: right; flex-shrink: 0; }
        :global(.biz-record-actions) { display: flex; gap: 6px; flex-shrink: 0; }
        @media (max-width: 640px) { :global(.biz-record-needs) { display: none; } }

        :global(.biz-inline-confirm) {
          display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 12px;
          background: var(--color-error-bg); border-top: 1px solid var(--color-border); color: var(--color-error); font-weight: 600;
        }
        :global(.biz-inline-confirm span) { flex: 1; }
        :global(.biz-notice) {
          font-size: 12px; color: var(--color-warning); background: var(--color-warning-bg);
          border: 1px solid var(--color-warning); border-radius: var(--radius-lg, 10px); padding: 9px 13px; margin-bottom: 14px;
        }

        /* Identity rail */
        :global(.biz-rail) { padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
        :global(.biz-rail-name) { font-family: var(--font-display); font-weight: 700; font-size: 15px; color: var(--color-text-primary); margin-top: 8px; }
        :global(.biz-rail-meta) { font-size: 11.5px; color: var(--color-text-tertiary); display: flex; align-items: center; gap: 4px; }
        :global(.biz-rail-ring) { margin: 12px 0 2px; }

        /* Section tab strip */
        :global(.biz-tabstrip) { display: flex; overflow-x: auto; border-bottom: 1px solid var(--color-border); padding: 0 8px; }
        :global(.biz-tab) {
          display: flex; align-items: center; gap: 6px; padding: 13px 12px; background: none; border: none; border-bottom: 2px solid transparent;
          color: var(--color-text-tertiary); font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; white-space: nowrap; transition: var(--transition-fast, .12s);
        }
        :global(.biz-tab:hover) { color: var(--color-text-secondary); }
        :global(.biz-tab.active) { color: var(--color-accent-secondary); border-bottom-color: var(--color-accent-primary); }
        :global(.biz-tab-count) { font-size: 10px; color: var(--color-text-tertiary); }
        :global(.biz-tab-count.done) { color: var(--color-success); }

        :global(.biz-legend) {
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 16px; font-size: 10.5px;
          color: var(--color-text-tertiary); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono);
        }
        :global(.biz-legend-tag) { padding: 2px 8px; border-radius: 999px; font-weight: 700; }

        :global(.biz-tabpanel) { padding: 4px 16px 16px; }

        /* Property row */
        :global(.biz-proplist) { display: flex; flex-direction: column; }
        :global(.biz-row) {
          display: grid; grid-template-columns: 168px 1fr auto; align-items: start; gap: 4px 14px;
          padding: 12px 4px; border-top: 1px solid var(--color-border);
        }
        :global(.biz-proplist > .biz-row:first-child) { border-top: none; }
        :global(.biz-row:hover) { background: var(--color-bg-hover); }
        :global(.biz-row-label) {
          font-family: var(--font-sans); font-size: 11.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase;
          color: var(--color-text-secondary); padding-top: 9px;
        }
        :global(.biz-row-control) { min-width: 0; }
        :global(.biz-static) { padding: 9px 0; font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); white-space: pre-wrap; line-height: 1.5; }
        :global(.biz-static-empty) { color: var(--color-text-tertiary); font-style: italic; }
        @media (max-width: 640px) {
          :global(.biz-row) { grid-template-columns: 1fr; }
          :global(.biz-row-label) { padding-top: 0; }
        }

        :global(.biz-verify) {
          font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em;
          border-radius: 999px; padding: 3px 8px; cursor: pointer; outline: none; font-family: var(--font-mono); border: 1px solid; margin-top: 6px;
        }
        :global(.biz-pill) {
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-secondary);
          border-radius: 999px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: var(--transition-fast, .12s);
        }
        :global(.biz-pill.active) { border-color: var(--color-accent-primary); background: var(--color-accent-primary-subtle); color: var(--color-text-primary); }
        :global(.biz-chip) {
          display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
          color: var(--color-text-secondary); border-radius: 999px; padding: 7px 13px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: var(--transition-fast, .12s);
        }
        :global(.biz-chip.active) { border-color: var(--color-error); background: var(--color-error-bg); color: var(--color-error); }
        :global(.biz-chip:disabled), :global(.biz-need-card:disabled) { cursor: default; }
        :global(.biz-need-card) {
          display: flex; gap: 10px; align-items: flex-start; text-align: left; cursor: pointer; font-family: var(--font-sans);
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); border-radius: var(--radius-lg, 12px); padding: 13px; transition: var(--transition-fast, .12s);
        }
        :global(.biz-need-card.active) { border-color: var(--color-accent-primary); background: var(--color-accent-primary-subtle); }
      `}</style>
    </div>
  );
}
