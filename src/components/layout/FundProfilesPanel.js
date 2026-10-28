'use client';

import { useEffect, useMemo, useState } from 'react';
import { IdCard, Search, Check, Repeat, Boxes, HandCoins, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import Modal from '@/components/ui/Modal';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, byMember, membershipPaid, isPaidMember, CATEGORY_LABEL,
  loanBalance, loanTotalRepayable, loanDueDate, isLoanOverdue, loadDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED, DEMO_SETTINGS_SEED, DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// A single dossier per member — everything every other fund tab knows about
// them (fee status, instalments, projects backed, loans) read off the same
// ledgers and brought together in one place instead of across five tabs.
export default function FundProfilesPanel() {
  const { workspace, activeAgencyId, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;
  const loansKey = `demo-fund-loans-${agencyId || 'x'}`;
  const repaymentsKey = `demo-fund-loan-repayments-${agencyId || 'x'}`;

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setProjects(DEMO_PROJECTS_SEED);
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoans(loadDemo(loansKey, DEMO_LOANS_SEED));
        setRepayments(loadDemo(repaymentsKey, DEMO_LOAN_REPAYMENTS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: p }, { data: s }, { data: l }, { data: r }] = await Promise.all([
        sb.from('fund_members').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
        sb.from('fund_loans').select('*').eq('agency_id', agencyId),
        sb.from('fund_loan_repayments').select('*').eq('agency_id', agencyId),
      ]);
      if (cancelled) return;
      setMembers(m || []); setContributions(contribs || []); setProjects(p || []);
      setSettings(s || DEMO_SETTINGS_SEED);
      setLoans(l || []); setRepayments(r || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-profiles:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loans', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loan_repayments', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, settingsKey, loansKey, repaymentsKey]);

  const membershipFee = num(settings?.membership_fee);
  const projectName = (id) => projects.find((p) => p.id === id)?.title || 'A project';

  const profiles = useMemo(() => members.map((m) => {
    const history = contributions.filter((c) => c.member_id === m.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const monthlyList = history.filter((c) => c.category === 'monthly');
    const projectList = history.filter((c) => c.project_id); // baseline + extra both count toward what was put into a project
    const projectTotals = new Map();
    projectList.forEach((c) => {
      const key = c.project_id || 'unassigned';
      projectTotals.set(key, (projectTotals.get(key) || 0) + num(c.amount));
    });
    const titleOf = (id) => projects.find((pr) => pr.id === id)?.title || 'A project';
    const memberLoans = loans.filter((l) => l.member_id === m.id).map((l) => ({
      ...l, balance: loanBalance(l, repayments), totalRepayable: loanTotalRepayable(l), dueAt: loanDueDate(l), overdue: isLoanOverdue(l, repayments),
    }));
    const activeLoan = memberLoans.find((l) => l.balance > 0) || null;
    const pastLoans = memberLoans.filter((l) => l.balance <= 0);

    return {
      ...m,
      history,
      total: byMember(contributions, m.id),
      paidToFee: membershipPaid(contributions, m.id),
      isMember: isPaidMember(contributions, m.id, membershipFee),
      monthlyTotal: monthlyList.reduce((s, c) => s + num(c.amount), 0),
      monthlyCount: monthlyList.length,
      lastMonthlyAt: monthlyList[0]?.created_at || null,
      projectBacking: [...projectTotals.entries()].map(([id, amount]) => ({ id, title: titleOf(id), amount })),
      activeLoan, pastLoans,
    };
  }).sort((a, b) => b.total - a.total), [members, contributions, loans, repayments, projects, membershipFee]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.name.toLowerCase().includes(q) || (p.contact || '').toLowerCase().includes(q));
  }, [profiles, search]);

  const openProfile = profiles.find((p) => p.id === openId) || null;

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };
  const innerCard = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.10), rgba(255,255,255,0.015) 70%)',
    border: '1px solid rgba(91,155,255,0.14)', borderRadius: 16, padding: '14px 16px',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading profiles…</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
          <IdCard size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Profile</div>
          <div style={{ fontSize: 12.5, color: tSub }}>Every member, and everything the fund knows about them</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: tSub, pointerEvents: 'none' }} />
        <input
          className="fund-input"
          style={{ paddingLeft: 32 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name or contact…"
        />
      </div>

      {/* Roster */}
      <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>
            {members.length === 0 ? 'No members yet.' : `No members match “${search}”.`}
          </div>
        ) : visible.map((p) => (
          <div
            key={p.id}
            onClick={() => setOpenId(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', cursor: 'pointer' }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: p.isMember ? 'rgba(34,197,94,0.18)' : 'rgba(245,166,35,0.18)',
              color: p.isMember ? '#22C55E' : '#F5A623',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 10.5, color: tSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.contact || 'No contact on file'}
              </div>
            </div>
            {p.activeLoan && (
              <span title="Has an active loan" style={{ flexShrink: 0, color: p.activeLoan.overdue ? '#EF4444' : '#5B9BFF' }}>
                <HandCoins size={14} />
              </span>
            )}
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 800, color: p.isMember ? '#22C55E' : '#F5A623',
              background: p.isMember ? 'rgba(34,197,94,0.14)' : 'rgba(245,166,35,0.14)', borderRadius: 999,
              padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              {p.isMember ? 'Member' : 'Prospective'}
            </span>
            <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>{money(p.total)}</div>
          </div>
        ))}
      </div>

      {/* Full profile */}
      <Modal isOpen={!!openProfile} onClose={() => setOpenId(null)} title={openProfile?.name || 'Profile'} maxWidth="520px">
        {openProfile && (() => {
          const p = openProfile;
          const feeDone = p.paidToFee >= membershipFee;
          const feePct = membershipFee > 0 ? Math.min(100, Math.round((p.paidToFee / membershipFee) * 100)) : 100;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: p.isMember ? 'linear-gradient(145deg, rgba(34,197,94,0.30), rgba(34,197,94,0.10))' : 'linear-gradient(145deg, rgba(245,166,35,0.30), rgba(245,166,35,0.10))',
                  border: `1.5px solid ${p.isMember ? 'rgba(34,197,94,0.4)' : 'rgba(245,166,35,0.4)'}`,
                  color: p.isMember ? '#22C55E' : '#F5A623',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: tSub }}>{p.contact || 'No contact on file'}</div>
                  <div style={{ fontSize: 11, color: tSub }}>Member since {fmtDate(p.created_at)}</div>
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 800, color: p.isMember ? '#22C55E' : '#F5A623',
                  background: p.isMember ? 'rgba(34,197,94,0.14)' : 'rgba(245,166,35,0.14)', borderRadius: 999,
                  padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  {p.isMember ? 'Member' : 'Prospective'}
                </span>
              </div>

              {/* Stat tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div style={innerCard}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Total contributed</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={p.total} /></div>
                </div>
                <div style={innerCard}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Loan status</div>
                  {p.activeLoan ? (
                    <div style={{ fontSize: 13, fontWeight: 800, color: p.activeLoan.overdue ? '#EF4444' : tKey, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.activeLoan.overdue && <AlertTriangle size={12} />} {money(p.activeLoan.balance)} owed
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 700, color: tKey }}>None outstanding</div>
                  )}
                </div>
              </div>

              {/* Membership fee */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: feeDone ? 0 : 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Membership fee</span>
                  {feeDone ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={12} /> Paid in full</span>
                  ) : (
                    <span style={{ fontSize: 12, color: tSub }}>{money(p.paidToFee)} of {money(membershipFee)}</span>
                  )}
                </div>
                {!feeDone && (
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${feePct}%`, background: 'linear-gradient(90deg,#F5A623,#F7C948)' }} />
                  </div>
                )}
              </div>

              {/* Monthly instalments */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Repeat size={13} style={{ color: 'var(--color-accent-text, #7EB3FF)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Monthly instalments</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(p.monthlyTotal)}</span>
                </div>
                <div style={{ fontSize: 11, color: tSub, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{p.monthlyCount} instalment{p.monthlyCount !== 1 ? 's' : ''}{p.lastMonthlyAt ? ` · last ${fmtDate(p.lastMonthlyAt)}` : ''}</span>
                  <button onClick={() => { setOpenId(null); setCurrentView('fundInstallments'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                    See all →
                  </button>
                </div>
              </div>

              {/* Projects backed */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: p.projectBacking.length ? 10 : 0 }}>
                  <Boxes size={13} style={{ color: 'var(--color-accent-text, #7EB3FF)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Projects backed</span>
                </div>
                {p.projectBacking.length === 0 ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>Hasn&rsquo;t backed a project yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {p.projectBacking.map((pb) => (
                      <div key={pb.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12.5, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pb.title}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: tKey, flexShrink: 0 }}>{money(pb.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Loans */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HandCoins size={13} style={{ color: 'var(--color-accent-text, #7EB3FF)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Loans</span>
                  </div>
                  <button onClick={() => { setOpenId(null); setCurrentView('fundLoans'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                    Open Loans →
                  </button>
                </div>
                {p.activeLoan ? (
                  <div style={{ fontSize: 12.5, color: tKey }}>
                    <strong style={{ color: p.activeLoan.overdue ? '#EF4444' : tKey }}>{money(p.activeLoan.balance)}</strong> of {money(p.activeLoan.totalRepayable)} still owed
                    {p.activeLoan.overdue ? ', overdue since ' : ', due '}{fmtDate(p.activeLoan.dueAt)}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No active loan.</div>
                )}
                {p.pastLoans.length > 0 && (
                  <div style={{ fontSize: 11, color: tSub, marginTop: 6 }}>{p.pastLoans.length} loan{p.pastLoans.length !== 1 ? 's' : ''} fully repaid in the past.</div>
                )}
              </div>

              {/* Recent activity */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Recent activity</div>
                {p.history.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No contributions logged yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {p.history.slice(0, 10).map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: tKey }}>
                            {CATEGORY_LABEL[c.category] || c.category}
                            {c.project_id && <span style={{ color: tSub, fontWeight: 500 }}> · {projectName(c.project_id)}</span>}
                          </div>
                          <div style={{ fontSize: 10.5, color: tSub }}>{fmtDate(c.created_at)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{money(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <style jsx global>{`
        .fund-input {
          width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px; border-radius: 10px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
        }
        .fund-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
      `}</style>
    </div>
  );
}
