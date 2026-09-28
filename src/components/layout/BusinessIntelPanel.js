'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import ImgOrFallback from '@/components/ui/ImgOrFallback';
import {
  Sparkles, Lock, Save, RefreshCw, ChevronLeft,
  Plus, Trash2, User, ShoppingBag, Wrench, DollarSign, AlertTriangle,
  Rocket, CheckCircle2, Circle, Info, MapPin, TrendingUp, Eye, Pencil, ChevronRight, Users, X,
} from 'lucide-react';

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
        registeredBy: 'Amina Otieno',
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
        registeredBy: 'Amina Otieno',
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
        registeredBy: 'Peter Kamau',
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

// The edit / new-business form is a stepped wizard. It opens on Registration (who
// is registering the business + internal notes), then walks the six profile
// sections; the last step is where it is submitted. The read-only view is the
// report (BusinessReport), not this form.
const STEPS = [
  { key: 'registration', icon: Info, label: 'Registration', title: 'Registration', desc: 'Who is registering this business, plus any internal notes.' },
  { key: 'identity', icon: User, label: 'Identity', title: 'Business identity', desc: 'Who the business is, who owns it and how to reach them.' },
  { key: 'operations', icon: ShoppingBag, label: 'Operations', title: 'Operations', desc: 'What the business sells and how it runs day to day.' },
  { key: 'performance', icon: DollarSign, label: 'Performance', title: 'Performance', desc: 'A high-level read on revenue, customers and growth.' },
  { key: 'infrastructure', icon: Wrench, label: 'Infrastructure', title: 'Infrastructure', desc: 'How developed each business function is today, from none to established.' },
  { key: 'challenges', icon: AlertTriangle, label: 'Challenges', title: 'Challenges', desc: 'Select everything that is holding the business back.' },
  { key: 'growth', icon: Rocket, label: 'Growth needs', title: 'Growth needs', desc: 'Where TOIG support could help this business most.' },
];
const STEP_INDEX = Object.fromEntries(STEPS.map((st, i) => [st.key, i]));

// Business name / industry / location are counted as part of Identity (they
// display in Section 1, in the order the brief lists them) even though they
// are stored as their own top-level registry columns, not inside `data`.
const IDENTITY_FIELD_COUNT = 14;
const OPERATIONS_FIELD_COUNT = 7;
const PERFORMANCE_FIELD_COUNT = 6;
const PROFILE_TOTAL_FIELDS = IDENTITY_FIELD_COUNT + OPERATIONS_FIELD_COUNT + PERFORMANCE_FIELD_COUNT + INFRA_AREAS.length + 1 + 1;

const emptyProfile = () => ({
  identity: { ownerName: '', ownerPhone: '', ownerEmail: '', country: '', city: '', yearEstablished: '', registrationStatus: '', businessPhone: '', businessEmail: '', hasWebsite: '', website: '' },
  operations: { productsServices: '', employeeCount: '', locationCount: '', operatingModel: '', suppliers: '', customerSegments: '', currentSystems: '' },
  performance: { revenueRange: '', customerVolume: '', revenueStreams: '', operatingExpenses: '', growthTrend: '', financialChallenges: '' },
  infrastructure: Object.fromEntries(INFRA_AREAS.map((a) => [a.key, { level: '', note: '' }])),
  challenges: { selected: [], other: '' },
  growthNeeds: { selected: [], notes: '' },
  verification: {},
  registeredBy: '',
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
    registeredBy: saved.registeredBy || '',
    internalNotes: saved.internalNotes || '',
  };
}

// "Registered by" is free text, so people are grouped ignoring case and spacing
// ("grace  w" and "Grace W" are one person). Records that predate the field fall
// back to whoever created them (resolved server-side into `creators`).
const normName = (n) => (n || '').trim().replace(/\s+/g, ' ');
const nameKey = (n) => normName(n).toLowerCase();
const NO_REGISTRAR = '__none__';
// A name as separate lowercase words, for matching a typed "Registered by" to a team
// member when it isn't spelled exactly like their profile ("Grace", "grace w.").
const nameTokens = (n) => nameKey(n).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const registrarNameOf = (entry, creators) => normName(entry?.data?.registeredBy) || normName(creators?.[entry?.created_by]);

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
    <div className="biz-avatar" style={{
      '--tint': tint, width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: `${tint}22`, color: 'var(--person-ink, var(--tint))', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 700, fontFamily: 'var(--font-display)',
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// A person's profile picture, or a tinted initial when there's no picture (or it
// fails to load). Round, unlike Avatar which is the rounded-square used for businesses.
function PersonAvatar({ name, url, size = 34 }) {
  const tint = avatarTint(name);
  return (
    <span className="biz-person" style={{ '--tint': tint, width: size, height: size, background: `${tint}22`, color: 'var(--person-ink, var(--tint))', fontSize: Math.round(size * 0.44) }}>
      <ImgOrFallback src={url} alt="" fallback={(name || '?').charAt(0).toUpperCase()} />
    </span>
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
function Field({ label, value, onChange, verification, onVerify, type = 'text', options, placeholder, rows, hint, error, required, half }) {
  const hasValue = (value || '').toString().trim().length > 0;
  const errClass = error ? ' error' : '';
  return (
    <div className={`biz-row${half ? ' biz-half' : ''}`}>
      <label className="biz-row-label">{label}{required && <span className="biz-req" aria-hidden="true"> *</span>}</label>
      <div className="biz-row-control">
        {type === 'select' ? (
          <select className={`biz-input${errClass}`} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea className={`biz-input biz-textarea${errClass}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows || 2} />
        ) : (
          <input className={`biz-input${errClass}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={!!error} />
        )}
        {error ? <div className="biz-field-error">{error}</div> : (hint && <div className="biz-hint">{hint}</div>)}
      </div>
      {onVerify && hasValue && <VerificationBadge value={verification} onChange={onVerify} />}
    </div>
  );
}

function InfraRow({ area, value, onChange, verification, onVerify, half }) {
  const v = value || { level: '', note: '' };
  return (
    <div className={`biz-row${half ? ' biz-half' : ''}`}>
      <label className="biz-row-label">{area.label}</label>
      <div className="biz-row-control">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INFRA_LEVELS.map((lv) => (
            <button key={lv.key} type="button" onClick={() => onChange({ ...v, level: lv.key })} className={`biz-pill ${v.level === lv.key ? 'active' : ''}`}>
              {lv.label}
            </button>
          ))}
        </div>
        <input className="biz-input" style={{ marginTop: 8 }} placeholder="What do they use, if anything? (optional)" value={v.note} onChange={(e) => onChange({ ...v, note: e.target.value })} />
      </div>
      {v.level && <VerificationBadge value={verification} onChange={onVerify} />}
    </div>
  );
}

// Numbered progress indicator: done steps are filled, the current step is ringed,
// upcoming steps are grey, and the line fills up to the current step. Every dot is
// clickable so an existing profile can be edited without paging through it.
function Stepper({ steps, current, onGo }) {
  return (
    <ol className="biz-stepper" aria-label="Registration progress">
      {steps.map((st, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={st.key} className={`biz-step ${state}`} aria-current={i === current ? 'step' : undefined}>
            <button type="button" className="biz-step-dot" onClick={() => onGo(i)} aria-label={`Step ${i + 1} of ${steps.length}: ${st.label}`}>{i + 1}</button>
            <span className="biz-step-label">{st.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Read-only report ─────────────────────────────────────────────────────────
// The view page is a report, not a form: only what has actually been recorded is
// shown (empty fields and empty sections disappear), grouped into numbered
// sections, with short facts in a grid and longer answers as paragraphs.
const has = (v) => (v ?? '').toString().trim().length > 0;
const pick = (rows) => rows.filter((r) => has(r[1]));
const websiteHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// "Owner-Reported" is the default and stated once in the footer; only a level
// that says something more (observed / document / system) is called out inline.
function ReportVerify({ value }) {
  if (!value || value === 'owner_reported') return null;
  return <VerificationTag value={value} />;
}

function ReportGrid({ rows, verification }) {
  if (!rows.length) return null;
  return (
    <div className="rpt-grid">
      {rows.map(([label, value, vKey, isLink]) => (
        <div key={label} className="rpt-fact">
          <div className="rpt-label">{label}</div>
          <div className="rpt-value">
            {isLink ? <a href={websiteHref(value)} target="_blank" rel="noopener noreferrer" className="rpt-link">{value}</a> : value}
            <ReportVerify value={vKey && verification[vKey]} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportNotes({ rows, verification }) {
  if (!rows.length) return null;
  return (
    <div className="rpt-notes">
      {rows.map(([label, value, vKey]) => (
        <div key={label} className="rpt-note">
          <div className="rpt-label">{label}<ReportVerify value={vKey && verification[vKey]} /></div>
          <p className="rpt-text">{value}</p>
        </div>
      ))}
    </div>
  );
}

function BusinessReport({ profile, completeness, updatedLabel, registrarUrl }) {
  const vf = profile.verification || {};
  const id = profile.identity, ops = profile.operations, perf = profile.performance;
  const sec = (key) => SECTIONS.find((x) => x.key === key);

  const identityFacts = pick([
    ['Owner / founder', id.ownerName, 'identity.ownerName'],
    ['Owner phone', id.ownerPhone, 'identity.ownerPhone'],
    ['Owner email', id.ownerEmail, 'identity.ownerEmail'],
    ['Country', id.country, 'identity.country'],
    ['City', id.city, 'identity.city'],
    ['Area / Neighbourhood', profile.location, 'identity.location'],
    ['Industry', profile.industry, 'identity.industry'],
    ['Year established', id.yearEstablished, 'identity.yearEstablished'],
    ['Registration status', id.registrationStatus, 'identity.registrationStatus'],
    ['Business phone', id.businessPhone, 'identity.businessPhone'],
    ['Business email', id.businessEmail, 'identity.businessEmail'],
    ['Website', id.hasWebsite === 'Yes' ? id.website : '', 'identity.website', true],
  ]);
  const opsFacts = pick([
    ['Employees', ops.employeeCount, 'operations.employeeCount'],
    ['Locations', ops.locationCount, 'operations.locationCount'],
    ['Operating model', ops.operatingModel, 'operations.operatingModel'],
  ]);
  const opsNotes = pick([
    ['Products & services', ops.productsServices, 'operations.productsServices'],
    ['Suppliers', ops.suppliers, 'operations.suppliers'],
    ['Customer segments', ops.customerSegments, 'operations.customerSegments'],
    ['Current tech & systems', ops.currentSystems, 'operations.currentSystems'],
  ]);
  const perfFacts = pick([
    ['Revenue range', perf.revenueRange, 'performance.revenueRange'],
    ['Customer volume', perf.customerVolume, 'performance.customerVolume'],
    ['Growth trend', perf.growthTrend, 'performance.growthTrend'],
  ]);
  const perfNotes = pick([
    ['Major revenue streams', perf.revenueStreams, 'performance.revenueStreams'],
    ['Major operating expenses', perf.operatingExpenses, 'performance.operatingExpenses'],
    ['Financial challenges', perf.financialChallenges, 'performance.financialChallenges'],
  ]);
  const infra = INFRA_AREAS
    .map((a) => ({ area: a, level: profile.infrastructure[a.key]?.level || '', note: profile.infrastructure[a.key]?.note || '', vKey: `infrastructure.${a.key}` }))
    .filter((x) => x.level || has(x.note));
  const challenges = profile.challenges.selected;
  const challengeNotes = pick([['Details', profile.challenges.other]]);
  const needs = GROWTH_NEEDS.filter((n) => profile.growthNeeds.selected.includes(n.key));
  const growthNotes = pick([['Growth notes', profile.growthNeeds.notes]]);
  const regFacts = pick([['Registered by', profile.registeredBy]]);
  const regNotes = pick([['Internal notes (TOIG team only)', profile.internalNotes]]);

  // Sections that have something to show, in order; numbered after the fact so
  // skipping an empty one doesn't leave a gap in the numbering.
  const sections = [];
  if (identityFacts.length) sections.push({ meta: sec('identity'), body: <ReportGrid rows={identityFacts} verification={vf} /> });
  if (opsFacts.length || opsNotes.length) sections.push({ meta: sec('operations'), body: <><ReportGrid rows={opsFacts} verification={vf} /><ReportNotes rows={opsNotes} verification={vf} /></> });
  if (perfFacts.length || perfNotes.length) sections.push({ meta: sec('performance'), body: <><ReportGrid rows={perfFacts} verification={vf} /><ReportNotes rows={perfNotes} verification={vf} /></> });
  if (infra.length) {
    sections.push({
      meta: sec('infrastructure'),
      body: (
        <div className="rpt-infra">
          {infra.map(({ area, level, note, vKey }) => {
            const idx = INFRA_LEVELS.findIndex((l) => l.key === level);
            return (
              <div key={area.key} className="rpt-infra-row">
                <div className="rpt-infra-name">{area.label}</div>
                <div className="rpt-infra-level">
                  {level && (
                    <>
                      <span className="rpt-meter" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= idx ? 'on' : ''} />)}</span>
                      <span>{INFRA_LEVELS[idx]?.label}</span>
                    </>
                  )}
                </div>
                <div className="rpt-infra-note">{note}<ReportVerify value={vf[vKey]} /></div>
              </div>
            );
          })}
        </div>
      ),
    });
  }
  if (challenges.length || challengeNotes.length) {
    sections.push({
      meta: sec('challenges'),
      body: (
        <>
          {challenges.length > 0 && <div className="rpt-tags">{challenges.map((c) => <span key={c} className="rpt-tag">{c}</span>)}</div>}
          <ReportNotes rows={challengeNotes} verification={vf} />
        </>
      ),
    });
  }
  if (needs.length || growthNotes.length) {
    sections.push({
      meta: sec('growth'),
      body: (
        <>
          {needs.length > 0 && (
            <div className="rpt-needs">
              {needs.map((n) => (
                <div key={n.key} className="rpt-need">
                  <div className="rpt-need-name">{n.name}</div>
                  <div className="rpt-need-desc">{n.desc}</div>
                </div>
              ))}
            </div>
          )}
          <ReportNotes rows={growthNotes} verification={vf} />
        </>
      ),
    });
  }
  if (regFacts.length || regNotes.length) {
    sections.push({ meta: { label: 'Registration', icon: Info }, body: <><ReportGrid rows={regFacts} verification={vf} /><ReportNotes rows={regNotes} verification={vf} /></> });
  }

  const snapshot = pick([
    ['Revenue range', perf.revenueRange],
    ['Growth trend', perf.growthTrend],
    ['Employees', ops.employeeCount],
    ['Customer volume', perf.customerVolume],
  ]);
  const locationLabel = [profile.location.trim(), id.city].filter(Boolean).join(', ');

  return (
    <div className="biz-panel rpt">
      <div className="rpt-head">
        <Avatar name={profile.name || '?'} size={60} />
        <div className="rpt-head-main">
          <div className="biz-eyebrow">Business profile</div>
          <h2 className="rpt-title">{profile.name || 'Unnamed business'}<ReportVerify value={vf['identity.businessName']} /></h2>
          {(has(profile.industry) || locationLabel) && (
            <div className="rpt-sub">
              {has(profile.industry) && <span>{profile.industry}</span>}
              {has(profile.industry) && locationLabel && <span aria-hidden="true">·</span>}
              {locationLabel && <span className="rpt-loc"><MapPin size={13} /> {locationLabel}</span>}
            </div>
          )}
          <div className="rpt-meta">
            {has(profile.registeredBy) && <span><PersonAvatar name={profile.registeredBy.trim()} url={registrarUrl} size={20} /> Registered by <b>{profile.registeredBy.trim()}</b></span>}
            {updatedLabel && <span>Updated {updatedLabel}</span>}
          </div>
        </div>
        <div className="rpt-head-ring">
          <CompletenessRing pct={completeness.pct} size={68} />
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)' }}>{completeness.filled} / {completeness.total} fields</div>
        </div>
      </div>

      {snapshot.length >= 2 && (
        <div className="rpt-snap">
          {snapshot.map(([label, value]) => (
            <div key={label} className="rpt-snap-tile">
              <div className="rpt-label">{label}</div>
              <div className="rpt-snap-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rpt-empty">No further details have been recorded for this business yet. Use Edit to add them.</div>
      ) : (
        sections.map((sc, i) => (
          <section key={sc.meta.label} className="rpt-section">
            <div className="rpt-section-head">
              <span className="rpt-section-icon"><sc.meta.icon size={17} /></span>
              <h3 className="rpt-section-title">{sc.meta.label}</h3>
              <span className="rpt-num mono">{String(i + 1).padStart(2, '0')}</span>
            </div>
            {sc.body}
          </section>
        ))
      )}

      {sections.length > 0 && (
        <div className="rpt-foot">
          <Info size={11} /> Values are owner-reported unless marked:
          {VERIFICATION.slice(1).map((v) => (
            <span key={v.key} className="rpt-key" style={{ color: v.varColor, background: `color-mix(in srgb, ${v.varColor} 14%, transparent)` }}>{v.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── "Registered by" page ─────────────────────────────────────────────────────
// A ranked list of everyone in the agency plus anyone whose name was typed into
// "Registered by": the person with the most registered businesses is #1 (ties share
// a rank), and people who haven't registered any stay in the list with a 0.
const ROLE_LABEL = { superadmin: 'Admin', manager: 'Manager' }; // plain members carry no tag

function RegistrantBoard({ index, total, activeId, onBack, onFilter, onOpen }) {
  const { list, none } = index;
  const registered = list.filter((p) => p.businesses.length > 0).length;
  // The person whose businesses are shown in the prompt (null = closed).
  const [listFor, setListFor] = useState(null);
  const listPerson = listFor === null ? null : (listFor === NO_REGISTRAR ? none : list.find((p) => p.id === listFor) || null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!listPerson) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setListFor(null); };
    document.addEventListener('keydown', onKey);
    if (closeRef.current) closeRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [listPerson]);

  const renderRow = (p, unranked) => {
    const n = p.businesses.length;
    const cls = ['biz-rank-row', p.rank === 1 ? 'first' : '', n === 0 ? 'zero' : '', activeId === p.id ? 'active' : ''].filter(Boolean).join(' ');
    return (
      <div key={p.id} className={cls}>
        <div className={`biz-rank-num${p.rank && p.rank <= 3 ? ` r${p.rank}` : ''}`} title={p.rank ? `Rank ${p.rank}` : 'Not ranked'}>{unranked || !p.rank ? '—' : p.rank}</div>
        <PersonAvatar name={p.id === NO_REGISTRAR ? '?' : p.name} url={p.avatarUrl} size={46} />
        <div className="biz-rank-main">
          <div className="biz-rank-name">
            <span>{p.name}</span>
            {p.onTeam && ROLE_LABEL[p.role] && <span className="biz-rank-tag">{ROLE_LABEL[p.role]}</span>}
          </div>
          <div className="biz-rank-chips">
            {n === 0
              ? <span className="biz-reg-more">No businesses registered yet</span>
              : p.businesses.map((b) => (
                <button key={b.id} type="button" className="biz-reg-chip" title={`Open ${b.name}`} onClick={() => onOpen(b.id)}>{b.name}</button>
              ))}
          </div>
        </div>
        <div className="biz-rank-total">
          <span className="biz-reg-count">{n}</span>
          <span className="biz-reg-unit">{n === 1 ? 'business' : 'businesses'}</span>
        </div>
        <button type="button" className="biz-btn ghost sm" disabled={n === 0} onClick={() => setListFor(p.id)}>View businesses</button>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button className="biz-back" onClick={onBack}><ChevronLeft size={15} /> Registry</button>
      </div>
      <div className="biz-panel biz-rank">
        <div className="biz-rank-head">
          <div className="biz-eyebrow"><Users size={11} /> Data Registry</div>
          <h2 className="biz-rank-title">Registered by</h2>
          <div className="biz-rank-sub">
            Everyone in ACR, ranked by how many businesses they have registered — the most is #1.
            {' '}{registered} of {list.length} {list.length === 1 ? 'person has' : 'people have'} registered at least one · {total} {total === 1 ? 'business' : 'businesses'} in total.
          </div>
        </div>
        <div className="biz-rank-list">
          {list.map((p) => renderRow(p, false))}
          {none.businesses.length > 0 && renderRow({ ...none, rank: null }, true)}
        </div>
      </div>

      {listPerson && (
        <div className="ig-scrim biz-prompt-scrim" onClick={() => setListFor(null)}>
          <div
            className="ig-dialog biz-prompt" role="dialog" aria-modal="true"
            aria-label={listPerson.id === NO_REGISTRAR ? 'Businesses with no recorded registrant' : `Businesses registered by ${listPerson.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="biz-prompt-head">
              <PersonAvatar name={listPerson.id === NO_REGISTRAR ? '?' : listPerson.name} url={listPerson.avatarUrl} size={44} />
              <div className="biz-prompt-title">
                <div className="biz-prompt-name">{listPerson.id === NO_REGISTRAR ? 'No recorded registrant' : listPerson.name}</div>
                <div className="biz-prompt-sub">
                  {listPerson.businesses.length} {listPerson.businesses.length === 1 ? 'business' : 'businesses'} registered
                </div>
              </div>
              <button ref={closeRef} type="button" className="ig-dialog-close biz-prompt-close" aria-label="Close" onClick={() => setListFor(null)}><X size={16} /></button>
            </div>
            <div className="biz-prompt-list">
              {listPerson.businesses.map((b) => (
                <button key={b.id} type="button" className="biz-prompt-item" onClick={() => onOpen(b.id)}>
                  <Avatar name={b.name} size={38} />
                  <span className="biz-prompt-item-main">
                    <span className="biz-prompt-item-name">{b.name}</span>
                    <span className="biz-prompt-item-meta">{[b.industry || 'No industry set', b.location].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="biz-prompt-item-pct mono">{profileCompleteness(b).pct}%</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            <div className="biz-prompt-foot">
              <button type="button" className="biz-btn ghost sm" onClick={() => onFilter(listPerson.id)}>Filter the registry list</button>
              <button type="button" className="biz-btn sm" onClick={() => setListFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
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
  const [nameError, setNameError] = useState(false);
  const [registeredByError, setRegisteredByError] = useState(false);
  const [activeSection, setActiveSection] = useState('registration');
  const wizardRef = useRef(null);
  // Who created each record, { userId: name } — used to fill "Registered by" on
  // records made before that field existed. Fetched only when some record needs it.
  const [creators, setCreators] = useState({});
  const [creatorFilledFor, setCreatorFilledFor] = useState('');

  // Registry-list filters — country first (just Kenya for now), city narrows
  // within it. Both apply to the list, the insight cards, and the count below.
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterRegistrar, setFilterRegistrar] = useState('');
  // Where the detail page was opened from, so Back returns there (the list or the
  // "Registered by" page).
  const [detailFrom, setDetailFrom] = useState('registry');
  // Agency members: the people the "Registered by" page ranks (including anyone with
  // none registered yet) and their profile pictures.
  const [members, setMembers] = useState([]);

  // Everyone who can appear as a registrant: each agency member, plus anyone whose
  // typed name matches no member. A typed name is matched to a member by name or email
  // (ignoring case / spacing), and records that predate "Registered by" fall back to
  // their creator. Ranked by businesses registered, ties sharing a rank.
  const registrantIndex = useMemo(() => {
    const idByKey = new Map();
    const people = new Map();
    const memberWords = [];
    members.forEach((m) => {
      const name = normName(m.full_name) || normName(m.email);
      if (!name) return;
      const id = `member:${m.id}`;
      people.set(id, { id, name, role: m.role || '', avatarUrl: m.avatar_url || '', onTeam: true, spellings: null, businesses: [] });
      [m.full_name, m.email].forEach((n) => { const k = nameKey(n); if (k && !idByKey.has(k)) idByKey.set(k, id); });
      memberWords.push({ id, words: nameTokens(m.full_name) });
    });
    // A typed name that isn't spelled exactly like a profile still belongs to a member when it
    // points at exactly one of them: every word typed starts a word of that member's name
    // ("Grace", "grace w.", "Wanjiru Grace"). Two people who both fit stay unmatched.
    const resolve = (name) => {
      const key = nameKey(name);
      let id = idByKey.get(key);
      if (id) return id;
      const typed = nameTokens(name);
      if (typed.length === 0 || !typed.some((t) => t.length >= 3)) return null;
      const hits = memberWords.filter(({ words }) => typed.every((t) => words.some((w) => w.startsWith(t))));
      if (hits.length !== 1) return null;
      id = hits[0].id;
      idByKey.set(key, id);
      return id;
    };
    const none = { id: NO_REGISTRAR, name: 'Not recorded', role: '', avatarUrl: '', onTeam: false, spellings: null, businesses: [] };
    const personOfEntry = new Map();
    entries.forEach((e) => {
      const typed = normName(e.data?.registeredBy);
      // A record that predates "Registered by" belongs to whoever created it — linked
      // straight to that member by user id, so it doesn't depend on how names are spelled.
      const creatorId = `member:${e.created_by}`;
      if (!typed && e.created_by && people.has(creatorId)) {
        people.get(creatorId).businesses.push(e);
        personOfEntry.set(e.id, creatorId);
        return;
      }
      const name = typed || normName(creators[e.created_by]);
      if (!name) { none.businesses.push(e); personOfEntry.set(e.id, NO_REGISTRAR); return; }
      let id = resolve(name);
      if (!id) {
        const key = nameKey(name);
        id = `name:${key}`;
        idByKey.set(key, id);
        people.set(id, { id, name, role: '', avatarUrl: '', onTeam: false, spellings: new Map(), businesses: [] });
      }
      const person = people.get(id);
      if (person.spellings) person.spellings.set(name, (person.spellings.get(name) || 0) + 1);
      person.businesses.push(e);
      personOfEntry.set(e.id, id);
    });
    const list = [...people.values()]
      .map((p) => ({ ...p, name: p.spellings ? [...p.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] : p.name }))
      .sort((a, b) => b.businesses.length - a.businesses.length || a.name.localeCompare(b.name));
    list.forEach((p) => { p.rank = p.businesses.length === 0 ? null : list.findIndex((q) => q.businesses.length === p.businesses.length) + 1; });
    const byId = new Map(list.map((p) => [p.id, p]));
    byId.set(NO_REGISTRAR, { ...none, rank: null });
    return {
      list, none, byId,
      personIdOf: (e) => personOfEntry.get(e.id) || NO_REGISTRAR,
      // The person a record belongs to, for its name / picture wherever it's shown.
      nameOfEntry: (e) => (byId.get(personOfEntry.get(e.id))?.name && personOfEntry.get(e.id) !== NO_REGISTRAR ? byId.get(personOfEntry.get(e.id)).name : ''),
      avatarOfEntry: (e) => byId.get(personOfEntry.get(e.id))?.avatarUrl || '',
      avatarOfName: (name) => { const id = resolve(name); return (id && byId.get(id)?.avatarUrl) || ''; },
    };
  }, [entries, creators, members]);

  const filteredEntries = useMemo(() => entries.filter((e) =>
    (!filterCountry || effectiveCountry(e) === filterCountry) &&
    (!filterCity || effectiveCity(e) === filterCity) &&
    (!filterRegistrar || registrantIndex.personIdOf(e) === filterRegistrar)
  ), [entries, filterCountry, filterCity, filterRegistrar, registrantIndex]);
  const selectedRegistrar = filterRegistrar ? registrantIndex.byId.get(filterRegistrar) || null : null;
  const topRegistrants = registrantIndex.list.filter((p) => p.businesses.length > 0).slice(0, 3);

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
    setActiveSection('registration');
    setNameError(false);
    setRegisteredByError(false);
  }

  // Records made before "Registered by" existed have no name of their own — fill it
  // in from whoever created the record, once per opened record (so clearing the field
  // afterwards sticks). Adjusted during render, like the buffer reset above. It only
  // touches the edit buffer; nothing is written until the record is saved.
  const creatorName = activeEntry?.created_by ? (creators[activeEntry.created_by] || '') : '';
  if (activeEntry && loadedForId === selectedId && creatorName && creatorFilledFor !== selectedId) {
    setCreatorFilledFor(selectedId);
    if (!profile.registeredBy.trim()) setProfile((p) => (p.registeredBy.trim() ? p : { ...p, registeredBy: creatorName }));
  }

  const needsCreators = useMemo(() => entries.some((e) => e.created_by && !(e.data?.registeredBy || '').trim()), [entries]);
  useEffect(() => {
    if (isDemo || !agencyId || !needsCreators) return;
    let cancelled = false;
    fetch(`/os/api/agencies/${agencyId}/registry-creators`).then((r) => r.json())
      .then((j) => { if (!cancelled && j && j.data) setCreators(j.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [agencyId, isDemo, needsCreators]);

  const hasEntries = entries.length > 0;
  useEffect(() => {
    if (isDemo || !agencyId || !hasEntries) return;
    let cancelled = false;
    // Same source as the Focus Board: includes people whose profile is linked to the agency
    // (not just agency_members rows) and never 403s an admin who isn't listed themselves.
    fetch(workspace?.id ? `/os/api/workspaces/${workspace.id}/chat-members` : `/os/api/agencies/${agencyId}/chat-members`).then((r) => r.json())
      .then((j) => { if (!cancelled && Array.isArray(j.data)) setMembers(j.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [agencyId, workspace?.id, isDemo, hasEntries]);
  const avatarFor = (name) => registrantIndex.avatarOfName(name);

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

  const openEntry = (id, mode = 'view', from = 'registry') => { setSelectedId(id); setDetailMode(mode); setDetailFrom(from); setView('detail'); };
  const backToRegistry = () => { setView(detailFrom); setDetailFrom('registry'); setSelectedId(''); setLoadedForId(''); setCreatorFilledFor(''); };

  // Opens straight into a blank profile page — nothing is created in the
  // registry until Save is pressed, so there's just one form, not a quick-add
  // step followed by a separate detail page.
  const startNewBusiness = () => {
    setProfile(blankDraft());
    setSelectedId('__new__');
    setLoadedForId('__new__');
    setActiveSection('registration');
    setDetailMode('edit');
    setView('detail');
    setNameError(false);
    setRegisteredByError(false);
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

  const stepIndex = Math.max(0, STEPS.findIndex((st) => st.key === activeSection));
  const stepKey = STEPS[stepIndex].key;
  const isLastStep = stepIndex === STEPS.length - 1;
  const StepIcon = STEPS[stepIndex].icon;

  // Each required field gates moving past its own step: "Registered by" leaves
  // Registration, the business name leaves Identity. Going back is never blocked
  // by a later step, and a jump ahead stops at the first step still incomplete.
  const goToStep = (i) => {
    const target = Math.max(0, Math.min(STEPS.length - 1, i));
    if (target > STEP_INDEX.registration && !profile.registeredBy.trim()) { setRegisteredByError(true); setActiveSection('registration'); return; }
    if (target > STEP_INDEX.identity && !profile.name.trim()) { setNameError(true); setActiveSection('identity'); return; }
    setActiveSection(STEPS[target].key);
    requestAnimationFrame(() => {
      const el = wizardRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
    });
  };

  const handleSaveProfile = async () => {
    const name = profile.name.trim();
    const registeredBy = profile.registeredBy.trim();
    if (!name || !registeredBy) {
      setNameError(!name);
      setRegisteredByError(!registeredBy);
      setActiveSection(registeredBy ? 'identity' : 'registration');
      return;
    }
    setNameError(false);
    setRegisteredByError(false);
    if (!isDemo && !agencyId) return;
    setSaving(true);
    // location keeps its old "Area, City" display shape (used in the record list
    // and rail) even though City is now its own structured, filterable field.
    const displayLocation = [profile.location.trim(), profile.identity.city].filter(Boolean).join(', ');
    const base = { agency_id: agencyId, name, industry: profile.industry.trim() || null, location: displayLocation || null };
    const dataPayload = {
      identity: profile.identity, operations: profile.operations, performance: profile.performance,
      infrastructure: profile.infrastructure, challenges: profile.challenges, growthNeeds: profile.growthNeeds,
      verification: profile.verification, registeredBy, internalNotes: profile.internalNotes,
    };
    try {
      if (isDemo) {
        if (isNewDraft) {
          const created = { ...base, id: crypto.randomUUID(), data: dataPayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          const next = [...entries, created];
          setEntries(next); persistDemoEntries(next);
          toast.success('Business registered', `"${name}" added to the registry.`);
          backToRegistry();
        } else {
          const next = entries.map((e) => (e.id === selectedId ? { ...e, ...base, data: dataPayload, updated_at: new Date().toISOString() } : e));
          setEntries(next); persistDemoEntries(next);
          toast.success('Profile saved', `Growth profile for "${name}" saved locally.`);
          backToRegistry();
        }
      } else {
        const sb = createClient();
        if (isNewDraft) {
          const { data, error } = await sb.from('toig_business_registry')
            .insert({ ...base, data: dataPayload, created_by: isUuid(userProfile?.id) ? userProfile.id : null })
            .select('*').maybeSingle();
          if (error) throw error;
          if (data) setEntries((prev) => [...prev, data]);
          toast.success('Business registered', `"${name}" added to the registry.`);
          backToRegistry();
        } else {
          const { data, error } = await sb.from('toig_business_registry')
            .update({ ...base, data: dataPayload, updated_by: isUuid(userProfile?.id) ? userProfile.id : null })
            .eq('id', selectedId).select('*').maybeSingle();
          if (error) throw error;
          if (data) setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
          toast.success('Profile saved', `Growth profile for "${name}" synced with the team.`);
          backToRegistry();
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

  const completeness = useMemo(() => {
    const filled = identityFilled + opsFilled + perfFilled + infraFilled + challengesFilled + growthFilled;
    return { filled, total: PROFILE_TOTAL_FIELDS, pct: PROFILE_TOTAL_FIELDS ? Math.round((filled / PROFILE_TOTAL_FIELDS) * 100) : 0 };
  }, [identityFilled, opsFilled, perfFilled, infraFilled, challengesFilled, growthFilled]);

  const lastUpdatedLabel = useMemo(() => {
    const ts = activeEntry?.updated_at;
    if (!ts) return null;
    try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return null; }
  }, [activeEntry?.updated_at]);

  // Building blocks for the stepped form.
  const verificationLegend = (
    <div className="biz-legend">
      <Info size={11} /> Verification:
      {VERIFICATION.map((v) => (
        <span key={v.key} className="biz-legend-tag" style={{ color: v.varColor, background: `color-mix(in srgb, ${v.varColor} 14%, transparent)` }}>{v.label}</span>
      ))}
    </div>
  );

  const registrationFields = (
    <div className="biz-proplist">
      <Field label="Registered by" required value={profile.registeredBy} onChange={(v) => { setProfile((p) => ({ ...p, registeredBy: v })); if (registeredByError) setRegisteredByError(false); }} placeholder="Name of the person who registered this business" error={registeredByError ? 'Registered by is required.' : undefined} />
      <Field label="Internal notes" type="textarea" rows={3} value={profile.internalNotes} onChange={(v) => setProfile((p) => ({ ...p, internalNotes: v }))} placeholder="Anything else worth recording — not shared with the business (TOIG team only)" />
    </div>
  );

  const renderSection = (sectionKey) => (
    <>
      {sectionKey === 'identity' && (
        <div className="biz-proplist">
          <Field label="Business name" value={profile.name} onChange={(v) => { setProfile((p) => ({ ...p, name: v })); if (nameError) setNameError(false); }} verification={profile.verification['identity.businessName']} onVerify={(v) => setVerify('identity.businessName', v)} placeholder="e.g. Sunshine Laundromat" required error={nameError ? 'Business name is required.' : undefined} />
          <Field label="Owner / founder" value={profile.identity.ownerName} onChange={(v) => setField('identity', 'ownerName', v)} verification={profile.verification['identity.ownerName']} onVerify={(v) => setVerify('identity.ownerName', v)} placeholder="Full name" />
          <Field half label="Owner phone" value={profile.identity.ownerPhone} onChange={(v) => setField('identity', 'ownerPhone', v)} verification={profile.verification['identity.ownerPhone']} onVerify={(v) => setVerify('identity.ownerPhone', v)} placeholder="e.g. 07xx xxx xxx" />
          <Field half label="Owner email" value={profile.identity.ownerEmail} onChange={(v) => setField('identity', 'ownerEmail', v)} verification={profile.verification['identity.ownerEmail']} onVerify={(v) => setVerify('identity.ownerEmail', v)} placeholder="owner@example.com" />
          <Field
            half label="Country" type="select" options={COUNTRIES} value={profile.identity.country}
            onChange={(v) => setProfile((p) => ({ ...p, identity: { ...p.identity, country: v, city: citiesFor(v).includes(p.identity.city) ? p.identity.city : '' } }))}
            verification={profile.verification['identity.country']} onVerify={(v) => setVerify('identity.country', v)}
          />
          <Field
            half label="City" type="select" options={citiesFor(profile.identity.country || 'Kenya')} value={profile.identity.city}
            onChange={(v) => setField('identity', 'city', v)}
            verification={profile.verification['identity.city']} onVerify={(v) => setVerify('identity.city', v)}
          />
          <Field half label="Area / Neighbourhood" value={profile.location} onChange={(v) => setProfile((p) => ({ ...p, location: v }))} verification={profile.verification['identity.location']} onVerify={(v) => setVerify('identity.location', v)} placeholder="e.g. Westlands" />
          <Field half label="Industry" value={profile.industry} onChange={(v) => setProfile((p) => ({ ...p, industry: v }))} verification={profile.verification['identity.industry']} onVerify={(v) => setVerify('identity.industry', v)} placeholder="e.g. Laundry & garment care" />
          <Field half label="Year established" value={profile.identity.yearEstablished} onChange={(v) => setField('identity', 'yearEstablished', v)} verification={profile.verification['identity.yearEstablished']} onVerify={(v) => setVerify('identity.yearEstablished', v)} placeholder="e.g. 2021" />
          <Field half label="Registration status" type="select" options={REG_STATUS} value={profile.identity.registrationStatus} onChange={(v) => setField('identity', 'registrationStatus', v)} verification={profile.verification['identity.registrationStatus']} onVerify={(v) => setVerify('identity.registrationStatus', v)} />
          <Field half label="Business phone" value={profile.identity.businessPhone} onChange={(v) => setField('identity', 'businessPhone', v)} verification={profile.verification['identity.businessPhone']} onVerify={(v) => setVerify('identity.businessPhone', v)} placeholder="General business line" />
          <Field half label="Business email" value={profile.identity.businessEmail} onChange={(v) => setField('identity', 'businessEmail', v)} verification={profile.verification['identity.businessEmail']} onVerify={(v) => setVerify('identity.businessEmail', v)} placeholder="General business email" />
          <Field
            half label="Has a website?" type="select" options={['Yes', 'No']} value={profile.identity.hasWebsite}
            onChange={(v) => setProfile((p) => ({ ...p, identity: { ...p.identity, hasWebsite: v, website: v === 'Yes' ? p.identity.website : '' } }))}
            verification={profile.verification['identity.hasWebsite']} onVerify={(v) => setVerify('identity.hasWebsite', v)}
          />
          {profile.identity.hasWebsite === 'Yes' && (
            <Field half label="Website" value={profile.identity.website} onChange={(v) => setField('identity', 'website', v)} verification={profile.verification['identity.website']} onVerify={(v) => setVerify('identity.website', v)} placeholder="e.g. www.sunshinelaundry.co.ke" />
          )}
        </div>
      )}

      {sectionKey === 'operations' && (
        <div className="biz-proplist">
          <Field label="Products & services" type="textarea" value={profile.operations.productsServices} onChange={(v) => setField('operations', 'productsServices', v)} verification={profile.verification['operations.productsServices']} onVerify={(v) => setVerify('operations.productsServices', v)} placeholder="What does the business sell or offer?" />
          <Field half label="Employees" value={profile.operations.employeeCount} onChange={(v) => setField('operations', 'employeeCount', v)} verification={profile.verification['operations.employeeCount']} onVerify={(v) => setVerify('operations.employeeCount', v)} placeholder="e.g. 5 full-time, 2 part-time" />
          <Field half label="Locations" value={profile.operations.locationCount} onChange={(v) => setField('operations', 'locationCount', v)} verification={profile.verification['operations.locationCount']} onVerify={(v) => setVerify('operations.locationCount', v)} placeholder="e.g. 1" />
          <Field label="Operating model" type="select" options={OPERATING_MODELS} value={profile.operations.operatingModel} onChange={(v) => setField('operations', 'operatingModel', v)} verification={profile.verification['operations.operatingModel']} onVerify={(v) => setVerify('operations.operatingModel', v)} />
          <Field half label="Suppliers" type="textarea" value={profile.operations.suppliers} onChange={(v) => setField('operations', 'suppliers', v)} verification={profile.verification['operations.suppliers']} onVerify={(v) => setVerify('operations.suppliers', v)} placeholder="Key suppliers or vendors relied on" />
          <Field half label="Customer segments" type="textarea" value={profile.operations.customerSegments} onChange={(v) => setField('operations', 'customerSegments', v)} verification={profile.verification['operations.customerSegments']} onVerify={(v) => setVerify('operations.customerSegments', v)} placeholder="Who buys from this business?" />
          <Field label="Current tech & systems" type="textarea" value={profile.operations.currentSystems} onChange={(v) => setField('operations', 'currentSystems', v)} verification={profile.verification['operations.currentSystems']} onVerify={(v) => setVerify('operations.currentSystems', v)} placeholder="Any tools/software used day to day (POS, bookkeeping app, etc.)" />
        </div>
      )}

      {sectionKey === 'performance' && (
        <div className="biz-proplist">
          <Field half label="Revenue range" type="select" options={REVENUE_RANGES} value={profile.performance.revenueRange} onChange={(v) => setField('performance', 'revenueRange', v)} verification={profile.verification['performance.revenueRange']} onVerify={(v) => setVerify('performance.revenueRange', v)} />
          <Field half label="Customer volume" value={profile.performance.customerVolume} onChange={(v) => setField('performance', 'customerVolume', v)} verification={profile.verification['performance.customerVolume']} onVerify={(v) => setVerify('performance.customerVolume', v)} placeholder="e.g. ~200 customers/month" />
          <Field half label="Major revenue streams" type="textarea" value={profile.performance.revenueStreams} onChange={(v) => setField('performance', 'revenueStreams', v)} verification={profile.verification['performance.revenueStreams']} onVerify={(v) => setVerify('performance.revenueStreams', v)} />
          <Field half label="Major operating expenses" type="textarea" value={profile.performance.operatingExpenses} onChange={(v) => setField('performance', 'operatingExpenses', v)} verification={profile.verification['performance.operatingExpenses']} onVerify={(v) => setVerify('performance.operatingExpenses', v)} />
          <Field label="Growth trend" type="select" options={GROWTH_TRENDS} value={profile.performance.growthTrend} onChange={(v) => setField('performance', 'growthTrend', v)} verification={profile.verification['performance.growthTrend']} onVerify={(v) => setVerify('performance.growthTrend', v)} />
          <Field label="Financial challenges" type="textarea" value={profile.performance.financialChallenges} onChange={(v) => setField('performance', 'financialChallenges', v)} verification={profile.verification['performance.financialChallenges']} onVerify={(v) => setVerify('performance.financialChallenges', v)} />
        </div>
      )}

      {sectionKey === 'infrastructure' && (
        <div className="biz-proplist">
          {INFRA_AREAS.map((area, i) => (
            <InfraRow
              key={area.key} area={area} half={i < INFRA_AREAS.length - (INFRA_AREAS.length % 2)} value={profile.infrastructure[area.key]}
              onChange={(v) => setInfra(area.key, v)}
              verification={profile.verification[`infrastructure.${area.key}`]}
              onVerify={(v) => setVerify(`infrastructure.${area.key}`, v)}
            />
          ))}
        </div>
      )}

      {sectionKey === 'challenges' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHALLENGES.map((c) => {
              const active = profile.challenges.selected.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleChallenge(c)} className={`biz-chip ${active ? 'active' : ''}`}>
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

      {sectionKey === 'growth' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            {GROWTH_NEEDS.map((need) => {
              const active = profile.growthNeeds.selected.includes(need.key);
              return (
                <button key={need.key} type="button" onClick={() => toggleGrowthNeed(need.key)} className={`biz-need-card ${active ? 'active' : ''}`}>
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
    </>
  );

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
              {registrantIndex.list.length > 0 && (
                <button
                  type="button"
                  className={`biz-btn biz-filter-btn${filterRegistrar ? ' active' : ''}`}
                  title="See who registered what"
                  onClick={() => setView('registrants')}
                >
                  <Users size={14} /> Registered by
                  {!selectedRegistrar && topRegistrants.length > 0 && (
                    <span className="biz-filter-stack" aria-hidden="true">
                      {topRegistrants.map((p) => <PersonAvatar key={p.id} name={p.name} url={p.avatarUrl} size={20} />)}
                    </span>
                  )}
                  {selectedRegistrar && (
                    <span className="biz-filter-chip">
                      <PersonAvatar name={selectedRegistrar.id === NO_REGISTRAR ? '?' : selectedRegistrar.name} url={selectedRegistrar.avatarUrl} size={20} />
                      <span className="biz-filter-chip-name">{selectedRegistrar.name}</span>
                    </span>
                  )}
                  <ChevronRight size={14} />
                </button>
              )}
              {(filterCountry || filterCity || filterRegistrar) && (
                <button className="biz-btn ghost sm" onClick={() => { setFilterCountry(''); setFilterCity(''); setFilterRegistrar(''); }}>Clear filters</button>
              )}
              <span className="biz-filter-count mono">{filteredEntries.length} / {entries.length} businesses</span>
            </div>
          )}

          {!loadingEntries && entries.length > 0 && (
            <div className="biz-insight-row">
              <div className="biz-insight-card">
                <DollarSign size={22} style={{ color: 'var(--color-accent-text, #5B9BFF)' }} />
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
              <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>Try different filters, or clear them.</div>
              <button className="biz-btn ghost" onClick={() => { setFilterCountry(''); setFilterCity(''); setFilterRegistrar(''); }}>Clear filters</button>
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
                          {(registrantIndex.nameOfEntry(entry) || registrarNameOf(entry, creators)) && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><PersonAvatar name={registrantIndex.nameOfEntry(entry) || registrarNameOf(entry, creators)} url={registrantIndex.avatarOfEntry(entry) || avatarFor(registrarNameOf(entry, creators))} size={16} />{registrantIndex.nameOfEntry(entry) || registrarNameOf(entry, creators)}</span></>}
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
      ) : view === 'registrants' ? (
        <RegistrantBoard
          index={registrantIndex} total={entries.length} activeId={filterRegistrar}
          onBack={() => setView('registry')}
          onFilter={(id) => { setFilterRegistrar(id); setView('registry'); }}
          onOpen={(id) => openEntry(id, 'view', 'registrants')}
        />
      ) : (
        <>
          {/* Detail top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="biz-back" onClick={backToRegistry}><ChevronLeft size={15} /> {detailFrom === 'registrants' ? 'Registered by' : 'Registry'}</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isNewDraft && <button className="biz-icon" title="Delete business" onClick={() => setConfirmDeleteId(selectedId)}><Trash2 size={15} /></button>}
              {isViewOnly ? (
                <button className="biz-btn primary" onClick={() => setDetailMode('edit')}><Pencil size={14} /> Edit</button>
              ) : !isNewDraft && (
                <button className="biz-btn primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save changes
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

          {!isViewOnly && (nameError || registeredByError) && (
            <div className="biz-notice error">
              {nameError && registeredByError
                ? 'Add who registered this business (Registration step) and a business name (Identity step) to continue.'
                : nameError
                  ? 'Give it a business name in the Identity step to continue.'
                  : 'Add who registered this business in the Registration step to continue.'}
            </div>
          )}

          {isViewOnly ? (
          <BusinessReport profile={profile} completeness={completeness} updatedLabel={lastUpdatedLabel} registrarUrl={(activeEntry && registrantIndex.avatarOfEntry(activeEntry)) || avatarFor(profile.registeredBy)} />
          ) : (
          <div ref={wizardRef} className="biz-panel biz-wizard">
            <div className="biz-wizard-head">
              <div className="biz-wizard-title">{isNewDraft ? 'Register a business' : 'Edit business profile'}</div>
            </div>

            <Stepper steps={STEPS} current={stepIndex} onGo={goToStep} />

            <div className="biz-wizard-section-head">
              <span className="biz-wizard-section-icon"><StepIcon size={20} /></span>
              <div className="biz-wizard-section-text">
                <h3 className="biz-wizard-section-title">{STEPS[stepIndex].title}</h3>
                <p className="biz-wizard-section-desc">{STEPS[stepIndex].desc}</p>
              </div>
              <div className="biz-wizard-meta mono">Step {stepIndex + 1} of {STEPS.length} · {completeness.pct}% complete</div>
            </div>

            {stepKey !== 'registration' && verificationLegend}

            <div className="biz-wizard-body">
              {stepKey === 'registration' ? registrationFields : renderSection(stepKey)}
            </div>

            <div className="biz-wizard-foot">
              {stepIndex > 0
                ? <button type="button" className="biz-prev" onClick={() => goToStep(stepIndex - 1)}><ChevronLeft size={15} /> Previous</button>
                : <span />}
              <div className="biz-wizard-foot-actions">
                {/* Editing an existing record: save from any step, without paging to the end.
                    (A new business is only submitted from the last step.) */}
                {!isNewDraft && !isLastStep && (
                  <button type="button" className="biz-btn" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save changes
                  </button>
                )}
                {isLastStep ? (
                  <button type="button" className="biz-btn primary" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : isNewDraft ? <Plus size={14} /> : <Save size={14} />} {isNewDraft ? 'Register Business' : 'Save changes'}
                  </button>
                ) : (
                  <button type="button" className="biz-btn primary" onClick={() => goToStep(stepIndex + 1)}>Next <ChevronRight size={15} /></button>
                )}
              </div>
            </div>
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
          color: var(--color-accent-text, var(--color-accent-secondary));
        }
        :global([data-theme="light"] .biz-person), :global([data-theme="light"] .biz-avatar) { --person-ink: color-mix(in srgb, var(--tint) 45%, #0F1C38); }
        :global(.biz-input) {
          width: 100%; padding: 8px 11px; border-radius: var(--radius-md, 8px); font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: var(--font-sans); outline: none; transition: var(--transition-fast, .12s);
        }
        :global(.biz-input::placeholder) { color: var(--color-text-tertiary); }
        :global(.biz-input:focus) { border-color: var(--color-border-active); box-shadow: 0 0 0 3px var(--color-accent-primary-subtle); }
        :global(.biz-input.error) { border-color: var(--color-error); background: var(--color-error-bg); }
        :global(.biz-input.error:focus) { box-shadow: 0 0 0 3px var(--color-error-bg); }
        :global(.biz-textarea) { resize: vertical; min-height: 40px; line-height: 1.5; }
        :global(.biz-hint) { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
        :global(.biz-req) { color: var(--color-error); font-weight: 700; }
        :global(.biz-field-error) { font-size: 11px; color: var(--color-error); font-weight: 600; margin-top: 4px; }
        :global(.biz-notice.error) { color: var(--color-error); background: var(--color-error-bg); border-color: var(--color-error); }
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

        /* Registered-by filter button + pictures */
        :global(.biz-person) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 50%; font-family: var(--font-display); font-weight: 700; line-height: 1; }
        :global(.biz-filter-btn) { gap: 7px; }
        :global(.biz-filter-btn.active) { border-color: var(--color-accent-primary); color: var(--color-accent-text, var(--color-accent-secondary)); background: var(--color-accent-primary-subtle); }
        :global(.biz-filter-chip) { display: inline-flex; align-items: center; gap: 6px; max-width: 190px; padding: 2px 9px 2px 3px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--color-text-primary); background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        :global(.biz-filter-chip-name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        :global(.biz-filter-stack) { display: inline-flex; align-items: center; }
        :global(.biz-filter-stack .biz-person) { box-shadow: 0 0 0 2px var(--color-bg-tertiary); }
        :global(.biz-filter-stack .biz-person + .biz-person) { margin-left: -7px; }

        /* "Registered by" page: ranked people */
        :global(.biz-rank) { padding: 28px 30px 10px; }
        :global(.biz-rank-head) { padding-bottom: 20px; border-bottom: 1px solid var(--color-border); }
        :global(.biz-rank-title) { margin: 4px 0 0; font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: var(--color-text-primary); }
        :global(.biz-rank-sub) { margin-top: 6px; font-size: 13.5px; line-height: 1.55; color: var(--color-text-secondary); }
        :global(.biz-rank-row) { display: flex; align-items: center; gap: 14px; padding: 16px 6px; border-top: 1px solid var(--color-border); }
        :global(.biz-rank-row:first-child) { border-top: none; }
        :global(.biz-rank-row.first) { margin: 8px 0; padding: 16px 14px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--color-accent-primary) 40%, transparent); background: var(--color-accent-primary-subtle); }
        :global(.biz-rank-row.first + .biz-rank-row) { border-top: none; }
        :global(.biz-rank-row.zero) { opacity: .8; }
        :global(.biz-rank-row .biz-btn:disabled) { opacity: .4; cursor: not-allowed; }
        :global(.biz-rank-row.active:not(.first)) { border-radius: 12px; outline: 1px solid var(--color-accent-primary); border-top-color: transparent; }
        :global(.biz-rank-num) {
          flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;
          font-family: var(--font-display); font-size: 15px; font-weight: 800; color: var(--color-text-tertiary);
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
        }
        :global(.biz-rank-num.r1) { color: #3B2600; border: none; background: linear-gradient(135deg, #F5A623, #F0B429); box-shadow: 0 2px 10px rgba(245, 166, 35, .4); }
        :global(.biz-rank-num.r2) { color: var(--color-text-primary); background: color-mix(in srgb, #9AA7BD 28%, transparent); border-color: color-mix(in srgb, #9AA7BD 55%, transparent); }
        :global(.biz-rank-num.r3) { color: var(--color-text-primary); background: color-mix(in srgb, #C8814B 26%, transparent); border-color: color-mix(in srgb, #C8814B 55%, transparent); }
        :global(.biz-rank-main) { flex: 1; min-width: 0; }
        :global(.biz-rank-name) { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
        :global(.biz-rank-tag) { padding: 1px 8px; border-radius: 999px; font-family: var(--font-sans); font-size: 10.5px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--color-text-secondary); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); }
        :global(.biz-rank-chips) { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
        :global(.biz-rank-total) { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; min-width: 76px; line-height: 1.1; }
        :global(.biz-reg-count) { font-family: var(--font-display); font-size: 24px; font-weight: 800; color: var(--color-accent-text, var(--color-accent-secondary)); }
        :global(.biz-reg-unit) { font-size: 10px; color: var(--color-text-tertiary); }
        :global(.biz-reg-chip) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 10px; border-radius: 999px; font-family: var(--font-sans); font-size: 11.5px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); cursor: pointer; transition: var(--transition-fast, .12s); }
        :global(.biz-reg-chip:hover) { color: var(--color-text-primary); border-color: var(--color-border-active); }
        :global(.biz-reg-more) { font-size: 12px; color: var(--color-text-tertiary); }
        @media (max-width: 640px) {
          :global(.biz-rank) { padding: 18px 14px 6px; }
          :global(.biz-rank-title) { font-size: 22px; }
          :global(.biz-rank-row) { flex-wrap: wrap; gap: 10px 12px; }
          :global(.biz-rank-main) { flex: 1 1 130px; }
          :global(.biz-rank-row.first) { padding: 14px 10px; }
          :global(.biz-rank-total) { align-items: flex-start; flex-direction: row; gap: 6px; min-width: 0; margin-left: 48px; }
          :global(.biz-rank-total .biz-reg-unit) { align-self: flex-end; }
        }

        /* "Registered by" page: the businesses prompt */
        :global(.biz-prompt-scrim) { position: fixed; inset: 0; z-index: 10050; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(3px); }
        :global(.biz-prompt) { display: flex; flex-direction: column; width: min(480px, 100%); max-height: min(640px, 86vh); overflow: hidden; border: 1px solid rgba(48,108,236,0.3); border-radius: 16px; }
        :global(.biz-prompt-head) { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid rgba(48,108,236,0.18); }
        :global(.biz-prompt-title) { flex: 1; min-width: 0; }
        :global(.biz-prompt-name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--color-text-primary); }
        :global(.biz-prompt-sub) { margin-top: 2px; font-size: 12.5px; color: var(--color-text-secondary); }
        :global(.biz-prompt-close) { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; cursor: pointer; }
        :global(.biz-prompt-list) { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
        :global(.biz-prompt-item) { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; border: none; border-radius: 12px; background: none; cursor: pointer; text-align: left; font-family: var(--font-sans); color: var(--color-text-tertiary); transition: background var(--transition-fast, .12s); }
        :global(.biz-prompt-item:hover), :global(.biz-prompt-item:focus-visible) { background: var(--color-bg-hover); outline: none; }
        :global(.biz-prompt-item-main) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        :global(.biz-prompt-item-name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
        :global(.biz-prompt-item-meta) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--color-text-tertiary); }
        :global(.biz-prompt-item-pct) { flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); }
        :global(.biz-prompt-foot) { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-top: 1px solid rgba(48,108,236,0.18); }

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

        :global(.biz-legend) {
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 16px; font-size: 10.5px;
          color: var(--color-text-tertiary); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono);
        }
        :global(.biz-legend-tag) { padding: 2px 8px; border-radius: 999px; font-weight: 700; }

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
        :global(.biz-need-card) {
          display: flex; gap: 10px; align-items: flex-start; text-align: left; cursor: pointer; font-family: var(--font-sans);
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); border-radius: var(--radius-lg, 12px); padding: 13px; transition: var(--transition-fast, .12s);
        }
        :global(.biz-need-card.active) { border-color: var(--color-accent-primary); background: var(--color-accent-primary-subtle); }

        /* Stepped edit / new-business form — deliberately roomy: one column, generous
           row and section spacing, taller controls, so a long step doesn't read as a
           wall of fields. Scoped to .biz-wizard so the read-only view is unaffected. */
        :global(.biz-wizard) { max-width: 900px; margin: 0 auto; padding: 40px 56px 32px; }
        :global(.biz-wizard-head) { text-align: center; margin-bottom: 30px; }
        :global(.biz-wizard-title) { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--color-text-primary); }

        :global(.biz-stepper) { list-style: none; display: flex; margin: 0 0 44px; padding: 0; }
        :global(.biz-step) { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        :global(.biz-step::before) { content: ''; position: absolute; top: 15px; right: 50%; width: 100%; height: 2px; background: var(--color-border-hover); }
        :global(.biz-step:first-child::before) { display: none; }
        :global(.biz-step.done::before), :global(.biz-step.current::before) { background: var(--color-accent-primary); }
        :global(.biz-step-dot) {
          position: relative; z-index: 1; width: 32px; height: 32px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; font-family: var(--font-sans); cursor: pointer; transition: var(--transition-fast, .12s);
          border: 2px solid var(--color-border-hover); background: var(--color-bg-secondary); color: var(--color-text-tertiary);
        }
        :global(.biz-step-dot:hover) { border-color: var(--color-accent-primary); }
        :global(.biz-step.done .biz-step-dot) { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: #fff; }
        :global(.biz-step.current .biz-step-dot) { border-color: var(--color-accent-primary); color: var(--color-accent-primary); box-shadow: 0 0 0 4px var(--color-accent-primary-subtle); }
        :global(.biz-step-label) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 11.5px; font-weight: 600; color: var(--color-text-tertiary); }
        :global(.biz-step.done .biz-step-label), :global(.biz-step.current .biz-step-label) { color: var(--color-accent-text, var(--color-accent-secondary)); }

        /* Step heading: the same tinted band + solid icon tile as the report's section
           headings, with a large title and a description in a readable (secondary)
           colour rather than the faint tertiary grey. */
        :global(.biz-wizard-section-head) {
          display: flex; align-items: center; gap: 14px; padding: 14px 18px 14px 14px; border-radius: 12px;
          background: var(--color-accent-primary-subtle); border: 1px solid color-mix(in srgb, var(--color-accent-primary) 24%, transparent);
        }
        :global(.biz-wizard-section-icon) { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 42px; height: 42px; border-radius: 11px; background: var(--color-accent-primary); color: #fff; }
        :global(.biz-wizard-section-text) { min-width: 0; flex: 1; }
        :global(.biz-wizard-section-title) { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: var(--color-text-primary); }
        :global(.biz-wizard-section-desc) { margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); }
        :global(.biz-wizard-meta) { flex-shrink: 0; align-self: flex-start; font-size: 11.5px; font-weight: 700; color: var(--color-accent-text, var(--color-accent-secondary)); white-space: nowrap; }
        :global(.biz-wizard .biz-legend) { padding: 14px 2px 0; border-bottom: none; font-size: 11px; color: var(--color-text-secondary); }
        :global(.biz-wizard-body) { padding: 22px 0 8px; min-height: 320px; }

        /* Two-column field grid: a field is full width unless it's marked as a half, in which
           case consecutive halves sit side by side. Labels sit above their field (there is
           no room for a left-hand label in a half-width cell), with the verification badge
           at the right end of the label line so it never squeezes the input. */
        :global(.biz-wizard .biz-proplist) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 32px; }
        :global(.biz-wizard .biz-proplist > .biz-row:not(.biz-half)) { grid-column: 1 / -1; }
        :global(.biz-wizard .biz-row) {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'label badge' 'control control';
          align-items: center; gap: 8px 12px; padding: 0; border-top: none;
        }
        :global(.biz-wizard .biz-row:hover) { background: none; }
        :global(.biz-wizard .biz-row-label) { grid-area: label; min-height: 24px; padding-top: 0; line-height: 24px; text-align: left; text-transform: none; letter-spacing: 0; font-size: 13px; }
        :global(.biz-wizard .biz-row-control) { grid-area: control; }
        :global(.biz-wizard .biz-input) { padding: 10px 14px; font-size: 14px; border-radius: 10px; }
        :global(.biz-wizard .biz-textarea) { min-height: 88px; }
        :global(.biz-wizard .biz-pill) { padding: 7px 14px; font-size: 12px; }
        :global(.biz-wizard .biz-chip) { padding: 9px 15px; font-size: 12.5px; }
        :global(.biz-wizard .biz-need-card) { padding: 16px; }
        :global(.biz-wizard .biz-verify) { grid-area: badge; margin-top: 0; }

        :global(.biz-wizard-foot) { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 36px; }
        :global(.biz-wizard-foot-actions) { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-left: auto; }
        :global(.biz-wizard-foot .biz-btn) { height: 42px; padding: 0 24px; font-size: 14px; }
        :global(.biz-prev) {
          display: inline-flex; align-items: center; gap: 4px; padding: 10px 6px; background: none; border: none; cursor: pointer;
          color: var(--color-accent-text, var(--color-accent-secondary)); font-size: 14px; font-weight: 600; font-family: var(--font-sans);
        }
        :global(.biz-prev:hover) { text-decoration: underline; }
        @media (max-width: 900px) {
          :global(.biz-wizard) { padding: 32px 28px 26px; }
          :global(.biz-wizard .biz-proplist) { column-gap: 20px; }
        }
        @media (max-width: 640px) {
          :global(.biz-wizard) { padding: 22px 16px 20px; }
          :global(.biz-stepper) { margin-bottom: 30px; }
          :global(.biz-step::before) { top: 13px; }
          :global(.biz-step-dot) { width: 28px; height: 28px; font-size: 12px; }
          :global(.biz-step-label) { display: none; }
          :global(.biz-wizard-section-head) { flex-wrap: wrap; gap: 10px 12px; padding: 12px; }
          :global(.biz-wizard-section-icon) { width: 38px; height: 38px; }
          :global(.biz-wizard-section-title) { font-size: 18px; }
          :global(.biz-wizard-section-desc) { font-size: 13.5px; }
          :global(.biz-wizard-meta) { flex-basis: 100%; align-self: auto; }
          :global(.biz-wizard-body) { min-height: 0; padding-top: 16px; }
          :global(.biz-wizard .biz-proplist) { grid-template-columns: 1fr; gap: 20px; }
          :global(.biz-wizard-foot) { margin-top: 26px; }
          :global(.biz-wizard-foot .biz-btn) { padding: 0 16px; }
        }

        /* Read-only report */
        :global(.rpt) { max-width: 920px; margin: 0 auto; padding: 36px 46px 30px; }
        :global(.rpt-head) { display: flex; align-items: center; gap: 20px; padding-bottom: 26px; border-bottom: 1px solid var(--color-border); }
        :global(.rpt-head-main) { min-width: 0; flex: 1; }
        :global(.rpt-title) { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin: 5px 0 0; font-family: var(--font-display); font-size: 27px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; color: var(--color-text-primary); }
        :global(.rpt-sub) { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 6px; font-size: 14px; color: var(--color-text-secondary); }
        :global(.rpt-loc) { display: inline-flex; align-items: center; gap: 4px; }
        :global(.rpt-meta) { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 12px; font-size: 12px; color: var(--color-text-tertiary); }
        :global(.rpt-meta span) { display: inline-flex; align-items: center; gap: 5px; }
        :global(.rpt-meta b) { font-weight: 600; color: var(--color-text-secondary); }
        :global(.rpt-head-ring) { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }

        :global(.rpt-snap) { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 26px; }
        :global(.rpt-snap-tile) { padding: 14px 16px; border-radius: var(--radius-lg, 10px); background: var(--color-bg-tertiary); border: 1px solid var(--color-border); }
        :global(.rpt-snap-value) { margin-top: 5px; font-family: var(--font-display); font-size: 16px; font-weight: 800; line-height: 1.3; color: var(--color-text-primary); }

        /* Section headings are a tinted band with a solid icon tile and a large title, so
           they clearly outrank the small uppercase field labels and are easy to spot when
           scanning down a long report. */
        :global(.rpt-section) { margin-top: 40px; }
        :global(.rpt-section-head) {
          display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding: 10px 16px 10px 10px; border-radius: 12px;
          background: var(--color-accent-primary-subtle); border: 1px solid color-mix(in srgb, var(--color-accent-primary) 24%, transparent);
        }
        :global(.rpt-section-icon) { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; background: var(--color-accent-primary); color: #fff; }
        :global(.rpt-section-title) { margin: 0; font-family: var(--font-display); font-size: 19px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: var(--color-text-primary); }
        :global(.rpt-num) { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--color-accent-text, var(--color-accent-secondary)); }

        :global(.rpt-grid) { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 22px 32px; }
        :global(.rpt-label) { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-tertiary); }
        :global(.rpt-value) { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: 5px; font-size: 14.5px; font-weight: 600; line-height: 1.45; color: var(--color-text-primary); word-break: break-word; }
        :global(.rpt-value .biz-verify), :global(.rpt-label .biz-verify), :global(.rpt-title .biz-verify), :global(.rpt-infra-note .biz-verify) { margin-top: 0; }
        :global(.rpt-link) { color: var(--color-accent-text, var(--color-accent-secondary)); text-decoration: none; }
        :global(.rpt-link:hover) { text-decoration: underline; }
        :global(.rpt-notes) { display: flex; flex-direction: column; gap: 20px; margin-top: 24px; }
        :global(.rpt-section-head + .rpt-notes) { margin-top: 0; }
        :global(.rpt-text) { margin: 6px 0 0; font-size: 14px; line-height: 1.65; color: var(--color-text-primary); white-space: pre-wrap; }

        :global(.rpt-infra) { display: flex; flex-direction: column; }
        :global(.rpt-infra-row) { display: grid; grid-template-columns: 190px 170px 1fr; align-items: center; gap: 6px 18px; padding: 12px 0; border-top: 1px solid var(--color-border); }
        :global(.rpt-infra-row:first-child) { padding-top: 0; border-top: none; }
        :global(.rpt-infra-name) { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); }
        :global(.rpt-infra-level) { display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); }
        :global(.rpt-meter) { display: inline-flex; gap: 3px; }
        :global(.rpt-meter i) { display: block; width: 18px; height: 6px; border-radius: 3px; background: var(--color-border-hover); }
        :global(.rpt-meter i.on) { background: var(--color-accent-primary); }
        :global(.rpt-infra-note) { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }

        :global(.rpt-tags) { display: flex; flex-wrap: wrap; gap: 8px; }
        :global(.rpt-tag) { padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--color-error-text, var(--color-error)); background: var(--color-error-bg); border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent); }
        :global(.rpt-tags + .rpt-notes) { margin-top: 22px; }
        :global(.rpt-needs) { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        :global(.rpt-needs + .rpt-notes) { margin-top: 22px; }
        :global(.rpt-need) { padding: 13px 15px; border-radius: var(--radius-lg, 10px); border: 1px solid var(--color-accent-primary); background: var(--color-accent-primary-subtle); }
        :global(.rpt-need-name) { font-family: var(--font-display); font-size: 13.5px; font-weight: 700; color: var(--color-text-primary); }
        :global(.rpt-need-desc) { margin-top: 2px; font-size: 12px; color: var(--color-text-tertiary); }

        :global(.rpt-foot) { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 38px; padding-top: 14px; border-top: 1px solid var(--color-border); font-size: 11px; color: var(--color-text-tertiary); }
        :global(.rpt-key) { padding: 2px 8px; border-radius: 999px; font-family: var(--font-mono); font-size: 10px; font-weight: 700; }
        :global(.rpt-empty) { margin-top: 28px; padding: 30px; text-align: center; font-size: 13.5px; color: var(--color-text-tertiary); border: 1px dashed var(--color-border-hover); border-radius: var(--radius-lg, 10px); }
        @media (max-width: 900px) { :global(.rpt) { padding: 30px 28px 26px; } }
        @media (max-width: 640px) {
          :global(.rpt) { padding: 22px 16px 20px; }
          :global(.rpt-head) { flex-wrap: wrap; align-items: flex-start; }
          :global(.rpt-head-main) { flex-basis: calc(100% - 80px); }
          :global(.rpt-head-ring) { flex-direction: row; gap: 10px; }
          :global(.rpt-title) { font-size: 22px; }
          :global(.rpt-section) { margin-top: 32px; }
          :global(.rpt-section-title) { font-size: 17px; }
          :global(.rpt-infra-row) { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
