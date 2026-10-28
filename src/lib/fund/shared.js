// Shared constants + formatters for the ImpactFund agency module — one
// source of truth for category labels and totals so the four panels
// (Dashboard/Members/Investors/Projects) read as one system instead of four.
//
// Everything is read from fund_contributions, one append-only table: a
// member's total is SUM(amount) filtered to their id, a contributor's total
// is the same filtered to theirs, a project's "raised" is the same filtered
// to its id. Nothing is ever a separately-stored balance.

export const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
export const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
export const canEditFund = (userProfile, isDemo) => isDemo || ['manager', 'superadmin'].includes(userProfile?.role);
// Deleting a project is one step more destructive than everything else a
// manager can do to it (edit, change status, log contributions) — every
// backer's contribution loses its project tag, every goal set for it is
// gone — so it's superadmin-only, not manager-or-superadmin like the rest.
export const canDeleteFundProject = (userProfile, isDemo) => isDemo || userProfile?.role === 'superadmin';

// Whether the active agency *is* the ImpactFund module. Reads the
// explicit agencies.kind column first — set when an agency is created
// via the admin panel — and only falls back to matching the display name
// for an agency made before that column existed and never re-tagged.
// Renaming an explicitly-kinded agency can never silently break this.
// This one function is the single place that match lives: both the
// Sidebar's nav-hiding and the router's own render-gating call it, so the
// two can never drift apart and quietly disagree about who's a plain member.
export const isImpactFundAgency = (agencies, activeAgencyId) => {
  const agency = agencies?.find((a) => a.id === activeAgencyId);
  if (!agency) return false;
  if (agency.kind) return agency.kind === 'impactfund';
  return !!agency.name?.toLowerCase().replace(/\s+/g, '').includes('impactfund');
};

// A plain member (not manager/superadmin, and not the demo walkthrough)
// only gets Projects and their own My Profile/My Instalments/My Loans
// pages — these manager-only views must never render for them, however
// `currentView` got set (a stale restored location, a persisted link,
// a future bug), not just stay hidden from the sidebar's own buttons.
export const FUND_MANAGER_ONLY_VIEWS = ['fundDashboard', 'fundAccounts', 'fundMembers', 'fundInvestors', 'fundDonors', 'fundInstallments', 'fundLoans', 'fundProfile'];

export const isFundPlainMember = (agencies, activeAgencyId, userProfile, isDemo) =>
  isImpactFundAgency(agencies, activeAgencyId) && !isDemo && userProfile?.role === 'member';

export const CONTRIBUTION_CATEGORIES = [
  { key: 'membership', label: 'Membership fee' },
  { key: 'monthly', label: 'Monthly contribution' },
  { key: 'project_baseline', label: 'Project baseline' },
  { key: 'project', label: 'Extra project contribution' },
  { key: 'investment', label: 'Investment' },
  { key: 'donation', label: 'Donation' },
  { key: 'general', label: 'General contribution' },
];
export const CATEGORY_LABEL = Object.fromEntries(CONTRIBUTION_CATEGORIES.map((c) => [c.key, c.label]));

export const CONTRIBUTOR_TYPES = [
  { key: 'investor', label: 'Investor', tint: '#9333EA', blurb: 'Puts money in expecting a return', category: 'investment' },
  { key: 'donor', label: 'Donor', tint: '#EC4899', blurb: 'Gives outright, no return expected', category: 'donation' },
];
export const CONTRIBUTOR_TYPE_BY_KEY = Object.fromEntries(CONTRIBUTOR_TYPES.map((c) => [c.key, c]));

export const PROJECT_STATUSES = [
  { key: 'active', label: 'Active', tint: '#5B9BFF' },
  { key: 'completed', label: 'Completed', tint: '#22C55E' },
];
export const PROJECT_STATUS_BY_KEY = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.key, s]));

export const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Demo-mode storage — a localStorage-backed array, read/written by every
// fund panel the same way.
export function loadDemo(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
}
export function saveDemo(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// ── Totals, all derived from a flat list of fund_contributions rows ────────

export const totalOf = (contributions) => (contributions || []).reduce((s, c) => s + num(c.amount), 0);

export const byMember = (contributions, memberId) => (contributions || [])
  .filter((c) => c.member_id === memberId)
  .reduce((s, c) => s + num(c.amount), 0);

export const byContributor = (contributions, contributorId) => (contributions || [])
  .filter((c) => c.contributor_id === contributorId)
  .reduce((s, c) => s + num(c.amount), 0);

export const byProject = (contributions, projectId) => (contributions || [])
  .filter((c) => c.project_id === projectId)
  .reduce((s, c) => s + num(c.amount), 0);

// Matches a logged-in account to its fund_members record — contact is
// freeform (an M-Pesa number more often than an email) so it's never used
// for this; login_email is a separate field a manager sets explicitly.
export const memberByLoginEmail = (members, email) => {
  const needle = (email || '').trim().toLowerCase();
  if (!needle) return null;
  return (members || []).find((m) => (m.login_email || '').trim().toLowerCase() === needle) || null;
};

// A person is a Member once their membership-fee payments reach the
// required amount — computed from the ledger, never stored, so a status
// flag can never drift from the money that actually moved. No fee
// configured (0 or unset) means everyone who's been added counts as a
// member already.
export const membershipPaid = (contributions, memberId) => (contributions || [])
  .filter((c) => c.member_id === memberId && c.category === 'membership')
  .reduce((s, c) => s + num(c.amount), 0);

export const isPaidMember = (contributions, memberId, membershipFee) => {
  const required = num(membershipFee);
  return !required || membershipPaid(contributions, memberId) >= required;
};

// Members vs. investors vs. donors, read straight off whichever id column
// is set — no join needed to tell them apart. `other` catches a deleted
// member's old contributions (member_id set null on delete, but the
// money and its category stay in the ledger) — without it those
// shillings would still count in totalOf() but vanish from this
// breakdown, so the two numbers would quietly stop matching.
export const raisedByType = (contributions) => {
  const members = (contributions || []).filter((c) => c.member_id).reduce((s, c) => s + num(c.amount), 0);
  const investors = (contributions || []).filter((c) => c.category === 'investment').reduce((s, c) => s + num(c.amount), 0);
  const donors = (contributions || []).filter((c) => c.category === 'donation').reduce((s, c) => s + num(c.amount), 0);
  const other = (contributions || []).filter((c) => !c.member_id && !c.contributor_id).reduce((s, c) => s + num(c.amount), 0);
  return { members, investors, donors, other };
};

// Ranks everyone who has put money in — members and contributors are both
// just {id, name} records now, so both sides look the same — for the "top
// contributors" leaderboard.
export const topContributors = (contributions, members, contributors, limit = 5) => {
  const totals = new Map();
  (contributions || []).forEach((c) => {
    const amt = num(c.amount);
    if (amt <= 0) return;
    if (c.member_id) {
      const key = `m:${c.member_id}`;
      const prev = totals.get(key) || { name: (members || []).find((m) => m.id === c.member_id)?.name || 'A member', type: 'member', total: 0 };
      prev.total += amt; totals.set(key, prev);
    } else if (c.contributor_id) {
      const key = `c:${c.contributor_id}`;
      const found = (contributors || []).find((x) => x.id === c.contributor_id);
      const prev = totals.get(key) || { name: found?.name || 'A contributor', type: found?.type || 'investor', total: 0 };
      prev.total += amt; totals.set(key, prev);
    }
  });
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
};

// A member's contribution history grouped into a simple "paid this month"
// shape, for a lightweight streak on the Members tab.
export const monthKeyOf = (iso) => (iso || '').slice(0, 7); // 'YYYY-MM'

// Whether the chama's monthly instalment is met for the current month —
// same convention as isPaidMember/projectBaselinePaidThisMonth: nothing
// required (no amount configured yet) counts as satisfied, never as
// "not paid", so every member doesn't show up delinquent on a due that
// doesn't actually exist yet.
export const monthlyPaidThisMonth = (thisMonthTotal, expectedAmount) => !num(expectedAmount) || num(thisMonthTotal) >= num(expectedAmount);

// ── Project pledges — a goal per member, separate from money actually moved ─
// A pledge is a target a manager sets when adding (or editing) a project:
// "Wanjiku is expected to put in 50,000 for this". Progress against it still
// reads off fund_contributions filtered to that project_id + member_id, so
// a pledge can never silently count as money received.
export const byProjectMember = (contributions, projectId, memberId) => (contributions || [])
  .filter((c) => c.project_id === projectId && c.member_id === memberId)
  .reduce((s, c) => s + num(c.amount), 0);

export const projectPledgeOf = (pledges, projectId, memberId) =>
  num((pledges || []).find((p) => p.project_id === projectId && p.member_id === memberId)?.amount);

// Every member with either a goal or an actual contribution on this
// project, ranked biggest goal first — what the project's detail view lists.
export const projectMemberRows = (members, contributions, pledges, projectId) => (members || [])
  .map((m) => ({ member: m, pledged: projectPledgeOf(pledges, projectId, m.id), contributed: byProjectMember(contributions, projectId, m.id) }))
  .filter((r) => r.pledged > 0 || r.contributed > 0)
  .sort((a, b) => b.pledged - a.pledged || b.contributed - a.contributed);

// ── Loans — sized off savings actually banked, not money already spent ─────
// Loan eligibility reads off the same fund_contributions ledger, but only the
// "membership" and "monthly" categories count as savings held by the fund —
// a project contribution already went out the door to back that project, so
// it isn't money sitting there to lend against.
export const memberSavings = (contributions, memberId) => (contributions || [])
  .filter((c) => c.member_id === memberId && (c.category === 'membership' || c.category === 'monthly'))
  .reduce((s, c) => s + num(c.amount), 0);

// Interest is a single flat % charged for the whole term (how Kenyan chamas
// usually quote a loan), not compounded monthly — so the total owed is fixed
// the day the loan is issued and never recalculated.
export const loanTotalRepayable = (loan) => num(loan?.principal) * (1 + num(loan?.interest_rate) / 100);
export const loanMonthlyInstallment = (loan) => loanTotalRepayable(loan) / (num(loan?.term_months) || 1);

// What's actually owed right now — the contractual principal+interest,
// plus any late penalty a manager has applied. loanTotalRepayable stays
// the contract figure alone, since that's what the Issue modal previews
// before any penalty can exist.
export const loanTotalOwed = (loan) => loanTotalRepayable(loan) + num(loan?.penalty_amount);

export const loanRepaidAmount = (repayments, loanId) => (repayments || [])
  .filter((r) => r.loan_id === loanId)
  .reduce((s, r) => s + num(r.amount), 0);

// Never a stored balance, same philosophy as the contribution totals above —
// always totalOwed minus whatever fund_loan_repayments adds up to.
export const loanBalance = (loan, repayments) => Math.max(0, loanTotalOwed(loan) - loanRepaidAmount(repayments, loan.id));

export const loanDueDate = (loan) => {
  const d = new Date(loan.issued_at);
  d.setMonth(d.getMonth() + (num(loan.term_months) || 0));
  return d.toISOString();
};

export const isLoanOverdue = (loan, repayments) => loanBalance(loan, repayments) > 0 && new Date(loanDueDate(loan)).getTime() < Date.now();

// What a member could borrow and why — or why not. Settings carries the
// chama's own rules: how many multiples of savings it'll lend (and an
// optional hard cap on top of that), the flat rate/term it charges by
// default, and how long someone has to have been a member before they can
// borrow at all — member handbook §9. `?? 3` rather than `|| 3`: an
// explicit 0 (a manager deliberately freezing new lending) is a real
// setting, not a missing one, and must not be silently replaced.
export const loanEligibility = (member, contributions, loans, repayments, settings) => {
  const savings = memberSavings(contributions, member.id);
  const paidMember = isPaidMember(contributions, member.id, settings?.membership_fee);
  const outstanding = (loans || [])
    .filter((l) => l.member_id === member.id)
    .reduce((s, l) => s + loanBalance(l, repayments), 0);
  const multiplier = num(settings?.loan_multiplier ?? 3);
  const savingsLimit = savings * multiplier;
  const maxPerMember = num(settings?.loan_max_per_member);
  const limit = Math.round(maxPerMember > 0 ? Math.min(savingsLimit, maxPerMember) : savingsLimit);

  const qualifyingMonths = num(settings?.loan_qualifying_months);
  const monthsAsMember = member.created_at ? Math.max(0, (Date.now() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
  const qualified = qualifyingMonths <= 0 || monthsAsMember >= qualifyingMonths;

  const reasons = [];
  if (!paidMember) reasons.push('Hasn’t finished paying the membership fee');
  if (!qualified) reasons.push(`Hasn’t been a member long enough yet — needs ${qualifyingMonths} month${qualifyingMonths !== 1 ? 's' : ''}, has ${Math.floor(monthsAsMember)}`);
  if (outstanding > 0) reasons.push('Has an unpaid loan outstanding');
  if (savings <= 0) reasons.push('No savings on record yet');

  return { eligible: reasons.length === 0, reasons, savings, limit, outstanding, available: Math.max(0, limit - outstanding) };
};

// Member handbook §9 — "members set... a maximum share of the account
// that can be out on loan at any time, so there is always money for
// operations." Measured against the pool's all-time size (every shilling
// that's ever flowed into Loans & Operations, via monthly contributions or
// repayments), not its current already-net-of-loans balance, so lending it
// all out doesn't shrink the denominator and make the cap easier to hit.
export const loanPoolUtilisation = (contributions, loans, repayments, settings) => {
  const poolSize = (contributions || []).filter((c) => c.category === 'monthly').reduce((s, c) => s + num(c.amount), 0)
    + (repayments || []).reduce((s, r) => s + num(r.amount), 0);
  const outstanding = (loans || []).reduce((s, l) => s + loanBalance(l, repayments), 0);
  const maxPct = Math.min(100, Math.max(0, num(settings?.loan_max_pool_pct ?? 100)));
  const pct = poolSize > 0 ? Math.round((outstanding / poolSize) * 100) : 0;
  return { poolSize, outstanding, maxPct, pct, atCap: poolSize > 0 && outstanding / poolSize >= maxPct / 100 };
};

// The one-off late charge a manager can apply to an overdue loan — a flat
// % of what's currently owed, same "flat, not compounding" philosophy as
// the loan's own interest. Returns 0 (nothing to apply) once the chama
// hasn't set a penalty rate, or the loan isn't actually overdue.
export const loanLatePenaltyAmount = (loan, repayments, settings) => {
  const pct = num(settings?.loan_late_penalty_pct);
  if (pct <= 0 || !isLoanOverdue(loan, repayments)) return 0;
  return Math.round(loanBalance(loan, repayments) * (pct / 100));
};

// ── Credit score — a transparent score derived from the same ledgers used
// for loan eligibility above: how long they've stood as a member, how
// consistently they've met their monthly instalment, and how their past
// loans went. Nothing here is stored either, so it can never drift from
// what actually happened. Scaled 300–850, the range most members already
// recognise from a bank/credit-bureau score.
export const CREDIT_SCORE_BANDS = [
  { min: 750, label: 'Excellent', tint: '#22C55E' },
  { min: 670, label: 'Good', tint: '#5B9BFF' },
  { min: 580, label: 'Fair', tint: '#F5A623' },
  { min: 0, label: 'Needs work', tint: '#EF4444' },
];
export const creditScoreBand = (score) => CREDIT_SCORE_BANDS.find((b) => score >= b.min);

export const creditScoreOf = (member, contributions, loans, repayments, settings, projects) => {
  if (!member) return null;
  const factors = [];

  // Tenure (0–150) — longer standing means more history to trust; caps at
  // 30 months so it doesn't climb forever, but a brand-new member isn't
  // scored as "bad", just unproven.
  const joinedAt = member.created_at ? new Date(member.created_at).getTime() : null;
  const monthsTenure = joinedAt ? Math.max(0, (Date.now() - joinedAt) / (1000 * 60 * 60 * 24 * 30)) : 0;
  const tenurePts = Math.round(Math.min(150, monthsTenure * 5));
  factors.push({
    key: 'tenure', label: 'Membership tenure', points: tenurePts, max: 150,
    detail: joinedAt ? `Member for ${Math.round(monthsTenure)} month${Math.round(monthsTenure) !== 1 ? 's' : ''}` : 'Just joined',
  });

  // Instalment consistency (0–250) — averaged across every monthly due this
  // member carries: the chama's own instalment, plus each project's
  // baseline once it has one (missing a project baseline counts exactly
  // the way missing the chama monthly does). For each due, it's months
  // actually met vs. months expected since the due started; a due under a
  // month old with nothing paid yet is unproven, not delinquent, and is
  // left out rather than scored 0.
  const dueRatio = (list, expected, sinceAt) => {
    const monthsSince = sinceAt ? Math.max(0, (Date.now() - new Date(sinceAt).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
    if (list.length === 0) return monthsSince < 1 ? null : 0;
    const firstAt = list.reduce((min, c) => Math.min(min, new Date(c.created_at).getTime()), Infinity);
    const monthsExpected = Math.max(1, Math.round((Date.now() - firstAt) / (1000 * 60 * 60 * 24 * 30)) + 1);
    const paidMonths = new Set(list.filter((c) => !expected || num(c.amount) >= expected).map((c) => monthKeyOf(c.created_at))).size;
    return Math.min(1, paidMonths / monthsExpected);
  };
  const monthly = (contributions || []).filter((c) => c.member_id === member.id && c.category === 'monthly');
  const dues = [{ list: monthly, expected: num(settings?.monthly_contribution_amount), sinceAt: member.created_at }];
  (projects || []).filter((p) => num(p.baseline_monthly_amount) > 0).forEach((p) => {
    const list = (contributions || []).filter((c) => c.member_id === member.id && c.project_id === p.id && c.category === 'project_baseline');
    dues.push({ list, expected: num(p.baseline_monthly_amount), sinceAt: p.created_at });
  });
  const ratios = dues.map((d) => dueRatio(d.list, d.expected, d.sinceAt)).filter((r) => r != null);
  let instalmentPts, instalmentDetail;
  if (ratios.length === 0) {
    instalmentPts = Math.round(250 * 0.6);
    instalmentDetail = 'No instalments due yet';
  } else {
    const ratio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    instalmentPts = Math.round(250 * ratio);
    instalmentDetail = dues.length > 1
      ? `${Math.round(ratio * 100)}% of monthly dues met — the chama plus ${dues.length - 1} project${dues.length - 1 !== 1 ? 's' : ''}`
      : `${Math.round(ratio * 100)}% of chama instalments met in full`;
  }
  factors.push({ key: 'instalments', label: 'Instalment consistency', points: instalmentPts, max: 250, detail: instalmentDetail });

  // Loan track record (-150 to +150) — no history is neutral; a loan repaid
  // by its due date earns the most, one currently overdue costs the most.
  const memberLoans = (loans || []).filter((l) => l.member_id === member.id);
  let loanPts, loanDetail;
  if (memberLoans.length === 0) {
    loanPts = 100;
    loanDetail = 'No loan history yet';
  } else {
    const scored = memberLoans.map((l) => {
      const balance = loanBalance(l, repayments);
      if (balance > 0) return isLoanOverdue(l, repayments) ? -150 : 40;
      const lastPaidAt = (repayments || []).filter((r) => r.loan_id === l.id).reduce((max, r) => Math.max(max, new Date(r.created_at).getTime()), 0);
      const onTime = !lastPaidAt || lastPaidAt <= new Date(loanDueDate(l)).getTime();
      return onTime ? 150 : 60;
    });
    loanPts = Math.round(scored.reduce((s, v) => s + v, 0) / scored.length);
    const overdueCount = memberLoans.filter((l) => isLoanOverdue(l, repayments)).length;
    loanDetail = overdueCount > 0
      ? `${overdueCount} loan${overdueCount !== 1 ? 's' : ''} overdue right now`
      : `${memberLoans.length} loan${memberLoans.length !== 1 ? 's' : ''} on record, in good standing`;
  }
  factors.push({ key: 'loans', label: 'Loan repayment track record', points: loanPts, max: 150, detail: loanDetail });

  const score = Math.max(300, Math.min(850, Math.round(300 + factors.reduce((s, f) => s + f.points, 0))));
  return { score, band: creditScoreBand(score), factors };
};

// ── The four accounts — member handbook, §5 ─────────────────────────────────
// The fund keeps its money in four separate ledgers so money meant for one
// purpose is never used for another. Every balance below is still derived
// straight from fund_contributions / fund_loans / fund_loan_repayments —
// nothing here is a stored number either.
//
//   Reserve             membership contributions only, minus one-off setup costs — emergencies only, never a project
//   Loans & Operations   the full monthly contribution, plus loan repayments, minus loans issued — see the loan-capital/ops-reserve split below
//   Fund Account         unearmarked investor/donor money only — the monthly contribution no longer feeds this account
//   Project Account       (one per project) — that project's baseline + extra contributions; see byProject()

export const reserveBalance = (contributions, settings) => {
  const paid = (contributions || []).filter((c) => c.category === 'membership').reduce((s, c) => s + num(c.amount), 0);
  return Math.max(0, paid - num(settings?.setup_costs));
};

// Advisory only — nothing elsewhere enforces this split, it's just how
// much of the Loans & Operations pool a manager wants to flag as "held for
// running costs" vs. "actually available to lend". Defaults to 0 (nothing
// held back) until a manager sets it.
const opsReservePct = (settings) => Math.min(100, Math.max(0, num(settings?.loans_ops_reserve_pct ?? 0))) / 100;

export const loansOpsBalance = (contributions, loans, repayments, settings) => {
  const fromMonthly = (contributions || []).filter((c) => c.category === 'monthly').reduce((s, c) => s + num(c.amount), 0);
  const repaid = (repayments || []).reduce((s, r) => s + num(r.amount), 0);
  const issued = (loans || []).reduce((s, l) => s + num(l.principal), 0);
  return fromMonthly + repaid - issued;
};

// A slice of each month's instalment, set aside for running costs — never
// touched by loan issuance or repayment.
export const opsReserveBalance = (contributions, settings) => {
  const fromMonthly = (contributions || []).filter((c) => c.category === 'monthly').reduce((s, c) => s + num(c.amount), 0);
  return fromMonthly * opsReservePct(settings);
};

// What's actually available to lend out — the rest of each month's
// instalment, plus loan repayments, minus loans issued.
export const loanCapitalBalance = (contributions, loans, repayments, settings) => {
  const fromMonthly = (contributions || []).filter((c) => c.category === 'monthly').reduce((s, c) => s + num(c.amount), 0);
  const repaid = (repayments || []).reduce((s, r) => s + num(r.amount), 0);
  const issued = (loans || []).reduce((s, l) => s + num(l.principal), 0);
  return fromMonthly * (1 - opsReservePct(settings)) + repaid - issued;
};

// Unearmarked investor/donor money only — the chama's own monthly
// contribution funds Loans & Operations in full and never lands here.
// Project/baseline contributions are excluded by category, not just by
// project_id: if their project is later deleted, project_id goes null but
// the category doesn't, so they still can't leak in here. Investor/donor
// money still needs the project_id check too, since that money is either
// earmarked to a project or not — category alone doesn't tell you which.
export const fundAccountBalance = (contributions) => (contributions || [])
  .filter((c) => !c.project_id && !['membership', 'monthly', 'project', 'project_baseline'].includes(c.category))
  .reduce((s, c) => s + num(c.amount), 0);

// ── Project baselines — a required monthly due, set per project, owed by
// every member once a project has one (same model as the chama's own
// monthly instalment, just scoped to one project). Distinct from the
// 'project' category, which stays "whatever extra a member chooses to put
// in, completely their choice" — both land in the same project account
// (byProject() above counts both), but they're tracked separately so a
// manager can tell the required floor from the voluntary top-up.

export const projectBaselineOf = (contributions, projectId, memberId) => (contributions || [])
  .filter((c) => c.project_id === projectId && c.member_id === memberId && c.category === 'project_baseline')
  .reduce((s, c) => s + num(c.amount), 0);

export const projectBaselinePaidThisMonth = (contributions, projectId, memberId, baselineAmount) => {
  const required = num(baselineAmount);
  if (!required) return true; // no baseline set on this project — nothing owed
  const key = monthKeyOf(new Date().toISOString());
  const thisMonth = (contributions || [])
    .filter((c) => c.project_id === projectId && c.member_id === memberId && c.category === 'project_baseline' && monthKeyOf(c.created_at) === key)
    .reduce((s, c) => s + num(c.amount), 0);
  return thisMonth >= required;
};

// Every member's baseline status for one project — what a manager's
// per-project baseline tab reads.
export const projectBaselineRows = (members, contributions, project) => (members || []).map((m) => ({
  member: m,
  total: projectBaselineOf(contributions, project.id, m.id),
  paidThisMonth: projectBaselinePaidThisMonth(contributions, project.id, m.id, project.baseline_monthly_amount),
}));

// Every project with a baseline set, and this one member's standing on
// each — what a member's own dashboard lists, and what feeds the credit
// score's instalment-consistency factor above.
export const memberBaselineStatus = (projects, contributions, memberId) => (projects || [])
  .filter((p) => num(p.baseline_monthly_amount) > 0)
  .map((p) => ({
    project: p,
    required: num(p.baseline_monthly_amount),
    total: projectBaselineOf(contributions, p.id, memberId),
    paidThisMonth: projectBaselinePaidThisMonth(contributions, p.id, memberId, p.baseline_monthly_amount),
  }));

// ── One demo universe, shared by every panel ────────────────────────────────
// Dashboard/Members/Investors/Projects all pull from these same arrays in
// demo mode, so switching tabs tells one consistent story.
const day = (n) => new Date(Date.now() - 86400000 * n).toISOString();

// The chama's real rules: 5,000 once to join (Reserve), 1,000/month that
// funds loans & operations in full (none of it diverted to the Fund
// Account — loans_ops_reserve_pct only decides how much of that pool is
// flagged for running costs vs. actually lendable), then whatever a
// member owes a project's baseline plus whatever extra they choose to
// put in on top.
export const DEMO_SETTINGS_SEED = {
  membership_fee: 5000, loan_multiplier: 3, loan_interest_rate: 10, loan_term_months: 6,
  monthly_contribution_amount: 1000, loans_ops_reserve_pct: 20, setup_costs: 0,
  loan_qualifying_months: 2, loan_max_per_member: 50000, loan_max_pool_pct: 80, loan_late_penalty_pct: 5,
};

// Wanjiku is deliberately short of the fee (3,000 of 5,000) so the
// "Prospective" grouping has something to show in the demo.
export const DEMO_MEMBERS_SEED = [
  { id: 'mem-you', name: 'You', contact: 'you@example.com', created_at: day(155) },
  { id: 'mem-2', name: 'Wanjiku Kamau', contact: '+254 7xx xxx xxx', created_at: day(185) },
  { id: 'mem-3', name: 'Omondi Otieno', contact: 'omondi@example.com', created_at: day(95) },
];

export const DEMO_CONTRIBUTORS_SEED = [
  { id: 'dc1', type: 'investor', name: 'Baraza Growth Partners', contact: 'hello@barazagp.com', expected_return: '12% annually', notes: '' },
  { id: 'dc2', type: 'donor', name: 'Nakuru Diaspora Circle', contact: '+254 7xx xxx xxx', notes: '' },
  { id: 'dc3', type: 'donor', name: 'Thika SACCO Alumni', contact: 'alumni@thikasacco.example', notes: '' },
];

// Project 1 carries a baseline (2,000/month, owed by every member
// automatically — Omondi owes it too even though he backs project 2
// instead, which is the point of the demo) so there's something for the
// baseline tab and the credit-score instalment factor to show.
export const DEMO_PROJECTS_SEED = [
  { id: 'demo-project-1', title: 'Cold-chain delivery pilot', summary: 'Shared refrigerated transport for three member-run farms.', target_amount: 180000, status: 'active', baseline_monthly_amount: 2000, created_at: day(160) },
  { id: 'demo-project-2', title: 'Shared retail POS rollout', summary: 'Point-of-sale + inventory system across member shops.', target_amount: 60000, status: 'active', baseline_monthly_amount: null, created_at: day(70) },
  { id: 'demo-project-3', title: 'Bulk input-buying cooperative', summary: 'Pooled seed and fertiliser orders at wholesale prices for member farms.', target_amount: 45000, status: 'completed', baseline_monthly_amount: null, created_at: day(100) },
];

// You: fee paid, backs project 1. Wanjiku: biggest single contributor but
// still short on her fee (3,000 of 5,000) — shows the "Prospective"
// grouping in action. Omondi: fee paid, backs project 2. Plus two donors
// and one investor, mostly unearmarked (general fund) except one project backer.
export const DEMO_CONTRIBUTIONS_SEED = [
  { id: 'd1', member_id: 'mem-you', category: 'membership', amount: 5000, description: 'Founding membership contribution', created_at: day(150) },
  { id: 'd2', member_id: 'mem-you', category: 'monthly', amount: 1000, description: 'September instalment', created_at: day(40) },
  { id: 'd3', member_id: 'mem-you', category: 'monthly', amount: 1000, description: 'October instalment', created_at: day(10) },
  { id: 'd4', member_id: 'mem-you', category: 'project', project_id: 'demo-project-1', amount: 20000, description: 'Cold-chain delivery pilot', created_at: day(5) },
  { id: 'd5', member_id: 'mem-2', category: 'membership', amount: 3000, description: 'Membership fee (part-paid)', created_at: day(180) },
  { id: 'd6', member_id: 'mem-2', category: 'monthly', amount: 1000, description: 'August instalment', created_at: day(70) },
  { id: 'd7', member_id: 'mem-2', category: 'monthly', amount: 1000, description: 'September instalment', created_at: day(40) },
  { id: 'd8', member_id: 'mem-2', category: 'monthly', amount: 600, description: 'October instalment (partial)', created_at: day(9) },
  { id: 'd9', member_id: 'mem-2', category: 'project', project_id: 'demo-project-1', amount: 40000, description: 'Cold-chain delivery pilot', created_at: day(44) },
  { id: 'd10', member_id: 'mem-3', category: 'membership', amount: 5000, description: 'Founding membership contribution', created_at: day(90) },
  { id: 'd11', member_id: 'mem-3', category: 'monthly', amount: 1000, description: 'October instalment', created_at: day(8) },
  { id: 'd12', member_id: 'mem-3', category: 'project', project_id: 'demo-project-2', amount: 15000, description: 'Shared retail POS rollout', created_at: day(6) },
  { id: 'd13', contributor_id: 'dc1', category: 'investment', project_id: 'demo-project-1', amount: 100000, description: 'Backing the cold-chain pilot', created_at: day(20) },
  { id: 'd14', contributor_id: 'dc1', category: 'investment', amount: 50000, description: 'General fund', created_at: day(20) },
  { id: 'd15', contributor_id: 'dc2', category: 'donation', amount: 25000, description: 'Founding gift', created_at: day(35) },
  { id: 'd16', contributor_id: 'dc3', category: 'donation', amount: 8000, description: 'Harvest-season gift', created_at: day(15) },
  { id: 'd17', member_id: 'mem-you', category: 'project', project_id: 'demo-project-3', amount: 45000, description: 'Bulk input-buying cooperative', created_at: day(85) },
  // Project 1's baseline (2,000/month, owed by every member): You're fully
  // current; Wanjiku missed this month (shows the "not paid" state); Omondi
  // has never paid it at all, despite owing it like everyone else — he
  // backs project 2 instead, which is exactly the case this demo flags.
  { id: 'd18', member_id: 'mem-you', category: 'project_baseline', project_id: 'demo-project-1', amount: 2000, description: 'August baseline', created_at: day(70) },
  { id: 'd19', member_id: 'mem-you', category: 'project_baseline', project_id: 'demo-project-1', amount: 2000, description: 'September baseline', created_at: day(40) },
  { id: 'd20', member_id: 'mem-you', category: 'project_baseline', project_id: 'demo-project-1', amount: 2000, description: 'October baseline', created_at: day(8) },
  { id: 'd21', member_id: 'mem-2', category: 'project_baseline', project_id: 'demo-project-1', amount: 2000, description: 'August baseline', created_at: day(70) },
  { id: 'd22', member_id: 'mem-2', category: 'project_baseline', project_id: 'demo-project-1', amount: 2000, description: 'September baseline', created_at: day(40) },
];

// You: an older loan, fully repaid — shows the repaid state and history.
// Omondi: an active loan with one repayment logged — shows up as "has an
// unpaid loan" on the eligibility list, and overdue tracking if left unpaid
// past its term. Wanjiku has none — she isn't eligible yet (fee not paid).
export const DEMO_LOANS_SEED = [
  { id: 'ln1', member_id: 'mem-you', principal: 15000, interest_rate: 10, term_months: 3, note: 'Stock top-up', issued_at: day(200) },
  { id: 'ln2', member_id: 'mem-3', principal: 20000, interest_rate: 10, term_months: 6, note: 'School fees bridge', issued_at: day(60) },
];

export const DEMO_LOAN_REPAYMENTS_SEED = [
  { id: 'lr1', loan_id: 'ln1', amount: 9000, created_at: day(170) },
  { id: 'lr2', loan_id: 'ln1', amount: 7500, created_at: day(140) },
  { id: 'lr3', loan_id: 'ln2', amount: 5000, created_at: day(20) },
];

// Project 1: Wanjiku pledged more than she's paid in yet (50,000 vs 40,000) —
// shows a goal that isn't fully met. Project 2: Omondi is right on his
// pledge; You have a goal set but haven't put anything toward it yet.
export const DEMO_PROJECT_PLEDGES_SEED = [
  { id: 'pl1', project_id: 'demo-project-1', member_id: 'mem-you', amount: 20000 },
  { id: 'pl2', project_id: 'demo-project-1', member_id: 'mem-2', amount: 50000 },
  { id: 'pl3', project_id: 'demo-project-2', member_id: 'mem-3', amount: 15000 },
  { id: 'pl4', project_id: 'demo-project-2', member_id: 'mem-you', amount: 10000 },
];
