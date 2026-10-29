'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Check, X, Eye, Repeat, Sparkles, Link2, Trash2, ShieldCheck, Shield } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  CATEGORY_LABEL, money, num, canEditFund, byMember,
  membershipPaid, isPaidMember, loadDemo, saveDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED, DEMO_SETTINGS_SEED,
  DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED, DEMO_PROJECT_PLEDGES_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function FundMembersPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
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
  const pledgesKey = `demo-fund-pledges-${agencyId || 'x'}`;

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyId, setHistoryId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState('');
  const [aMpesa, setAMpesa] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aAmount, setAAmount] = useState('');
  const [aDate, setADate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aNote, setANote] = useState('');
  const [saving, setSaving] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [fMemberId, setFMemberId] = useState('');
  const [fAmount, setFAmount] = useState('');

  const [editingLogin, setEditingLogin] = useState(false);
  const [loginInput, setLoginInput] = useState('');

  // This agency's accounts and their role here — fetched only for a manager,
  // only in real mode (demo has no real accounts to promote). Used purely to
  // show/toggle manager access for a fund member's linked login, matched by
  // email the same way the rest of the fund resolves "who is this person."
  const [agencyMembers, setAgencyMembers] = useState([]);
  const [agencyMembersVersion, setAgencyMembersVersion] = useState(0);
  const [togglingManager, setTogglingManager] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setProjects(DEMO_PROJECTS_SEED);
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: projs }, { data: s }] = await Promise.all([
        sb.from('fund_members').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
      ]);
      if (cancelled) return;
      setMembers(m || []); setContributions(contribs || []); setProjects(projs || []);
      setSettings(s || { membership_fee: 5000 });
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-members:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, settingsKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadAgencyMembers() {
      if (isDemo || !agencyId || !canEdit) { if (!cancelled) setAgencyMembers([]); return; }
      const res = await fetch(`/api/agencies/${agencyId}/members`);
      const json = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) setAgencyMembers(json.data || []);
    }
    loadAgencyMembers();
    return () => { cancelled = true; };
  }, [agencyId, isDemo, canEdit, agencyMembersVersion]);

  // The account (if any) whose login matches this fund member's linked
  // email — same loose match (case/whitespace-insensitive) the rest of the
  // fund uses to resolve "who is this person."
  const linkedAccountFor = (loginEmail) => {
    const needle = (loginEmail || '').trim().toLowerCase();
    if (!needle) return null;
    return agencyMembers.find((m) => (m.user?.email || '').trim().toLowerCase() === needle) || null;
  };

  const setManagerAccess = async (loginEmail, makeManager) => {
    setTogglingManager(true);
    const res = await fetch(`/api/agencies/${agencyId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, role: makeManager ? 'manager' : 'member' }),
    });
    const json = await res.json().catch(() => ({}));
    setTogglingManager(false);
    if (!res.ok) { toast.error('Could not update', json.error || 'Something went wrong.'); return; }
    setAgencyMembersVersion((v) => v + 1);
    toast.success(makeManager ? 'Manager access granted' : 'Manager access removed');
  };

  const membershipFee = num(settings?.membership_fee);
  const projectName = (id) => projects.find((p) => p.id === id)?.title || null;

  const rows = useMemo(() => members.map((m) => ({
    ...m,
    total: byMember(contributions, m.id),
    paidToFee: membershipPaid(contributions, m.id),
    isMember: isPaidMember(contributions, m.id, membershipFee),
  })).sort((a, b) => b.total - a.total), [members, contributions, membershipFee]);

  const activeMembers = rows.filter((r) => r.isMember);
  const prospective = rows.filter((r) => !r.isMember);

  const historyMember = rows.find((r) => r.id === historyId);
  const historyList = contributions.filter((c) => c.member_id === historyId);

  const saveFee = async () => {
    const next = num(feeInput);
    setEditingFee(false);
    if (isDemo) {
      const nextSettings = { ...settings, membership_fee: next };
      setSettings(nextSettings); saveDemo(settingsKey, nextSettings);
      return;
    }
    const { error } = await createClient().from('fund_settings').upsert({ agency_id: agencyId, membership_fee: next, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
    if (error) { toast.error('Could not save', error.message); return; }
    setSettings((s) => ({ ...s, membership_fee: next }));
  };

  const resetAdd = () => {
    setAName(''); setAMpesa(''); setAEmail(''); setAAmount(''); setANote('');
    setADate(new Date().toISOString().slice(0, 10));
  };

  // Adding a prospect and logging their first payment happen in one step —
  // in practice nobody shows up without having already sent something. It's
  // always the membership fee — that's the whole point of becoming a prospect.
  const addProspect = async () => {
    const amount = num(aAmount);
    if (!aName.trim() || !amount) return;
    setSaving(true);
    const memberRow = { name: aName.trim(), contact: aMpesa.trim() || null, login_email: aEmail.trim() || null, created_by: myId };
    const mpesaNote = aMpesa.trim() ? `M-Pesa ${aMpesa.trim()}` : '';
    const description = [mpesaNote, aNote.trim()].filter(Boolean).join(' · ') || null;
    const contribBase = { category: 'membership', amount, project_id: null, description, created_at: new Date(aDate).toISOString() };
    if (isDemo) {
      const newId = `demo-${Date.now()}`;
      const nextMembers = [{ ...memberRow, id: newId }, ...members];
      const nextContributions = [{ ...contribBase, id: `demo-${Date.now()}-c`, member_id: newId }, ...contributions];
      setMembers(nextMembers); saveDemo(membersKey, nextMembers);
      setContributions(nextContributions); saveDemo(contributionsKey, nextContributions);
      setSaving(false); setAddOpen(false); resetAdd();
      toast.success('Added', `${memberRow.name} has started paying their fee.`);
      return;
    }
    const sb = createClient();
    const { data: created, error } = await sb.from('fund_members').insert({ ...memberRow, agency_id: agencyId }).select().single();
    if (error) { setSaving(false); toast.error('Could not add', error.message); return; }
    const { error: e2 } = await sb.from('fund_contributions').insert({
      ...contribBase, agency_id: agencyId, member_id: created.id, created_by: myId,
    });
    setSaving(false);
    if (e2) { toast.error('Added, but the payment failed to log', e2.message); return; }
    setAddOpen(false); resetAdd();
    toast.success('Added', `${memberRow.name} has started paying their fee.`);
  };

  const openLog = (memberId) => { setFAmount(''); setFMemberId(memberId); setLogOpen(true); };
  // No category picker here — a payment from someone still paying off their
  // fee counts toward it; a payment from someone already a member is a
  // regular monthly contribution. Either way it's just "they sent money."
  const saveLog = async () => {
    const amount = num(fAmount);
    if (!amount || !fMemberId) return;
    setSaving(true);
    const target = rows.find((r) => r.id === fMemberId);
    const category = target?.isMember ? 'monthly' : 'membership';
    const row = { member_id: fMemberId, category, amount, project_id: null, description: null, created_by: myId, created_at: new Date().toISOString() };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...contributions];
      setContributions(next); saveDemo(contributionsKey, next);
      setSaving(false); setLogOpen(false);
      toast.success('Contribution logged', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_contributions').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not save', error.message); return; }
    setLogOpen(false);
    toast.success('Contribution logged', money(amount));
  };

  const patchMember = async (id, patch) => {
    if (isDemo) {
      const next = members.map((m) => m.id === id ? { ...m, ...patch } : m);
      setMembers(next); saveDemo(membersKey, next);
      return;
    }
    const { error } = await createClient().from('fund_members').update(patch).eq('id', id);
    if (error) toast.error('Could not save', error.message);
  };

  // Everything about a deleted member goes with them — their logged
  // contributions, loans, and project goals are all removed, not just
  // unlinked. Real mode does this with one delete (fund_contributions,
  // fund_loans and fund_project_pledges all cascade from fund_members);
  // demo mode simulates the same cascade by hand below.
  const removeMember = async (id) => {
    setConfirmDeleteId(null);
    if (historyId === id) setHistoryId(null);
    if (isDemo) {
      const nextMembers = members.filter((m) => m.id !== id);
      setMembers(nextMembers); saveDemo(membersKey, nextMembers);
      const nextContributions = contributions.filter((c) => c.member_id !== id);
      setContributions(nextContributions); saveDemo(contributionsKey, nextContributions);
      const loans = loadDemo(loansKey, DEMO_LOANS_SEED);
      const removedLoanIds = loans.filter((l) => l.member_id === id).map((l) => l.id);
      saveDemo(loansKey, loans.filter((l) => l.member_id !== id));
      if (removedLoanIds.length) {
        const repayments = loadDemo(repaymentsKey, DEMO_LOAN_REPAYMENTS_SEED);
        saveDemo(repaymentsKey, repayments.filter((r) => !removedLoanIds.includes(r.loan_id)));
      }
      const pledges = loadDemo(pledgesKey, DEMO_PROJECT_PLEDGES_SEED);
      saveDemo(pledgesKey, pledges.filter((pl) => pl.member_id !== id));
      toast.success('Member deleted');
      return;
    }
    const { error } = await createClient().from('fund_members').delete().eq('id', id);
    if (error) { toast.error('Could not delete', error.message); return; }
    toast.success('Member deleted');
  };

  const saveLogin = async () => {
    if (!historyId) return;
    const next = loginInput.trim() || null;
    setEditingLogin(false);
    await patchMember(historyId, { login_email: next });
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading members…</div>;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Members</div>
            <div style={{ fontSize: 12.5, color: tSub }}>A person becomes a member once their membership fee is paid in full</div>
          </div>
        </div>
        {canEdit && (
          <button className="fund-btn primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add prospect</button>
        )}
      </div>

      {/* Membership fee */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.06em' }}>Membership fee</span>
        {editingFee ? (
          <>
            <input className="fund-input" style={{ width: 140, height: 32 }} type="number" autoFocus value={feeInput} onChange={(e) => setFeeInput(e.target.value)} />
            <button className="fund-btn" style={{ height: 32 }} onClick={saveFee}><Check size={13} /></button>
            <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingFee(false)}><X size={13} /></button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 17, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(membershipFee)}</span>
            {canEdit && (
              <button className="fund-btn" style={{ height: 28, fontSize: 11 }} onClick={() => { setFeeInput(String(membershipFee)); setEditingFee(true); }}><Pencil size={11} /> Edit</button>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <MemberGroup
          title={`Prospective (${prospective.length})`} rows={prospective} tint="#F5A623"
          canEdit={canEdit} onSelect={setHistoryId} onLog={openLog} card={card} tKey={tKey} tSub={tSub}
          emptyText="Everyone added so far has paid their fee."
          showOwed membershipFee={membershipFee}
          confirmDeleteId={confirmDeleteId} onDeleteRequest={setConfirmDeleteId} onDeleteConfirm={removeMember}
        />
        <MemberGroup
          title={`Members (${activeMembers.length})`} rows={activeMembers} tint="#22C55E"
          canEdit={canEdit} onSelect={setHistoryId} card={card} tKey={tKey} tSub={tSub}
          emptyText="No one has paid their fee in full yet."
          onTrack={() => setCurrentView('fundInstallments')}
          confirmDeleteId={confirmDeleteId} onDeleteRequest={setConfirmDeleteId} onDeleteConfirm={removeMember}
        />
      </div>

      {/* History modal — read-only: M-Pesa number, membership total, and the
          monthly chama/loan instalments. Entering a new payment happens via
          the "+" button on the row, not here. */}
      <Modal isOpen={!!historyId} onClose={() => { setHistoryId(null); setEditingLogin(false); }} title={historyMember ? historyMember.name : 'Contributions'} maxWidth="460px">
        {historyMember && (() => {
          const monthlyList = historyList.filter((c) => c.category === 'monthly');
          const otherList = historyList.filter((c) => c.category !== 'monthly' && c.category !== 'membership');
          const monthlyTotal = monthlyList.reduce((s, c) => s + num(c.amount), 0);
          const feeDone = historyMember.paidToFee >= membershipFee;
          const pct = membershipFee > 0 ? Math.min(100, Math.round((historyMember.paidToFee / membershipFee) * 100)) : 100;
          const statusTint = feeDone ? '#22C55E' : '#F5A623';
          const innerCard = {
            background: 'linear-gradient(160deg, rgba(30,79,184,0.10), rgba(255,255,255,0.015) 70%)',
            border: '1px solid rgba(91,155,255,0.14)', borderRadius: 16, padding: '14px 16px',
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Profile header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(145deg, ${statusTint}30, ${statusTint}10)`,
                  border: `1.5px solid ${statusTint}55`, color: statusTint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800,
                }}>
                  {historyMember.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  {historyMember.contact ? (
                    <div style={{ fontSize: 13, color: tSub }}>{historyMember.contact}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No contact on file</div>
                  )}
                </div>
                <span style={{
                  marginLeft: 'auto', flexShrink: 0, fontSize: 10, fontWeight: 800, color: statusTint,
                  background: `${statusTint}1c`, border: `1px solid ${statusTint}40`, borderRadius: 999,
                  padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  {feeDone ? 'Member' : 'Prospective'}
                </span>
              </div>

              {/* Linked account — lets this person see their own profile once they're a paid member */}
              {canEdit && (
                <div style={{ ...innerCard, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Link2 size={14} style={{ color: tSub, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Linked account</span>
                  {editingLogin ? (
                    <>
                      <input className="fund-input" style={{ flex: 1, minWidth: 140, height: 32 }} type="email" autoFocus value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="their@email.com" />
                      <button className="fund-btn" style={{ height: 32 }} onClick={saveLogin}><Check size={13} /></button>
                      <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingLogin(false)}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 12.5, color: historyMember.login_email ? tKey : tSub, fontStyle: historyMember.login_email ? 'normal' : 'italic', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {historyMember.login_email || 'Not linked'}
                      </span>
                      <button className="fund-btn" style={{ height: 28, fontSize: 11 }} onClick={() => { setLoginInput(historyMember.login_email || ''); setEditingLogin(true); }}><Pencil size={11} /> Edit</button>
                    </>
                  )}
                </div>
              )}

              {/* Manager access — grants full ImpactFund view+edit to just this
                  one linked account, scoped to this agency only (their role
                  in any other agency they belong to is untouched). Needs a
                  linked account to act on, so it only shows once one's set. */}
              {canEdit && historyMember.login_email && (() => {
                const linked = linkedAccountFor(historyMember.login_email);
                const isManager = linked?.role === 'manager';
                const isSuperadmin = linked?.role === 'superadmin';
                return (
                  <div style={{ ...innerCard, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {isManager || isSuperadmin ? <ShieldCheck size={14} style={{ color: '#22C55E', flexShrink: 0 }} /> : <Shield size={14} style={{ color: tSub, flexShrink: 0 }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Manager access</span>
                    {!linked ? (
                      <span style={{ fontSize: 12, color: tSub, fontStyle: 'italic', flex: 1, minWidth: 160 }}>Hasn’t signed in with this email yet — once they do, you can grant it.</span>
                    ) : isSuperadmin ? (
                      <span style={{ fontSize: 12.5, color: tKey, flex: 1, minWidth: 0 }}>Already a superadmin — full access everywhere.</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 12.5, color: isManager ? '#22C55E' : tSub, fontWeight: 600, flex: 1, minWidth: 0 }}>
                          {isManager ? 'Can view and edit everything in this fund' : 'View-only, member pages only'}
                        </span>
                        <button
                          className="fund-btn" style={{ height: 28, fontSize: 11 }} disabled={togglingManager}
                          onClick={() => setManagerAccess(historyMember.login_email, !isManager)}
                        >
                          {isManager ? 'Remove manager access' : 'Make manager'}
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Membership */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: `${statusTint}22`, color: statusTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkles size={13} /></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Membership fee</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: feeDone ? 0 : 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={historyMember.paidToFee} /></span>
                  {!feeDone && <span style={{ fontSize: 12.5, color: tSub, fontWeight: 600 }}>of {money(membershipFee)}</span>}
                  {feeDone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: 'var(--color-success-text, #22C55E)' }}><Check size={13} /> Paid in full</span>}
                </div>
                {!feeDone && (
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#F5A623,#F7C948)', transition: 'width .3s' }} />
                  </div>
                )}
              </div>

              {/* Monthly instalments — summary only; the full ledger lives on the Installments tab */}
              <div style={innerCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: monthlyList.length ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(48,108,236,0.18)', color: 'var(--color-accent-text, #7EB3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Repeat size={13} /></div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Monthly instalments</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(monthlyTotal)}</span>
                </div>
                {monthlyList.length === 0 ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No instalments yet — the chama/loan contribution.</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10.5, color: tSub }}>{monthlyList.length} instalment{monthlyList.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => { setHistoryId(null); setCurrentView('fundInstallments'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
                    >
                      See all →
                    </button>
                  </div>
                )}
              </div>

              {/* Anything else — project backing, etc. */}
              {otherList.length > 0 && (
                <div style={{ ...innerCard, background: 'rgba(255,255,255,0.025)', border: '1px solid var(--color-divider, rgba(255,255,255,0.08))' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Other</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {otherList.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderTop: i > 0 ? '1px solid var(--color-divider, rgba(255,255,255,0.06))' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>
                            {CATEGORY_LABEL[c.category] || c.category}
                            {c.project_id && <span style={{ color: tSub, fontWeight: 500 }}> · {projectName(c.project_id) || 'a project'}</span>}
                          </div>
                          <div style={{ fontSize: 10.5, color: tSub }}>{fmtDate(c.created_at)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{money(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Add prospect modal — name, M-Pesa number, and the membership payment
          that comes with adding them. */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add prospect" maxWidth="420px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Name</span>
            <input className="fund-input" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Full name" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">M-Pesa number</span>
            <input className="fund-input" value={aMpesa} onChange={(e) => setAMpesa(e.target.value)} placeholder="07xx xxx xxx" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Account email (optional)</span>
            <input className="fund-input" type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="The email they log in with" />
            <div style={{ fontSize: 10.5, color: tSub, marginTop: 4 }}>Links this record to their login, so they can see their own profile once their fee is paid.</div>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Amount sent (KES)</span>
              <input className="fund-input" type="number" inputMode="decimal" value={aAmount} onChange={(e) => setAAmount(e.target.value)} placeholder="2000" />
            </label>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Date</span>
              <input className="fund-input" type="date" value={aDate} onChange={(e) => setADate(e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Note (optional)</span>
            <textarea className="fund-input" rows={2} value={aNote} onChange={(e) => setANote(e.target.value)} placeholder="e.g. M-Pesa ref #4821" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="fund-btn primary" onClick={addProspect} disabled={saving || !aName.trim() || !num(aAmount)}>{saving ? 'Saving…' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      {/* Log a payment — just the amount */}
      <Modal isOpen={logOpen} onClose={() => setLogOpen(false)} title="Log a payment" maxWidth="340px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Amount (KES)</span>
            <input className="fund-input" type="number" inputMode="decimal" autoFocus value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="2000" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setLogOpen(false)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveLog} disabled={saving || !num(fAmount) || !fMemberId}>{saving ? 'Saving…' : 'Save'}</button>
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

function MemberGroup({ title, rows, tint, canEdit, onSelect, onLog, onTrack, card, tKey, tSub, emptyText, showOwed, membershipFee, confirmDeleteId, onDeleteRequest, onDeleteConfirm }) {
  return (
    <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: tint, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{title}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>{emptyText}</div>
      ) : rows.map((m) => {
        const fee = num(membershipFee);
        const pct = showOwed && fee > 0 ? Math.min(100, Math.round((m.paidToFee / fee) * 100)) : null;
        const owed = showOwed ? Math.max(0, fee - m.paidToFee) : 0;
        return (
          <div key={m.id} style={{ borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
            <div
              onClick={() => onSelect(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'rgba(48,108,236,0.18)', color: 'var(--color-accent-text, #7EB3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                {m.contact && <div style={{ fontSize: 10.5, color: tSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.contact}</div>}
                {pct != null && owed > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 3, maxWidth: 160 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#F5A623,#F7C948)' }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: '#F5A623' }}>{money(m.paidToFee)} of {money(fee)} fee paid — owes {money(owed)}</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(m.total)}</div>
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}
                title="View contributions"
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Eye size={14} />
              </button>
              {canEdit && onLog && (
                <button
                  onClick={(e) => { e.stopPropagation(); onLog(m.id); }}
                  title="Log a contribution for this member"
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(48,108,236,0.14)', color: 'var(--color-accent-text, #7EB3FF)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={14} />
                </button>
              )}
              {canEdit && onTrack && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(); }}
                  title="Track this member's monthly instalments"
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(48,108,236,0.14)', color: 'var(--color-accent-text, #7EB3FF)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Repeat size={13} />
                </button>
              )}
              {canEdit && onDeleteRequest && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteRequest(m.id); }}
                  title="Delete this member"
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.14)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {confirmDeleteId === m.id && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
                <span style={{ fontSize: 11.5, color: '#EF4444', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>
                  Delete {m.name}? Everything about them — contributions, loan records, and project goals — is deleted too. This can&rsquo;t be undone.
                </span>
                <button className="fund-btn" style={{ height: 30, fontSize: 11.5, background: 'linear-gradient(135deg,#B91C1C,#EF4444)', border: 'none', color: '#fff', flexShrink: 0 }} onClick={() => onDeleteConfirm(m.id)}>Delete</button>
                <button className="fund-btn" style={{ height: 30, fontSize: 11.5, flexShrink: 0 }} onClick={() => onDeleteRequest(null)}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
