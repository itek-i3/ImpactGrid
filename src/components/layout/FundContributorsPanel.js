'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Gift, Plus, Wallet, Eye, Link2, X, Check } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import {
  CONTRIBUTOR_TYPE_BY_KEY, money, num, canEditFund,
  loadDemo, saveDemo, DEMO_CONTRIBUTORS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ICON_BY_TYPE = { investor: TrendingUp, donor: Gift };

// Investors and donors used to share one "Investors & Donors" page with
// two lists side by side. They're genuinely different relationships —
// one expects a return, one doesn't, and each gets its own sidebar tab
// now — but the mechanics (add one, log a payment, see their history) are
// identical, so this one component drives both pages; FundInvestorsPanel
// and FundDonorsPanel are just `type` wrappers around it.
export default function FundContributorsPanel({ type }) {
  const typeInfo = CONTRIBUTOR_TYPE_BY_KEY[type];
  const Icon = ICON_BY_TYPE[type];
  const label = `${typeInfo.label}s`; // "Investors" / "Donors"

  const { workspace, activeAgencyId, agencies, userProfile, isDemo } = useWorkspaceStore();
  const toast = useToast();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(userProfile, isDemo);
  const myId = isDemo ? 'demo-you' : userProfile?.id;
  const contributorsKey = `demo-fund-contributors-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  // ACR is a separate agency from ImpactFund — resolve its id from the
  // agencies this account can see (same match Sidebar uses to find ACR),
  // so investors here can be linked to ACR's own investor pipeline. Not
  // found at all (not superadmin, not an ACR member) just means the
  // linking UI stays hidden for this account — no error, nothing to link.
  const acrAgency = agencies?.find((a) => a.slug === 'acr' || a.name?.toLowerCase().includes('acr'));
  const acrAgencyId = acrAgency?.id || null;

  const [contributors, setContributors] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [potentialInvestors, setPotentialInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyId, setHistoryId] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState('');
  const [aContact, setAContact] = useState('');
  const [aReturn, setAReturn] = useState('');
  const [aAmount, setAAmount] = useState('');
  const [aDate, setADate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aNote, setANote] = useState('');
  const [aAcrLinkId, setAAcrLinkId] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingAcrLinkId, setEditingAcrLinkId] = useState(null); // contributor id being re-linked
  const [acrLinkInput, setAcrLinkInput] = useState('');

  const [logOpen, setLogOpen] = useState(null); // contributor
  const [mAmount, setMAmount] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setContributors(loadDemo(contributorsKey, DEMO_CONTRIBUTORS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setProjects(DEMO_PROJECTS_SEED);
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const queries = [
        sb.from('fund_contributors').select('*').eq('agency_id', agencyId).eq('type', type).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title').eq('agency_id', agencyId),
      ];
      if (type === 'investor' && acrAgencyId) {
        queries.push(sb.from('potential_investors').select('id, name, investor_type, sector, stage_focus, ticket_min, ticket_max, ticket_currency, status').eq('agency_id', acrAgencyId).order('name'));
      }
      const [{ data: c }, { data: contribs }, { data: projs }, piRes] = await Promise.all(queries);
      if (cancelled) return;
      setContributors(c || []); setContributions(contribs || []); setProjects(projs || []);
      setPotentialInvestors(piRes?.data || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    let channel = sb.channel(`fund-contributors-${type}:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributors', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load());
    if (type === 'investor' && acrAgencyId) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'potential_investors', filter: `agency_id=eq.${acrAgencyId}` }, () => !cancelled && load());
    }
    const ch = channel.subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, type, contributorsKey, contributionsKey, acrAgencyId]);

  const totalsById = useMemo(() => {
    const map = {};
    contributions.forEach((c) => { if (c.contributor_id) map[c.contributor_id] = (map[c.contributor_id] || 0) + num(c.amount); });
    return map;
  }, [contributions]);

  // Demo mode loads the whole contributors seed (both types) since it's
  // all one localStorage array — filter to this page's type client-side.
  // The real query above already scopes it with .eq('type', type).
  const rows = useMemo(
    () => contributors.filter((c) => c.type === type).map((c) => ({ ...c, total: totalsById[c.id] || 0 })).sort((a, b) => b.total - a.total),
    [contributors, totalsById, type]
  );
  const grandTotal = rows.reduce((s, c) => s + c.total, 0);
  const projectName = (id) => projects.find((p) => p.id === id)?.title || null;

  const historyContributor = rows.find((r) => r.id === historyId);
  const historyList = contributions.filter((c) => c.contributor_id === historyId);

  const resetAdd = () => {
    setAName(''); setAContact(''); setAReturn(''); setAAmount(''); setANote(''); setAAcrLinkId('');
    setADate(new Date().toISOString().slice(0, 10));
  };

  // Adding a contributor and logging their first contribution happen in
  // one step, same as adding a member — nobody shows up without having
  // already sent something.
  const addContributor = async () => {
    const amount = num(aAmount);
    if (!aName.trim() || !amount) return;
    setSaving(true);
    const contributorRow = {
      type, name: aName.trim(), contact: aContact.trim() || null,
      expected_return: type === 'investor' ? (aReturn.trim() || null) : null,
      potential_investor_id: type === 'investor' && aAcrLinkId ? aAcrLinkId : null,
      created_by: myId,
    };
    const contribBase = { category: typeInfo.category, amount, project_id: null, description: aNote.trim() || null, created_at: new Date(aDate).toISOString() };
    if (isDemo) {
      const newId = `demo-${Date.now()}`;
      const nextContributors = [{ ...contributorRow, id: newId }, ...contributors];
      const nextContributions = [{ ...contribBase, id: `demo-${Date.now()}-c`, contributor_id: newId }, ...contributions];
      setContributors(nextContributors); saveDemo(contributorsKey, nextContributors);
      setContributions(nextContributions); saveDemo(contributionsKey, nextContributions);
      setSaving(false); setAddOpen(false); resetAdd();
      toast.success('Added', `${contributorRow.name} is now on the money trail.`);
      return;
    }
    const sb = createClient();
    const { data: created, error } = await sb.from('fund_contributors').insert({ ...contributorRow, agency_id: agencyId }).select().single();
    if (error) { setSaving(false); toast.error('Could not add', error.message); return; }
    const { error: e2 } = await sb.from('fund_contributions').insert({ ...contribBase, agency_id: agencyId, contributor_id: created.id, created_by: myId });
    setSaving(false);
    if (e2) { toast.error('Added, but the contribution failed to log', e2.message); return; }
    setAddOpen(false); resetAdd();
    toast.success('Added', `${contributorRow.name} is now on the money trail.`);
  };

  const openLog = (contributor) => { setMAmount(''); setLogOpen(contributor); };

  const saveLog = async () => {
    const amount = num(mAmount);
    if (!amount || !logOpen) return;
    setSaving(true);
    const row = { contributor_id: logOpen.id, category: typeInfo.category, amount, project_id: null, description: null, created_by: myId, created_at: new Date().toISOString() };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...contributions];
      setContributions(next); saveDemo(contributionsKey, next);
      setSaving(false); setLogOpen(null);
      toast.success('Contribution logged', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_contributions').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not save', error.message); return; }
    setLogOpen(null);
    toast.success('Contribution logged', money(amount));
  };

  const openAcrLink = (contributor) => {
    setAcrLinkInput(contributor.potential_investor_id || '');
    setEditingAcrLinkId(contributor.id);
  };

  const saveAcrLink = async (contributorId) => {
    const next = acrLinkInput || null;
    setEditingAcrLinkId(null);
    if (isDemo) {
      const nextContributors = contributors.map((c) => c.id === contributorId ? { ...c, potential_investor_id: next } : c);
      setContributors(nextContributors); saveDemo(contributorsKey, nextContributors);
      return;
    }
    const { error } = await createClient().from('fund_contributors').update({ potential_investor_id: next }).eq('id', contributorId);
    if (error) { toast.error('Could not save', error.message); return; }
    toast.success(next ? 'Linked to ACR' : 'Unlinked from ACR');
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading {label.toLowerCase()}…</div>;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${typeInfo.tint}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeInfo.tint }}>
            <Icon size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>{label}</div>
            <div style={{ fontSize: 12.5, color: tSub }}>{typeInfo.blurb} — money from outside the membership</div>
          </div>
        </div>
        {canEdit && (
          <ShimmerButton onClick={() => setAddOpen(true)} background={`linear-gradient(135deg, ${typeInfo.tint}CC, ${typeInfo.tint})`} className="gap-2 text-[13px] font-bold">
            <Plus size={15} /> Add {typeInfo.label.toLowerCase()}
          </ShimmerButton>
        )}
      </div>

      {/* Totals strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Total from {label.toLowerCase()}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: typeInfo.tint, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={grandTotal} /></div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{rows.length}</div>
        </div>
      </div>

      <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: typeInfo.tint, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{label} ({rows.length})</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>No {label.toLowerCase()} yet.</div>
        ) : rows.map((c) => (
          <div
            key={c.id}
            onClick={() => setHistoryId(c.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', cursor: 'pointer' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: `${typeInfo.tint}22`, color: typeInfo.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              {c.contact && <div style={{ fontSize: 10.5, color: tSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact}</div>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(c.total)}</div>
            <button
              onClick={(e) => { e.stopPropagation(); setHistoryId(c.id); }}
              title="View contributions"
              style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Eye size={14} />
            </button>
            {canEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); openLog(c); }}
                title={`Log a payment from this ${typeInfo.label.toLowerCase()}`}
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: `${typeInfo.tint}22`, color: typeInfo.tint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* History modal */}
      <Modal isOpen={!!historyId} onClose={() => setHistoryId(null)} title={historyContributor ? `${historyContributor.name}'s contributions` : 'Contributions'} maxWidth="440px">
        {historyContributor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${typeInfo.tint}22`, color: typeInfo.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={15} /></div>
              <div>
                {historyContributor.contact && <div style={{ fontSize: 11.5, color: tSub, marginBottom: 1 }}>{historyContributor.contact}</div>}
                <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={historyContributor.total} /></div>
              </div>
            </div>
            {historyContributor.expected_return && <div style={{ fontSize: 12, color: tSub }}>Expects <strong style={{ color: tKey }}>{historyContributor.expected_return}</strong></div>}
            {type === 'investor' && (() => {
              const linked = acrAgencyId && historyContributor.potential_investor_id
                ? potentialInvestors.find((pi) => pi.id === historyContributor.potential_investor_id)
                : null;
              return (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(91,155,255,0.08)', border: '1px solid rgba(91,155,255,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Link2 size={11} /> ACR link
                    </span>
                    {canEdit && acrAgencyId && editingAcrLinkId !== historyContributor.id && (
                      <button className="fund-btn" style={{ height: 24, fontSize: 10.5 }} onClick={() => openAcrLink(historyContributor)}>
                        {historyContributor.potential_investor_id ? 'Change' : 'Link'}
                      </button>
                    )}
                  </div>
                  {editingAcrLinkId === historyContributor.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <select className="fund-input" style={{ height: 32 }} value={acrLinkInput} onChange={(e) => setAcrLinkInput(e.target.value)}>
                        <option value="">Not linked</option>
                        {potentialInvestors.map((pi) => <option key={pi.id} value={pi.id}>{pi.name}{pi.investor_type ? ` — ${pi.investor_type}` : ''}</option>)}
                      </select>
                      <button className="fund-btn" style={{ height: 32 }} onClick={() => saveAcrLink(historyContributor.id)}><Check size={12} /></button>
                      <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingAcrLinkId(null)}><X size={12} /></button>
                    </div>
                  ) : linked ? (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tKey }}>{linked.name}</div>
                      <div style={{ fontSize: 11, color: tSub, marginTop: 2 }}>
                        {[
                          linked.investor_type,
                          linked.sector,
                          (linked.ticket_min || linked.ticket_max) ? `${linked.ticket_currency} ${linked.ticket_min ? num(linked.ticket_min).toLocaleString() : '?'}–${linked.ticket_max ? num(linked.ticket_max).toLocaleString() : '?'}` : null,
                          linked.status,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ) : historyContributor.potential_investor_id ? (
                    <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic', marginTop: 4 }}>Linked — ACR details not visible to you.</div>
                  ) : (
                    <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic', marginTop: 4 }}>Not linked to an ACR investor record.</div>
                  )}
                </div>
              );
            })()}
            {historyList.length === 0 ? (
              <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No contributions logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {historyList.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>
                        {c.project_id ? (projectName(c.project_id) || 'A project') : 'General fund'}
                      </div>
                      <div style={{ fontSize: 10.5, color: tSub }}>{fmtDate(c.created_at)}{c.description ? ` · ${c.description}` : ''}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{money(c.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add a contributor — their details plus the contribution that comes with adding them */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={`Add ${typeInfo.label.toLowerCase()}`} maxWidth="420px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Name</span>
            <input className="fund-input" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Person or organisation" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Contact</span>
            <input className="fund-input" value={aContact} onChange={(e) => setAContact(e.target.value)} placeholder="Phone or email" />
          </label>
          {type === 'investor' && (
            <label style={{ display: 'block' }}>
              <span className="fund-label">Expected return (optional)</span>
              <input className="fund-input" value={aReturn} onChange={(e) => setAReturn(e.target.value)} placeholder="e.g. 12% annually" />
            </label>
          )}
          {type === 'investor' && acrAgencyId && (
            <label style={{ display: 'block' }}>
              <span className="fund-label">Link to ACR investor (optional)</span>
              <select className="fund-input" value={aAcrLinkId} onChange={(e) => setAAcrLinkId(e.target.value)}>
                <option value="">Not linked</option>
                {potentialInvestors.map((pi) => <option key={pi.id} value={pi.id}>{pi.name}{pi.investor_type ? ` — ${pi.investor_type}` : ''}</option>)}
              </select>
              <div style={{ fontSize: 10.5, color: tSub, marginTop: 4 }}>If this is the same investor ACR is tracking in its own pipeline, mark it so both sides stay connected.</div>
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Amount sent (KES)</span>
              <input className="fund-input" type="number" inputMode="decimal" value={aAmount} onChange={(e) => setAAmount(e.target.value)} placeholder="50000" />
            </label>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Date</span>
              <input className="fund-input" type="date" value={aDate} onChange={(e) => setADate(e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Note (optional)</span>
            <textarea className="fund-input" rows={2} value={aNote} onChange={(e) => setANote(e.target.value)} placeholder="e.g. Wire reference" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="fund-btn primary" onClick={addContributor} disabled={saving || !aName.trim() || !num(aAmount)}>{saving ? 'Saving…' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      {/* Log a payment — just the amount */}
      <Modal isOpen={!!logOpen} onClose={() => setLogOpen(null)} title={`Log a payment — ${logOpen?.name || ''}`} maxWidth="340px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Amount (KES)</span>
            <input className="fund-input" type="number" inputMode="decimal" autoFocus value={mAmount} onChange={(e) => setMAmount(e.target.value)} placeholder="50000" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setLogOpen(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveLog} disabled={saving || !num(mAmount)}>Save</button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        .fund-label { display: block; font-size: 10.5px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
        .fund-input {
          width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px; border-radius: 10px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
        }
        textarea.fund-input { height: auto; padding: 8px 12px; resize: vertical; }
        .fund-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .fund-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: .12s;
        }
        .fund-btn:hover { border-color: var(--color-border-active); }
        .fund-btn.primary { background: linear-gradient(135deg,#1E4FB8,#306CEC); border: none; color: #fff; }
        .fund-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
