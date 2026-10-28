'use client';

import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Gauge, Unlock, Lock, AlertTriangle, Check, IdCard } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, memberByLoginEmail,
  loanBalance, loanTotalOwed, loanDueDate, isLoanOverdue, loanEligibility, creditScoreOf, loadDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED, DEMO_SETTINGS_SEED, DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// A member's own loans page — how much they could borrow, their credit
// score, and the full detail (including repayment history) on every loan
// they've ever had, scoped to just this person the same way My Profile and
// My Instalments are: by matching their account's login email against
// fund_members.login_email, never the full member roster.
export default function FundMyLoansPanel() {
  const { workspace, activeAgencyId, userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;
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
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoans(loadDemo(loansKey, DEMO_LOANS_SEED));
        setRepayments(loadDemo(repaymentsKey, DEMO_LOAN_REPAYMENTS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: p }, { data: s }, { data: l }, { data: r }] = await Promise.all([
        sb.from('fund_members').select('id, name, login_email, created_at').eq('agency_id', agencyId),
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
    const ch = sb.channel(`fund-my-loans:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loans', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loan_repayments', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, projectsKey, settingsKey, loansKey, repaymentsKey]);

  const me = isDemo ? (members.find((m) => m.id === 'mem-you') || null) : memberByLoginEmail(members, userProfile?.email);

  const eligibility = useMemo(() => (me ? loanEligibility(me, contributions, loans, repayments, settings) : null), [me, contributions, loans, repayments, settings]);
  const credit = useMemo(() => (me ? creditScoreOf(me, contributions, loans, repayments, settings, projects) : null), [me, contributions, loans, repayments, settings, projects]);

  const myLoans = useMemo(() => {
    if (!me) return [];
    return loans
      .filter((l) => l.member_id === me.id)
      .map((l) => ({
        ...l,
        balance: loanBalance(l, repayments),
        totalRepayable: loanTotalOwed(l),
        dueAt: loanDueDate(l),
        overdue: isLoanOverdue(l, repayments),
        repayments: repayments.filter((r) => r.loan_id === l.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }))
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));
  }, [me, loans, repayments]);
  const activeLoans = myLoans.filter((l) => l.balance > 0);
  const pastLoans = myLoans.filter((l) => l.balance <= 0);

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 18, padding: 18,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading your loans…</div>;

  if (!me) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <IdCard size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: tKey, marginBottom: 6 }}>You&rsquo;re not linked to a member record yet</div>
          <div style={{ fontSize: 12.5, color: tSub, lineHeight: 1.5 }}>Ask your fund manager to add you on the Members tab and link it to <strong style={{ color: tKey }}>{userProfile?.email || 'your account email'}</strong> — once that&rsquo;s done, your loans show up here.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
          <HandCoins size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>My Loans</div>
          <div style={{ fontSize: 12.5, color: tSub }}>How much you can borrow, your credit score, and every loan you&rsquo;ve had</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Credit score */}
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

        {/* Loan eligibility */}
        {eligibility && (
          <div className="dash-card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: eligibility.eligible ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)', color: eligibility.eligible ? '#22C55E' : tSub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {eligibility.eligible ? <Unlock size={16} /> : <Lock size={16} />}
                </div>
                <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>How much you can borrow</h2>
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
              <div style={{ fontSize: 13, color: tKey, lineHeight: 1.6 }}>
                You could borrow up to <strong style={{ fontSize: 17 }}>{money(eligibility.available)}</strong> — {money(eligibility.savings)} in savings × {num(settings?.loan_multiplier) || 3}. Talk to your Treasurer to request it.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 12, color: tSub, marginBottom: 2 }}>Not eligible for a new loan right now:</div>
                {eligibility.reasons.map((r, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#F5A623' }}>• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active loans */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Active loans</div>
          {activeLoans.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No active loan right now.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeLoans.map((l) => <LoanCard key={l.id} loan={l} card={card} tKey={tKey} tSub={tSub} />)}
            </div>
          )}
        </div>

        {/* Past loans */}
        {pastLoans.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Past loans — fully repaid</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pastLoans.map((l) => <LoanCard key={l.id} loan={l} card={card} tKey={tKey} tSub={tSub} repaid />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoanCard({ loan, card, tKey, tSub, repaid }) {
  return (
    <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(loan.principal)} principal</div>
          <div style={{ fontSize: 10.5, color: tSub }}>{loan.interest_rate}% flat interest · {loan.term_months} month term · issued {new Date(loan.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        {repaid ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={12} /> Fully repaid</span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 800, color: loan.overdue ? '#EF4444' : tKey, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {loan.overdue && <AlertTriangle size={11} />} {money(loan.balance)} owed
          </span>
        )}
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tSub, marginBottom: 10 }}>
          <span>Total repayable: <strong style={{ color: tKey }}>{money(loan.totalRepayable)}</strong></span>
          <span style={{ color: loan.overdue && !repaid ? '#EF4444' : tSub }}>{repaid ? 'Due was' : loan.overdue ? 'Overdue since' : 'Due'} {new Date(loan.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        {num(loan.penalty_amount) > 0 && (
          <div style={{ fontSize: 11.5, color: '#EF4444', marginBottom: 10 }}>Includes {money(loan.penalty_amount)} late penalty</div>
        )}
        {loan.note && <div style={{ fontSize: 11.5, color: tSub, fontStyle: 'italic', marginBottom: 10 }}>{loan.note}</div>}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Repayments</div>
        {loan.repayments.length === 0 ? (
          <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>None logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loan.repayments.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: 12, color: tSub }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success-text, #22C55E)' }}>+{money(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
