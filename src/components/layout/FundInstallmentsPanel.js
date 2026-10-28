'use client';

import { useEffect, useMemo, useState } from 'react';
import { Repeat, Plus, Eye, Check, Pencil, X, Boxes } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, canEditFund, monthKeyOf, monthlyPaidThisMonth, projectBaselineRows, loadDemo, saveDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_SETTINGS_SEED, DEMO_PROJECTS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const thisMonthKey = () => new Date().toISOString().slice(0, 7);

// The chama/loan contribution every member makes month to month — the
// members list itself lives here now, each row tracking that member's own
// instalment record instead of a flat all-members ledger.
export default function FundInstallmentsPanel() {
  const { workspace, activeAgencyId, userProfile, isDemo } = useWorkspaceStore();
  const toast = useToast();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(userProfile, isDemo);
  const myId = isDemo ? 'demo-you' : userProfile?.id;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyId, setHistoryId] = useState(null);

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState('');

  const [logOpen, setLogOpen] = useState(null); // member
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const [baselineLogFor, setBaselineLogFor] = useState(null); // { project, member }
  const [bAmount, setBAmount] = useState('');
  const [bDate, setBDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [baselineFilter, setBaselineFilter] = useState('all'); // 'all' | a project id
  const [editingBaselineId, setEditingBaselineId] = useState(null); // project id
  const [baselineAmountInput, setBaselineAmountInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: s }, { data: p }] = await Promise.all([
        sb.from('fund_members').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
        sb.from('fund_projects').select('id, title, baseline_monthly_amount').eq('agency_id', agencyId),
      ]);
      if (cancelled) return;
      setMembers(m || []); setContributions(contribs || []);
      setSettings(s || DEMO_SETTINGS_SEED);
      setProjects(p || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-installments:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, settingsKey, projectsKey]);

  const expectedAmount = num(settings?.monthly_contribution_amount);

  const saveAmount = async () => {
    const next = num(amountInput);
    setEditingAmount(false);
    if (isDemo) {
      const nextSettings = { ...settings, monthly_contribution_amount: next };
      setSettings(nextSettings); saveDemo(settingsKey, nextSettings);
      return;
    }
    const { error } = await createClient().from('fund_settings').upsert({ agency_id: agencyId, monthly_contribution_amount: next, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
    if (error) { toast.error('Could not save', error.message); return; }
    setSettings((s) => ({ ...s, monthly_contribution_amount: next }));
  };

  const monthlyOf = (memberId) => contributions
    .filter((c) => c.member_id === memberId && c.category === 'monthly')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const rows = useMemo(() => members.map((m) => {
    const list = contributions
      .filter((c) => c.member_id === m.id && c.category === 'monthly')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = list.reduce((s, c) => s + num(c.amount), 0);
    const thisMonthTotal = list.filter((c) => monthKeyOf(c.created_at) === thisMonthKey()).reduce((s, c) => s + num(c.amount), 0);
    const paidThisMonth = monthlyPaidThisMonth(thisMonthTotal, expectedAmount);
    return { ...m, monthlyTotal: total, monthlyCount: list.length, thisMonthTotal, paidThisMonth, lastPaidAt: list[0]?.created_at || null };
  }).sort((a, b) => b.monthlyTotal - a.monthlyTotal), [members, contributions, expectedAmount]);

  const paidRows = rows.filter((r) => r.paidThisMonth);
  const unpaidRows = rows.filter((r) => !r.paidThisMonth);

  const totalThisMonth = useMemo(() => {
    const key = thisMonthKey();
    return contributions.filter((c) => c.category === 'monthly' && monthKeyOf(c.created_at) === key).reduce((s, c) => s + num(c.amount), 0);
  }, [contributions]);
  const totalAll = useMemo(() => contributions.filter((c) => c.category === 'monthly').reduce((s, c) => s + num(c.amount), 0), [contributions]);

  const historyMember = rows.find((r) => r.id === historyId);
  const historyList = historyMember ? monthlyOf(historyMember.id) : [];

  const openLog = (member) => { setFAmount(expectedAmount ? String(expectedAmount) : ''); setFDate(new Date().toISOString().slice(0, 10)); setLogOpen(member); };

  const saveLog = async () => {
    const amount = num(fAmount);
    if (!amount || !logOpen) return;
    setSaving(true);
    const row = { member_id: logOpen.id, category: 'monthly', amount, project_id: null, description: null, created_by: myId, created_at: new Date(fDate).toISOString() };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...contributions];
      setContributions(next); saveDemo(contributionsKey, next);
      setSaving(false); setLogOpen(null);
      toast.success('Instalment logged', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_contributions').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not save', error.message); return; }
    setLogOpen(null);
    toast.success('Instalment logged', money(amount));
  };

  // Each project's own required monthly due — a separate ledger from the
  // chama instalment above, but recorded the same way, so a manager can do
  // both from this one tab instead of hopping to each project's own page.
  const baselineProjects = useMemo(() => projects.filter((p) => num(p.baseline_monthly_amount) > 0), [projects]);
  const baselineRowsByProject = useMemo(
    () => baselineProjects.map((p) => ({ project: p, rows: projectBaselineRows(members, contributions, p) })),
    [baselineProjects, members, contributions]
  );
  const visibleBaselineRows = baselineFilter === 'all' ? baselineRowsByProject : baselineRowsByProject.filter(({ project }) => project.id === baselineFilter);

  const openEditBaselineAmount = (project) => {
    setBaselineAmountInput(String(num(project.baseline_monthly_amount)));
    setEditingBaselineId(project.id);
  };

  const saveBaselineAmount = async (project) => {
    const next = baselineAmountInput.trim() ? num(baselineAmountInput) : null;
    setEditingBaselineId(null);
    if (baselineFilter === project.id && !next) setBaselineFilter('all');
    if (isDemo) {
      const nextProjects = projects.map((p) => p.id === project.id ? { ...p, baseline_monthly_amount: next } : p);
      setProjects(nextProjects); saveDemo(projectsKey, nextProjects);
      toast.success(next ? 'Baseline updated' : 'Baseline removed', next ? `${money(next)}/month` : undefined);
      return;
    }
    const { error } = await createClient().from('fund_projects').update({ baseline_monthly_amount: next }).eq('id', project.id);
    if (error) { toast.error('Could not save', error.message); return; }
    toast.success(next ? 'Baseline updated' : 'Baseline removed', next ? `${money(next)}/month` : undefined);
  };

  const openBaselineLog = (project, member) => {
    setBAmount(String(num(project.baseline_monthly_amount)));
    setBDate(new Date().toISOString().slice(0, 10));
    setBaselineLogFor({ project, member });
  };

  const saveBaselineLog = async () => {
    const amount = num(bAmount);
    if (!amount || !baselineLogFor) return;
    setSaving(true);
    const { project, member } = baselineLogFor;
    const row = { member_id: member.id, category: 'project_baseline', project_id: project.id, amount, description: null, created_by: myId, created_at: new Date(bDate).toISOString() };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...contributions];
      setContributions(next); saveDemo(contributionsKey, next);
      setSaving(false); setBaselineLogFor(null);
      toast.success('Baseline logged', `${money(amount)} — ${project.title}`);
      return;
    }
    const { error } = await createClient().from('fund_contributions').insert({ ...row, agency_id: agencyId });
    setSaving(false);
    if (error) { toast.error('Could not save', error.message); return; }
    setBaselineLogFor(null);
    toast.success('Baseline logged', `${money(amount)} — ${project.title}`);
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading instalments…</div>;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
          <Repeat size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Installments</div>
          <div style={{ fontSize: 12.5, color: tSub }}>The monthly chama contribution, plus every project&rsquo;s baseline due — member by member</div>
        </div>
      </div>

      {/* Monthly instalment amount */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.06em' }}>Monthly instalment</span>
        {editingAmount ? (
          <>
            <input className="fund-input" style={{ width: 140, height: 32 }} type="number" autoFocus value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
            <button className="fund-btn" style={{ height: 32 }} onClick={saveAmount}><Check size={13} /></button>
            <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingAmount(false)}><X size={13} /></button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 17, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(expectedAmount)}<span style={{ fontSize: 11.5, color: tSub, fontWeight: 600 }}>/month</span></span>
            {canEdit && (
              <button className="fund-btn" style={{ height: 28, fontSize: 11 }} onClick={() => { setAmountInput(String(expectedAmount)); setEditingAmount(true); }}><Pencil size={11} /> Edit</button>
            )}
          </>
        )}
      </div>

      {/* Totals strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>This month</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={totalThisMonth} /></div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>{paidRows.length} of {rows.length} member{rows.length !== 1 ? 's' : ''} met {money(expectedAmount)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>All time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={totalAll} /></div>
          <div style={{ fontSize: 11, color: tSub, marginTop: 4 }}>{rows.reduce((s, r) => s + r.monthlyCount, 0)} instalment{rows.reduce((s, r) => s + r.monthlyCount, 0) !== 1 ? 's' : ''} logged</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <MemberRows
          title={`Not paid this month (${unpaidRows.length})`} rows={unpaidRows} tint="#F5A623"
          canEdit={canEdit} onSelect={setHistoryId} onLog={openLog} card={card} tKey={tKey} tSub={tSub}
          emptyText="Everyone has paid their instalment this month." expectedAmount={expectedAmount}
        />
        <MemberRows
          title={`Paid this month (${paidRows.length})`} rows={paidRows} tint="#22C55E"
          canEdit={canEdit} onSelect={setHistoryId} onLog={openLog} card={card} tKey={tKey} tSub={tSub} expectedAmount={expectedAmount}
          emptyText="No one has paid an instalment this month yet."
        />
      </div>

      {rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '32px 20px', marginTop: 16 }}>
          <div style={{ fontSize: 13, color: tSub }}>No members yet — add one on the Members tab first.</div>
        </div>
      )}

      {/* Project baselines — each project's own required monthly due,
          recorded here too so it doesn't need a trip to that project's
          own page. Only projects a manager has set a baseline on show up. */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Boxes size={16} style={{ color: tSub }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: tKey, letterSpacing: '-.01em' }}>Project baselines</div>
            <div style={{ fontSize: 11.5, color: tSub }}>Each project&rsquo;s own required monthly due, owed by every member{canEdit ? ' — click a project’s name to update its amount' : ''}</div>
          </div>
        </div>
        {baselineRowsByProject.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: 12.5, color: tSub }}>No project has a baseline set yet — set one from that project&rsquo;s own page.</div>
          </div>
        ) : (
          <>
            {/* Filter — view one project's instalment list at a time instead
                of every baseline project stacked together. */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <FilterChip active={baselineFilter === 'all'} onClick={() => setBaselineFilter('all')} label={`All projects (${baselineRowsByProject.length})`} />
              {baselineRowsByProject.map(({ project }) => (
                <FilterChip key={project.id} active={baselineFilter === project.id} onClick={() => setBaselineFilter(project.id)} label={project.title} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {visibleBaselineRows.map(({ project, rows: bRows }) => {
              const paidCount = bRows.filter((r) => r.paidThisMonth).length;
              return (
                <div key={project.id} className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {editingBaselineId === project.id ? (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{project.title}</span>
                        <input className="fund-input" style={{ width: 110, height: 30 }} type="number" autoFocus value={baselineAmountInput} onChange={(e) => setBaselineAmountInput(e.target.value)} placeholder="0" />
                        <span style={{ fontSize: 11, color: tSub }}>/month per member</span>
                        <button className="fund-btn" style={{ height: 30 }} onClick={() => saveBaselineAmount(project)}><Check size={12} /></button>
                        <button className="fund-btn" style={{ height: 30 }} onClick={() => setEditingBaselineId(null)}><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        {canEdit ? (
                          <button
                            onClick={() => openEditBaselineAmount(project)}
                            title="Click to update this project's baseline amount"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: tKey, display: 'inline-flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0, textAlign: 'left' }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</span>
                            <Pencil size={11} style={{ color: tSub, flexShrink: 0 }} />
                          </button>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 800, color: tKey, flex: 1, minWidth: 0 }}>{project.title}</span>
                        )}
                        <span style={{ fontSize: 11, color: tSub }}>{money(project.baseline_monthly_amount)}/month per member</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: paidCount === bRows.length ? '#22C55E' : '#F5A623' }}>{paidCount} of {bRows.length} paid this month</span>
                      </>
                    )}
                  </div>
                  {bRows.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>No members yet.</div>
                  ) : (
                    bRows.map(({ member, total, paidThisMonth }) => (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(147,51,234,0.18)', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                          <div style={{ fontSize: 10.5 }}>
                            {paidThisMonth
                              ? <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={9} /> Paid this month</span>
                              : <span style={{ color: '#F5A623' }}>Not paid this month</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(total)}</div>
                        {canEdit && (
                          <button
                            onClick={() => openBaselineLog(project, member)}
                            title="Log this member's baseline for this project"
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(147,51,234,0.16)', color: '#9333EA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      {/* History modal */}
      <Modal isOpen={!!historyId} onClose={() => setHistoryId(null)} title={historyMember ? `${historyMember.name}'s instalments` : 'Instalments'} maxWidth="420px">
        {historyMember && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(48,108,236,0.18)', color: 'var(--color-accent-text, #7EB3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Repeat size={15} /></div>
              <div>
                {historyMember.contact && <div style={{ fontSize: 11.5, color: tSub, marginBottom: 1 }}>{historyMember.contact}</div>}
                <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={historyMember.monthlyTotal} /></div>
              </div>
            </div>
            {historyList.length === 0 ? (
              <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No instalments logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {historyList.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: tSub }}>{fmtDate(c.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{money(c.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Log an instalment — just the amount, for whoever's row was clicked */}
      <Modal isOpen={!!logOpen} onClose={() => setLogOpen(null)} title={`Log an instalment — ${logOpen?.name || ''}`} maxWidth="340px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Amount (KES)</span>
            <input className="fund-input" type="number" inputMode="decimal" autoFocus value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="10000" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Date</span>
            <input className="fund-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setLogOpen(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveLog} disabled={saving || !num(fAmount)}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Log a project baseline payment — same shape as logging a chama
          instalment above, just tagged to one project and member. */}
      <Modal
        isOpen={!!baselineLogFor}
        onClose={() => setBaselineLogFor(null)}
        title={baselineLogFor ? `Log a baseline payment — ${baselineLogFor.member.name} · ${baselineLogFor.project.title}` : 'Log a baseline payment'}
        maxWidth="380px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Amount (KES)</span>
            <input className="fund-input" type="number" inputMode="decimal" autoFocus value={bAmount} onChange={(e) => setBAmount(e.target.value)} placeholder="2000" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Date</span>
            <input className="fund-input" type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setBaselineLogFor(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveBaselineLog} disabled={saving || !num(bAmount)}>{saving ? 'Saving…' : 'Save'}</button>
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

function FilterChip({ active, onClick, label }) {
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: 700, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        background: active ? 'rgba(48,108,236,0.18)' : 'transparent',
        color: active ? 'var(--color-accent-text, #7EB3FF)' : tSub,
      }}
    >
      {label}
    </button>
  );
}

function MemberRows({ title, rows, tint, canEdit, onSelect, onLog, card, tKey, tSub, emptyText, expectedAmount }) {
  return (
    <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: tint, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{title}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>{emptyText}</div>
      ) : rows.map((m) => (
        <div
          key={m.id}
          onClick={() => onSelect(m.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
            {m.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
            <div style={{ fontSize: 10.5, color: tSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.paidThisMonth
                ? <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={10} /> Paid {fmtDate(m.lastPaidAt)}</span>
                : m.thisMonthTotal > 0
                  ? <span style={{ color: '#F5A623' }}>{money(m.thisMonthTotal)} of {money(expectedAmount)} this month</span>
                  : m.lastPaidAt ? `Last paid ${fmtDate(m.lastPaidAt)}` : 'No instalments yet'}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(m.monthlyTotal)}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}
            title="View instalment history"
            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Eye size={14} />
          </button>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onLog(m); }}
              title="Log an instalment for this member"
              style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: `${tint}22`, color: tint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
