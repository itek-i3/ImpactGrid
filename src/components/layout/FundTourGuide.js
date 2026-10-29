'use client';

import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { isImpactFundAgency, isFundPlainMember } from '@/lib/fund/shared';

// Walks a new manager or member through the ImpactFund sidebar, one tab at
// a time, explaining what lives where — by actually navigating to each
// view (not just pointing at a sidebar icon), so what the card says and
// what's on screen behind it always match. Two separate scripts, since a
// plain member sees four tabs and a manager sees nine.
const MANAGER_STEPS = [
  { view: 'fundDashboard', title: 'Dashboard', body: 'The fund at a glance — total raised, how many projects and members, and who’s topping the leaderboard.' },
  { view: 'fundAccounts', title: 'Accounts', body: 'The four ledgers money lives in — Reserve, Loans & Operations, Fund Account, and each project’s own account. Money for one purpose never crosses into another.' },
  { view: 'fundMembers', title: 'Members', body: 'Add members, track who’s paid their membership fee in full, and see everyone’s running total.' },
  { view: 'fundInvestors', title: 'Investors', body: 'People putting money in expecting a return. Add them, log what they send, and optionally link them to the matching record in ACR’s own investor pipeline.' },
  { view: 'fundDonors', title: 'Donors', body: 'People giving outright, no return expected — tracked the same way as investors, kept on their own page.' },
  { view: 'fundProfile', title: 'Profile', body: 'Look up any one member’s full dossier — fee status, instalments, loans — all in one place.' },
  { view: 'fundProjects', title: 'Projects', body: 'What the fund is raising for. Set a monthly baseline per project, track member goals, and log who’s backing what.' },
  { view: 'fundInstallments', title: 'Installments', body: 'The chama’s monthly contribution and every project’s baseline due, member by member — log payments and set the rules here.' },
  { view: 'fundLoans', title: 'Loans', body: 'Who’s eligible to borrow and how much, issue loans, log repayments, and set the lending rules — multiplier, qualifying period, caps, late penalties.' },
];

const MEMBER_STEPS = [
  { view: 'fundProjects', title: 'Projects', body: 'Every project the fund is backing, what you’ve put toward each, and a badge on the ones you’re personally in.' },
  { view: 'fundMyProfile', title: 'My Profile', body: 'Your own dashboard — total contributed, membership and instalment status, your credit score, and whether you’re eligible for a loan.' },
  { view: 'fundMyInstallments', title: 'My Instalments', body: 'Your full payment history — the chama’s monthly contribution and every project baseline you owe.' },
  { view: 'fundMyLoans', title: 'Loans', body: 'How much you could borrow, your credit score explained, and every loan you’ve ever had.' },
];

export default function FundTourGuide() {
  const { agencies, activeAgencyId, isDemo, currentView, setCurrentView, sidebarOpen, setSidebarOpen } = useWorkspaceStore();
  const isFund = isImpactFundAgency(agencies, activeAgencyId);
  const isMember = isFundPlainMember(agencies, activeAgencyId, isDemo);
  const steps = isMember ? MEMBER_STEPS : MANAGER_STEPS;
  const storageKey = `fund-tour-seen-${activeAgencyId || 'x'}-${isMember ? 'member' : 'manager'}`;

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [resume, setResume] = useState(null); // { view, sidebarOpen } to restore on skip

  const start = useCallback(() => {
    setResume({ view: currentView, sidebarOpen });
    setSidebarOpen(true);
    setStepIndex(0);
    setCurrentView(steps[0].view);
    setActive(true);
  }, [currentView, sidebarOpen, setSidebarOpen, setCurrentView, steps]);

  // Auto-start once per agency+role, the first time someone lands here —
  // never re-fires once they've seen it (or skipped it) on this browser.
  useEffect(() => {
    if (!isFund || !activeAgencyId) return;
    let seen = true;
    try { seen = !!localStorage.getItem(storageKey); } catch (_) { /* no-op */ }
    if (seen) return;
    const t = setTimeout(() => start(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFund, activeAgencyId, storageKey]);

  const markSeen = () => { try { localStorage.setItem(storageKey, '1'); } catch (_) { /* no-op */ } };

  const skip = () => {
    setActive(false);
    markSeen();
    if (resume) { setCurrentView(resume.view); setSidebarOpen(resume.sidebarOpen); }
  };

  const next = () => {
    const n = stepIndex + 1;
    if (n >= steps.length) { setActive(false); markSeen(); return; }
    setStepIndex(n);
    setCurrentView(steps[n].view);
  };

  const back = () => {
    const p = Math.max(0, stepIndex - 1);
    setStepIndex(p);
    setCurrentView(steps[p].view);
  };

  if (!isFund) return null;

  const step = steps[stepIndex];
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';

  return (
    <>
      {/* Re-open the tour any time */}
      {!active && (
        <button
          onClick={start}
          title="Take a tour of ImpactFund"
          style={{
            position: 'fixed', bottom: 28, left: 28, zIndex: 998,
            width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(91,155,255,0.3)',
            background: 'linear-gradient(145deg, rgba(30,79,184,0.9), rgba(10,20,40,0.9))',
            color: '#7EB3FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          }}
        >
          <HelpCircle size={20} />
        </button>
      )}

      {active && (
        <>
          <div
            onClick={skip}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,9,18,0.55)', zIndex: 998, backdropFilter: 'blur(1px)' }}
          />
          <div
            style={{
              position: 'fixed', zIndex: 999, left: '50%', bottom: 28, transform: 'translateX(-50%)',
              width: 'min(380px, calc(100vw - 32px))',
              background: 'linear-gradient(160deg, rgba(20,40,80,0.98), rgba(5,12,24,0.98))',
              border: '1px solid rgba(91,155,255,0.25)', borderRadius: 18, padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(48,108,236,0.18)', color: '#7EB3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={13} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
              <button
                onClick={skip}
                title="Close tour"
                style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>

            <div style={{ fontSize: 15, fontWeight: 800, color: tKey, marginBottom: 6, letterSpacing: '-.01em' }}>{step.title}</div>
            <div style={{ fontSize: 12.5, color: tSub, lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
              {steps.map((_, i) => (
                <div key={i} style={{ height: 4, flex: 1, borderRadius: 99, background: i <= stepIndex ? '#5B9BFF' : 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button
                onClick={skip}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tSub, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
              >
                Skip tour
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {stepIndex > 0 && (
                  <button
                    onClick={back}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: tKey, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button
                  onClick={next}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {stepIndex === steps.length - 1 ? 'Done' : 'Next'} {stepIndex < steps.length - 1 && <ChevronRight size={13} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
