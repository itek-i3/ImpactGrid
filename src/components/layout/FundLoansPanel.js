'use client';

import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Plus, Eye, Check, Pencil, X, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, canEditFund, loadDemo, saveDemo,
  loanEligibility, loanTotalRepayable, loanTotalOwed, loanMonthlyInstallment, loanBalance, loanDueDate, isLoanOverdue,
  loanPoolUtilisation, loanLatePenaltyAmount,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_SETTINGS_SEED, DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Who can borrow, how much, and what they owe back — eligibility and limits
// are computed from the same fund_contributions ledger every other fund
// panel reads (savings = membership + monthly payments only, never money
// already earmarked to a project); the loans themselves and their
// repayments are their own small append-only ledger, same philosophy.
export default function FundLoansPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo } = useWorkspaceStore();
  const toast = useToast();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(agencies, activeAgencyId, isDemo);
  const myId = isDemo ? 'demo-you' : userProfile?.id;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;
  const loansKey = `demo-fund-loans-${agencyId || 'x'}`;
  const repaymentsKey = `demo-fund-loan-repayments-${agencyId || 'x'}`;

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingSettings, setEditingSettings] = useState(false);
  const [multInput, setMultInput] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [termInput, setTermInput] = useState('');
  const [qualInput, setQualInput] = useState('');
  const [maxPerInput, setMaxPerInput] = useState('');
  const [poolPctInput, setPoolPctInput] = useState('');
  const [penaltyPctInput, setPenaltyPctInput] = useState('');

  const [issueFor, setIssueFor] = useState(null); // member
  const [iPrincipal, setIPrincipal] = useState('');
  const [iRate, setIRate] = useState('');
  const [iTerm, setITerm] = useState('');
  const [iDate, setIDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [iNote, setINote] = useState('');

  const [repayFor, setRepayFor] = useState(null); // loan
  const [rAmount, setRAmount] = useState('');
  const [rDate, setRDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [penaltyFor, setPenaltyFor] = useState(null); // loan

  const [historyId, setHistoryId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoans(loadDemo(loansKey, DEMO_LOANS_SEED));
        setRepayments(loadDemo(repaymentsKey, DEMO_LOAN_REPAYMENTS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: s }, { data: l }, { data: r }] = await Promise.all([
        sb.from('fund_members').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
        sb.from('fund_loans').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_loan_repayments').select('*').eq('agency_id', agencyId),
      ]);
      if (cancelled) return;
      setMembers(m || []); setContributions(contribs || []);
      setSettings(s || DEMO_SETTINGS_SEED);
      setLoans(l || []); setRepayments(r || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-loans:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loans', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loan_repayments', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, settingsKey, loansKey, repaymentsKey]);

  const nameOf = (id) => members.find((m) => m.id === id)?.name || 'A member';

  const rows = useMemo(
    () => members.map((m) => ({ ...m, ...loanEligibility(m, contributions, loans, repayments, settings) })),
    [members, contributions, loans, repayments, settings]
  );
  const eligibleRows = rows.filter((r) => r.eligible).sort((a, b) => b.available - a.available);
  const ineligibleRows = rows.filter((r) => !r.eligible);

  const loanRows = useMemo(() => loans.map((l) => ({
    ...l,
    balance: loanBalance(l, repayments),
    totalRepayable: loanTotalRepayable(l),
    totalOwed: loanTotalOwed(l),
    monthlyInstallment: loanMonthlyInstallment(l),
    dueAt: loanDueDate(l),
    overdue: isLoanOverdue(l, repayments),
  })), [loans, repayments]);
  const activeLoans = loanRows.filter((l) => l.balance > 0).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const repaidLoans = loanRows.filter((l) => l.balance <= 0).sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));

  const totalOutstanding = useMemo(() => activeLoans.reduce((s, l) => s + l.balance, 0), [activeLoans]);
  const totalIssued = useMemo(() => loans.reduce((s, l) => s + num(l.principal), 0), [loans]);
  const overdueCount = activeLoans.filter((l) => l.overdue).length;
  const utilisation = useMemo(() => loanPoolUtilisation(contributions, loans, repayments, settings), [contributions, loans, repayments, settings]);

  const historyLoan = loanRows.find((l) => l.id === historyId);
  const historyRepayments = historyLoan ? repayments.filter((r) => r.loan_id === historyLoan.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];

  const openEditSettings = () => {
    setMultInput(String(num(settings?.loan_multiplier ?? 3)));
    setRateInput(String(num(settings?.loan_interest_rate) || 10));
    setTermInput(String(num(settings?.loan_term_months) || 6));
    setQualInput(String(num(settings?.loan_qualifying_months)));
    setMaxPerInput(settings?.loan_max_per_member ? String(num(settings.loan_max_per_member)) : '');
    setPoolPctInput(String(num(settings?.loan_max_pool_pct ?? 100)));
    setPenaltyPctInput(String(num(settings?.loan_late_penalty_pct)));
    setEditingSettings(true);
  };

  const saveSettings = async () => {
    const next = {
      ...settings,
      loan_multiplier: multInput.trim() === '' ? 3 : num(multInput),
      loan_interest_rate: num(rateInput) || 0,
      loan_term_months: num(termInput) || 1,
      loan_qualifying_months: Math.max(0, num(qualInput)),
      loan_max_per_member: maxPerInput.trim() ? Math.max(0, num(maxPerInput)) : null,
      loan_max_pool_pct: Math.min(100, Math.max(0, num(poolPctInput ?? 100))),
      loan_late_penalty_pct: Math.max(0, num(penaltyPctInput)),
    };
    setEditingSettings(false);
    setSettings(next);
    if (isDemo) { saveDemo(settingsKey, next); return; }
    const { error } = await createClient().from('fund_settings').upsert({ agency_id: agencyId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
    if (error) toast.error('Could not save', error.message);
  };

  const applyPenalty = async () => {
    if (!penaltyFor) return;
    const amount = loanLatePenaltyAmount(penaltyFor, repayments, settings);
    if (!amount) { setPenaltyFor(null); return; }
    setSaving(true);
    const nextPenalty = num(penaltyFor.penalty_amount) + amount;
    if (isDemo) {
      const next = loans.map((l) => l.id === penaltyFor.id ? { ...l, penalty_amount: nextPenalty } : l);
      setLoans(next); saveDemo(loansKey, next);
      setSaving(false); setPenaltyFor(null);
      toast.success('Penalty applied', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_loans').update({ penalty_amount: nextPenalty }).eq('id', penaltyFor.id);
    setSaving(false);
    if (error) { toast.error('Could not apply penalty', error.message); return; }
    setPenaltyFor(null);
    toast.success('Penalty applied', money(amount));
  };

  const openIssue = (row) => {
    setIssueFor(row);
    setIPrincipal(String(Math.max(0, Math.round(row.available))));
    setIRate(String(num(settings?.loan_interest_rate) || 10));
    setITerm(String(num(settings?.loan_term_months) || 6));
    setIDate(new Date().toISOString().slice(0, 10));
    setINote('');
  };

  const saveIssue = async () => {
    const principal = num(iPrincipal);
    if (!principal || !issueFor) return;
    setSaving(true);
    const row = {
      member_id: issueFor.id, principal, interest_rate: num(iRate) || 0, term_months: num(iTerm) || 1,
      note: iNote.trim() || null, issued_at: new Date(iDate).toISOString(), created_by: myId,
    };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...loans];
      setLoans(next); saveDemo(loansKey, next);
      setSaving(false); setIssueFor(null);
      toast.success('Loan issued', `${money(principal)} to ${issueFor.name}`);
      return;
    }
    const { error } = await createClient().from('fund_loans').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not issue loan', error.message); return; }
    setIssueFor(null);
    toast.success('Loan issued', `${money(principal)} to ${issueFor.name}`);
  };

  const openRepay = (loan) => { setRAmount(''); setRDate(new Date().toISOString().slice(0, 10)); setRepayFor(loan); };

  const saveRepay = async () => {
    const amount = num(rAmount);
    if (!amount || !repayFor) return;
    setSaving(true);
    const row = { loan_id: repayFor.id, amount, created_by: myId, created_at: new Date(rDate).toISOString() };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...repayments];
      setRepayments(next); saveDemo(repaymentsKey, next);
      setSaving(false); setRepayFor(null);
      toast.success('Repayment logged', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_loan_repayments').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not save', error.message); return; }
    setRepayFor(null);
    toast.success('Repayment logged', money(amount));
  };

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

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading loans…</div>;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
          <HandCoins size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Loans</div>
          <div style={{ fontSize: 12.5, color: tSub }}>Who can borrow, how much, and what they owe back</div>
        </div>
      </div>

      {/* Loan rules */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {editingSettings ? (
          <>
            <RuleField label="Limit ×savings" value={multInput} onChange={setMultInput} suffix="×" />
            <RuleField label="Flat interest" value={rateInput} onChange={setRateInput} suffix="%" />
            <RuleField label="Term" value={termInput} onChange={setTermInput} suffix="mo" />
            <RuleField label="Qualifying period" value={qualInput} onChange={setQualInput} suffix="mo as member" />
            <RuleField label="Max per member" value={maxPerInput} onChange={setMaxPerInput} suffix="KES, blank = no cap" />
            <RuleField label="Max pool share" value={poolPctInput} onChange={setPoolPctInput} suffix="% out on loan" />
            <RuleField label="Late penalty" value={penaltyPctInput} onChange={setPenaltyPctInput} suffix="% once overdue" />
            <button className="fund-btn" style={{ height: 32 }} onClick={saveSettings}><Check size={13} /></button>
            <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingSettings(false)}><X size={13} /></button>
          </>
        ) : (
          <>
            <RuleStat label="Limit" value={`${num(settings?.loan_multiplier ?? 3)}× savings`} />
            <RuleStat label="Interest" value={`${num(settings?.loan_interest_rate) || 10}% flat`} />
            <RuleStat label="Term" value={`${num(settings?.loan_term_months) || 6} months`} />
            <RuleStat label="Qualifying period" value={num(settings?.loan_qualifying_months) > 0 ? `${num(settings.loan_qualifying_months)} months as member` : 'None'} />
            <RuleStat label="Max per member" value={settings?.loan_max_per_member ? money(settings.loan_max_per_member) : 'No cap'} />
            <RuleStat label="Late penalty" value={num(settings?.loan_late_penalty_pct) > 0 ? `${num(settings.loan_late_penalty_pct)}% once overdue` : 'None'} />
            {canEdit && (
              <button className="fund-btn" style={{ height: 28, fontSize: 11, marginLeft: 'auto' }} onClick={openEditSettings}><Pencil size={11} /> Edit rules</button>
            )}
          </>
        )}
      </div>

      {/* Totals strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Outstanding</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={totalOutstanding} /></div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>{activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Issued all-time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={totalIssued} /></div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>{loans.length} loan{loans.length !== 1 ? 's' : ''} total</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Overdue</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: overdueCount > 0 ? '#EF4444' : tKey, fontVariantNumeric: 'tabular-nums' }}>{overdueCount}</div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>past their term, still owing</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Loan pool used</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: utilisation.atCap ? '#EF4444' : tKey, fontVariantNumeric: 'tabular-nums' }}>{utilisation.pct}%</div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>of {utilisation.maxPct}% cap on loan at once</div>
        </div>
      </div>

      {/* Eligibility */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: '#22C55E', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Eligible to borrow ({eligibleRows.length})</span>
          </div>
          {eligibleRows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>No one qualifies yet.</div>
          ) : eligibleRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'rgba(34,197,94,0.18)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: tSub }}>Up to {money(r.available)}</div>
              </div>
              {canEdit && (
                <button className="fund-btn" style={{ height: 30, fontSize: 11.5, flexShrink: 0 }} onClick={() => openIssue(r)}><Plus size={12} /> Issue</button>
              )}
            </div>
          ))}
        </div>

        <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: '#F5A623', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Not eligible ({ineligibleRows.length})</span>
          </div>
          {ineligibleRows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>Everyone qualifies right now.</div>
          ) : ineligibleRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'rgba(245,166,35,0.18)', color: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: '#F5A623', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reasons[0]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active loans */}
      <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: '#5B9BFF', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Active loans ({activeLoans.length})</span>
        </div>
        {activeLoans.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>Nothing out on loan right now.</div>
        ) : activeLoans.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,155,255,0.18)', color: '#5B9BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
              {nameOf(l.member_id).charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(l.member_id)}</div>
              <div style={{ fontSize: 10.5, color: l.overdue ? '#EF4444' : tSub, display: 'flex', alignItems: 'center', gap: 3 }}>
                {l.overdue && <AlertTriangle size={10} />}
                {l.overdue ? 'Overdue — ' : 'Due '}{fmtDate(l.dueAt)} · {money(l.monthlyInstallment)}/mo
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(l.balance)}</div>
            <button
              onClick={() => setHistoryId(l.id)}
              title="View repayment history"
              style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Eye size={14} />
            </button>
            {canEdit && loanLatePenaltyAmount(l, repayments, settings) > 0 && (
              <button
                onClick={() => setPenaltyFor(l)}
                title="Apply a late penalty"
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.16)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <AlertTriangle size={13} />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => openRepay(l)}
                title="Log a repayment"
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(91,155,255,0.18)', color: '#5B9BFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Repaid loans */}
      {repaidLoans.length > 0 && (
        <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: '#22C55E', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Repaid ({repaidLoans.length})</span>
          </div>
          {repaidLoans.map((l) => (
            <div key={l.id} onClick={() => setHistoryId(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'rgba(34,197,94,0.18)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {nameOf(l.member_id).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(l.member_id)}</div>
                <div style={{ fontSize: 10.5, color: tSub }}>Issued {fmtDate(l.issued_at)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={12} /> {money(l.totalOwed)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Issue a loan */}
      <Modal isOpen={!!issueFor} onClose={() => setIssueFor(null)} title={`Issue a loan — ${issueFor?.name || ''}`} maxWidth="420px">
        {issueFor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: tSub }}>Eligible for up to <strong style={{ color: tKey }}>{money(issueFor.available)}</strong> ({money(issueFor.savings)} in savings × {num(settings?.loan_multiplier ?? 3)}).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'block' }}>
                <span className="fund-label">Principal (KES)</span>
                <input className="fund-input" type="number" inputMode="decimal" autoFocus value={iPrincipal} onChange={(e) => setIPrincipal(e.target.value)} />
              </label>
              <label style={{ display: 'block' }}>
                <span className="fund-label">Date</span>
                <input className="fund-input" type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} />
              </label>
            </div>
            {num(iPrincipal) > issueFor.available && (
              <div style={{ fontSize: 11.5, color: '#F5A623' }}>This is above their {money(issueFor.available)} limit — fine if that&rsquo;s a deliberate call.</div>
            )}
            {utilisation.poolSize > 0 && (utilisation.outstanding + num(iPrincipal)) / utilisation.poolSize * 100 > utilisation.maxPct && (
              <div style={{ fontSize: 11.5, color: '#F5A623' }}>This would push the loan pool past its {utilisation.maxPct}% cap — fine if that&rsquo;s a deliberate call.</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'block' }}>
                <span className="fund-label">Interest (flat %)</span>
                <input className="fund-input" type="number" value={iRate} onChange={(e) => setIRate(e.target.value)} />
              </label>
              <label style={{ display: 'block' }}>
                <span className="fund-label">Term (months)</span>
                <input className="fund-input" type="number" value={iTerm} onChange={(e) => setITerm(e.target.value)} />
              </label>
            </div>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Note (optional)</span>
              <input className="fund-input" value={iNote} onChange={(e) => setINote(e.target.value)} placeholder="What it's for" />
            </label>
            {num(iPrincipal) > 0 && (
              <div style={{ ...innerCard, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 11.5, color: tSub }}>Repays as {money(loanTotalRepayable({ principal: iPrincipal, interest_rate: iRate }))} total</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: tKey }}>{money(loanMonthlyInstallment({ principal: iPrincipal, interest_rate: iRate, term_months: iTerm }))}/mo</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button className="fund-btn" onClick={() => setIssueFor(null)}>Cancel</button>
              <button className="fund-btn primary" onClick={saveIssue} disabled={saving || !num(iPrincipal)}>{saving ? 'Saving…' : 'Issue loan'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log a repayment */}
      <Modal isOpen={!!repayFor} onClose={() => setRepayFor(null)} title={`Log a repayment — ${repayFor ? nameOf(repayFor.member_id) : ''}`} maxWidth="340px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {repayFor && (
            <div style={{ fontSize: 11.5, color: tSub }}>{money(loanBalance(repayFor, repayments))} still owed.</div>
          )}
          <label style={{ display: 'block' }}>
            <span className="fund-label">Amount (KES)</span>
            <input className="fund-input" type="number" inputMode="decimal" autoFocus value={rAmount} onChange={(e) => setRAmount(e.target.value)} />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Date</span>
            <input className="fund-input" type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setRepayFor(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveRepay} disabled={saving || !num(rAmount)}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Apply a late penalty — a flat % of what's currently owed, member
          handbook §9. Locked in once applied, never recalculated. */}
      <Modal isOpen={!!penaltyFor} onClose={() => setPenaltyFor(null)} title={`Apply a late penalty — ${penaltyFor ? nameOf(penaltyFor.member_id) : ''}`} maxWidth="360px">
        {penaltyFor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12.5, color: tKey, lineHeight: 1.5 }}>
              This loan is overdue. Apply the chama&rsquo;s {num(settings?.loan_late_penalty_pct)}% late penalty —{' '}
              <strong>{money(loanLatePenaltyAmount(penaltyFor, repayments, settings))}</strong>, added to the {money(loanBalance(penaltyFor, repayments))} currently owed.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button className="fund-btn" onClick={() => setPenaltyFor(null)}>Cancel</button>
              <button className="fund-btn primary" onClick={applyPenalty} disabled={saving}>{saving ? 'Applying…' : 'Apply penalty'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Loan history */}
      <Modal isOpen={!!historyId} onClose={() => setHistoryId(null)} title={historyLoan ? `${nameOf(historyLoan.member_id)}'s loan` : 'Loan'} maxWidth="440px">
        {historyLoan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={innerCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: tSub }}>Principal</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>{money(historyLoan.principal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: tSub }}>Total repayable ({historyLoan.interest_rate}% flat, {historyLoan.term_months}mo)</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>{money(historyLoan.totalRepayable)}</span>
              </div>
              {num(historyLoan.penalty_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#EF4444' }}>Late penalty applied</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#EF4444' }}>{money(historyLoan.penalty_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: tSub }}>Due</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: historyLoan.overdue ? '#EF4444' : tKey }}>{fmtDate(historyLoan.dueAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: tSub }}>Balance</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: historyLoan.balance > 0 ? tKey : '#22C55E' }}>{historyLoan.balance > 0 ? money(historyLoan.balance) : 'Fully repaid'}</span>
              </div>
            </div>
            {historyLoan.note && <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>{historyLoan.note}</div>}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Repayments</div>
              {historyRepayments.length === 0 ? (
                <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>None logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                  {historyRepayments.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: 12, color: tSub }}>{fmtDate(r.created_at)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums' }}>+{money(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <style jsx global>{`
        .fund-label { display: block; font-size: 10.5px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
        .fund-input {
          width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px; border-radius: 10px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
        }
        .fund-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .fund-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: .12s;
        }
        .fund-btn:hover { border-color: var(--color-border-active); }
        .fund-btn.primary { background: linear-gradient(135deg,#15803D,#22C55E); border: none; color: #fff; }
        .fund-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function RuleStat({ label, value }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: tKey }}>{value}</div>
    </div>
  );
}

function RuleField({ label, value, onChange, suffix }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="fund-label" style={{ marginBottom: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input className="fund-input" style={{ width: 70, height: 32 }} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{suffix}</span>
      </div>
    </label>
  );
}
