'use client';

import { useEffect, useMemo, useState } from 'react';
import { IdCard, Check, Repeat, Boxes, HandCoins, AlertTriangle, Gauge, Unlock, Lock, Wallet } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { DotPattern } from '@/components/magicui/dot-pattern';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, byMember, membershipPaid, isPaidMember, CATEGORY_LABEL, memberByLoginEmail, monthKeyOf, monthlyPaidThisMonth,
  loanBalance, loanTotalOwed, loanDueDate, isLoanOverdue, loanEligibility, creditScoreOf, memberBaselineStatus, loadDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED, DEMO_SETTINGS_SEED, DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const thisMonthKey = () => new Date().toISOString().slice(0, 7);

// A plain member's own view — the same dossier the Profile tab shows
// managers for everyone, scoped to just this one person. Which fund_members
// row is "them" is resolved by matching their login email against
// login_email (set by a manager on the Members tab), never by contact,
// since contact is often a phone number, not an email.
export default function FundMyProfilePanel() {
  const { workspace, activeAgencyId, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
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
        sb.from('fund_members').select('*').eq('agency_id', agencyId),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title, baseline_monthly_amount, created_at').eq('agency_id', agencyId),
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
    const ch = sb.channel(`fund-my-profile:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loans', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loan_repayments', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, settingsKey, loansKey, repaymentsKey]);

  const membershipFee = num(settings?.membership_fee);
  const expectedMonthly = num(settings?.monthly_contribution_amount);
  const projectName = (id) => projects.find((p) => p.id === id)?.title || 'A project';

  const me = isDemo ? (members.find((m) => m.id === 'mem-you') || null) : memberByLoginEmail(members, userProfile?.email);

  const profile = useMemo(() => {
    if (!me) return null;
    const history = contributions.filter((c) => c.member_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const monthlyList = history.filter((c) => c.category === 'monthly');
    const projectList = history.filter((c) => c.project_id); // baseline + extra both count toward what was put into a project
    const projectTotals = new Map();
    projectList.forEach((c) => {
      const key = c.project_id || 'unassigned';
      projectTotals.set(key, (projectTotals.get(key) || 0) + num(c.amount));
    });
    const titleOf = (id) => projects.find((pr) => pr.id === id)?.title || 'A project';
    const memberLoans = loans.filter((l) => l.member_id === me.id).map((l) => ({
      ...l, balance: loanBalance(l, repayments), totalRepayable: loanTotalOwed(l), dueAt: loanDueDate(l), overdue: isLoanOverdue(l, repayments),
    }));
    const activeLoan = memberLoans.find((l) => l.balance > 0) || null;
    const pastLoans = memberLoans.filter((l) => l.balance <= 0);
    const thisMonthTotal = monthlyList.filter((c) => monthKeyOf(c.created_at) === thisMonthKey()).reduce((s, c) => s + num(c.amount), 0);
    const paidThisMonth = monthlyPaidThisMonth(thisMonthTotal, expectedMonthly);
    return {
      ...me,
      history,
      total: byMember(contributions, me.id),
      paidToFee: membershipPaid(contributions, me.id),
      isMember: isPaidMember(contributions, me.id, membershipFee),
      monthlyTotal: monthlyList.reduce((s, c) => s + num(c.amount), 0),
      monthlyCount: monthlyList.length,
      lastMonthlyAt: monthlyList[0]?.created_at || null,
      thisMonthTotal, paidThisMonth,
      projectBacking: [...projectTotals.entries()].map(([id, amount]) => ({ id, title: titleOf(id), amount })),
      activeLoan, pastLoans,
    };
  }, [me, contributions, loans, repayments, projects, membershipFee, expectedMonthly]);

  const eligibility = useMemo(() => (me ? loanEligibility(me, contributions, loans, repayments, settings) : null), [me, contributions, loans, repayments, settings]);
  const credit = useMemo(() => (me ? creditScoreOf(me, contributions, loans, repayments, settings, projects) : null), [me, contributions, loans, repayments, settings, projects]);
  const baselines = useMemo(() => (me ? memberBaselineStatus(projects, contributions, me.id) : []), [me, projects, contributions]);

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };
  const divider = { borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading your profile…</div>;

  // Not linked to a fund_members record yet — nothing to show.
  if (!profile) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <IdCard size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: tKey, marginBottom: 6 }}>You&rsquo;re not linked to a member record yet</div>
          <div style={{ fontSize: 12.5, color: tSub, lineHeight: 1.5 }}>Ask your fund manager to add you on the Members tab and link it to <strong style={{ color: tKey }}>{userProfile?.email || 'your account email'}</strong> — once that&rsquo;s done, your profile shows up here.</div>
        </div>
      </div>
    );
  }

  const p = profile;
  const feeDone = p.paidToFee >= membershipFee;
  const feePct = membershipFee > 0 ? Math.min(100, Math.round((p.paidToFee / membershipFee) * 100)) : 100;

  // Linked, but hasn't finished paying the membership fee yet — locked
  // until they do, per how this chama runs membership.
  if (!feeDone) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(245,166,35,0.30), rgba(245,166,35,0.10))',
            border: '1.5px solid rgba(245,166,35,0.4)', color: '#F5A623',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
          }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: tKey }}>{p.name}</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#F5A623', background: 'rgba(245,166,35,0.14)', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.03em' }}>Prospective</span>
          </div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: tKey, marginBottom: 10 }}>Finish paying your membership fee to unlock your profile</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={p.paidToFee} /></span>
            <span style={{ fontSize: 13, color: tSub, fontWeight: 600 }}>of {money(membershipFee)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
            <div style={{ height: '100%', width: `${feePct}%`, background: 'linear-gradient(90deg,#F5A623,#F7C948)' }} />
          </div>
          <div style={{ fontSize: 11.5, color: tSub, marginTop: 14 }}>Owes {money(Math.max(0, membershipFee - p.paidToFee))} — talk to your Treasurer about paying the rest.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Hero */}
      <div className="dash-card" style={{ ...card, position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
        <DotPattern className="[mask-image:radial-gradient(400px_circle_at_top_right,white,transparent)]" style={{ color: 'rgba(91,155,255,0.35)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(145deg, rgba(34,197,94,0.30), rgba(34,197,94,0.10))',
              border: '1.5px solid rgba(34,197,94,0.4)', color: '#22C55E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.02em' }}>{p.name}</h1>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.14)', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Member</span>
              </div>
              <div style={{ fontSize: 12.5, color: tSub, marginTop: 2 }}>{p.contact && <>{p.contact} · </>}Member since {fmtDate(p.created_at)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
            <HeroStat label="Total contributed" value={p.total} prefix="KSh " Icon={Wallet} tint="#5B9BFF" />
            <HeroStat
              label="This month" value={p.thisMonthTotal} prefix="KSh " Icon={Repeat}
              tint={p.paidThisMonth ? '#22C55E' : '#F5A623'}
              sub={p.paidThisMonth ? 'Paid' : (expectedMonthly > 0 ? `Owes ${money(Math.max(0, expectedMonthly - p.thisMonthTotal))}` : 'Not paid yet')}
            />
            <HeroStat label="Credit score" value={credit?.score ?? 0} Icon={Gauge} tint={credit?.band?.tint || '#5B9BFF'} sub={credit?.band?.label} />
            <HeroStat
              label="Loan" prefix="KSh " Icon={HandCoins}
              value={p.activeLoan ? p.activeLoan.balance : (eligibility?.eligible ? eligibility.available : 0)}
              tint={p.activeLoan ? (p.activeLoan.overdue ? '#EF4444' : '#5B9BFF') : (eligibility?.eligible ? '#22C55E' : '#6C82A3')}
              sub={p.activeLoan ? (
                p.activeLoan.overdue
                  ? <><AlertTriangle size={10} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }} />Overdue since {fmtDate(p.activeLoan.dueAt)}</>
                  : `Owed, due ${fmtDate(p.activeLoan.dueAt)}`
              ) : (eligibility?.eligible ? 'Available to borrow' : 'Not eligible yet')}
            />
          </div>
        </div>
      </div>

      {/* What you own | Loans & credit score */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
        {/* What you own */}
        <div className="dash-card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(48,108,236,0.18)', color: 'var(--color-accent-text, #7EB3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Boxes size={16} />
            </div>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>What you own</h2>
          </div>

          <div style={{ ...divider, paddingBottom: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: tKey, fontWeight: 600 }}>Membership fee</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={12} /> Paid in full</span>
          </div>

          <div style={{ ...divider, paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: tKey, fontWeight: 600 }}>Monthly instalments</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(p.monthlyTotal)}</span>
            </div>
            <div style={{ fontSize: 11, color: tSub, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{p.monthlyCount} instalment{p.monthlyCount !== 1 ? 's' : ''}{p.lastMonthlyAt ? ` · last ${fmtDate(p.lastMonthlyAt)}` : ''}</span>
              <button onClick={() => setCurrentView('fundMyInstallments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                See your full history →
              </button>
            </div>
            <div style={{ fontSize: 11.5, marginTop: 6 }}>
              {p.paidThisMonth ? (
                <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700 }}><Check size={11} /> Paid this month</span>
              ) : (
                <span style={{ color: '#F5A623', fontWeight: 700 }}>
                  Not paid this month{expectedMonthly > 0 ? ` — owes ${money(Math.max(0, expectedMonthly - p.thisMonthTotal))}` : ''}
                </span>
              )}
            </div>
          </div>

          <div style={{ ...divider, paddingBottom: baselines.length ? 12 : 0, marginBottom: baselines.length ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: p.projectBacking.length ? 10 : 0 }}>
              <span style={{ fontSize: 12.5, color: tKey, fontWeight: 600 }}>Projects backed</span>
              <button onClick={() => setCurrentView('fundProjects')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                Back a project →
              </button>
            </div>
            {p.projectBacking.length === 0 ? (
              <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>You haven&rsquo;t backed a project yet.</div>
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

          {baselines.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: tKey, fontWeight: 600 }}>Project dues</span>
                <button onClick={() => setCurrentView('fundMyInstallments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
                  See your full history →
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: tSub, marginBottom: 8 }}>A required monthly due on each project below — owed automatically, same as the chama instalment.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {baselines.map((b) => (
                  <div key={b.project.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{b.project.title}</span>
                    {b.paidThisMonth ? (
                      <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><Check size={10} /> Paid</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#F5A623', fontWeight: 700, flexShrink: 0 }}>Owes {money(b.required)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loans & credit score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="dash-card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(34,197,94,0.18)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HandCoins size={16} />
                </div>
                <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Loans</h2>
              </div>
              <button onClick={() => setCurrentView('fundMyLoans')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: 0, flexShrink: 0 }}>
                See full loan details →
              </button>
            </div>

            <div style={{ ...divider, paddingBottom: 12, marginBottom: 12 }}>
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

            {eligibility && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {eligibility.eligible ? <Unlock size={13} style={{ color: '#22C55E' }} /> : <Lock size={13} style={{ color: tSub }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Eligible for a new loan</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', borderRadius: 999, padding: '3px 9px',
                    color: eligibility.eligible ? '#22C55E' : '#F5A623',
                    background: eligibility.eligible ? 'rgba(34,197,94,0.14)' : 'rgba(245,166,35,0.14)',
                  }}>
                    {eligibility.eligible ? 'Eligible' : 'Not yet'}
                  </span>
                </div>
                {eligibility.eligible ? (
                  <div style={{ fontSize: 12.5, color: tKey, lineHeight: 1.5 }}>
                    You could borrow up to <strong>{money(eligibility.available)}</strong> ({money(eligibility.savings)} in savings × {num(settings?.loan_multiplier) || 3}). Talk to your Treasurer to request it.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {eligibility.reasons.map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#F5A623' }}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {credit && (
            <div className="dash-card" style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: `${credit.band.tint}22`, color: credit.band.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Gauge size={16} />
                  </div>
                  <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Credit score</h2>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', borderRadius: 999, padding: '3px 9px',
                  color: credit.band.tint, background: `${credit.band.tint}22`,
                }}>
                  {credit.band.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}><NumberTicker value={credit.score} /></span>
                <span style={{ fontSize: 11.5, color: tSub }}>out of 850</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, Math.round(((credit.score - 300) / (850 - 300)) * 100)))}%`, background: `linear-gradient(90deg, ${credit.band.tint}, ${credit.band.tint}AA)` }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {credit.factors.map((f) => (
                  <div key={f.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11.5, color: tKey, fontWeight: 600 }}>{f.label}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: f.points < 0 ? '#EF4444' : tKey }}>{f.points > 0 ? '+' : ''}{f.points}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: tSub }}>{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="dash-card" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.06)', color: tSub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IdCard size={16} />
          </div>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Recent activity</h2>
        </div>
        {p.history.length === 0 ? (
          <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No contributions logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {p.history.slice(0, 15).map((c) => (
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
}

function HeroStat({ label, value, prefix = '', Icon, tint, sub }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSubColor = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: tSubColor, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{prefix}<NumberTicker value={value} /></div>
        {sub && <div style={{ fontSize: 10.5, color: tint, fontWeight: 700, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}
