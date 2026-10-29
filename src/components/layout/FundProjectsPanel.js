'use client';

import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Boxes, Plus, Users, HeartHandshake, Wallet, Target, Repeat, Pencil, Check, X, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { MagicCard } from '@/components/magicui/magic-card';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  PROJECT_STATUSES, PROJECT_STATUS_BY_KEY, money, num, canEditFund, canDeleteFundProject, projectMemberRows, projectBaselineRows,
  byProjectMember, projectBaselineOf, projectBaselinePaidThisMonth, memberByLoginEmail,
  loadDemo, saveDemo, DEMO_PROJECTS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_MEMBERS_SEED, DEMO_CONTRIBUTORS_SEED, DEMO_PROJECT_PLEDGES_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function FundProjectsPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo } = useWorkspaceStore();
  const toast = useToast();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(agencies, activeAgencyId, isDemo);
  const canDelete = canDeleteFundProject(agencies, activeAgencyId, isDemo);
  const myId = isDemo ? 'demo-you' : userProfile?.id;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const pledgesKey = `demo-fund-pledges-${agencyId || 'x'}`;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;

  const [projects, setProjects] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [members, setMembers] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailId, setDetailId] = useState(null);
  const [detailTab, setDetailTab] = useState('goals');

  const [addOpen, setAddOpen] = useState(false);
  const [pTitle, setPTitle] = useState('');
  const [pSummary, setPSummary] = useState('');
  const [pStatus, setPStatus] = useState('active');
  const [pTarget, setPTarget] = useState('');
  const [pBaseline, setPBaseline] = useState('');
  const [pledgeAmounts, setPledgeAmounts] = useState({});
  const [saving, setSaving] = useState(false);

  const [pledgeEditFor, setPledgeEditFor] = useState(null); // project
  const [editPledgeAmounts, setEditPledgeAmounts] = useState({});
  const [baselinePledgeAmounts, setBaselinePledgeAmounts] = useState({});
  const [savingPledges, setSavingPledges] = useState(false);

  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineInput, setBaselineInput] = useState('');
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [editingMyPledge, setEditingMyPledge] = useState(false);
  const [myPledgeInput, setMyPledgeInput] = useState('');

  const [fundOpen, setFundOpen] = useState(null); // project
  const [fSourceType, setFSourceType] = useState('member');
  const [fSourceId, setFSourceId] = useState('');
  const [fCategory, setFCategory] = useState('project'); // 'project' (extra) | 'project_baseline'
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fNote, setFNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setPledges(loadDemo(pledgesKey, DEMO_PROJECT_PLEDGES_SEED));
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributors(DEMO_CONTRIBUTORS_SEED);
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: p }, { data: contribs }, { data: pl }, { data: mem }, { data: contribsList }] = await Promise.all([
        sb.from('fund_projects').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_project_pledges').select('*').eq('agency_id', agencyId),
        sb.from('fund_members').select('id, name, login_email').eq('agency_id', agencyId),
        sb.from('fund_contributors').select('id, type, name').eq('agency_id', agencyId),
      ]);
      if (cancelled) return;
      setProjects(p || []); setContributions(contribs || []);
      setPledges(pl || []);
      setMembers(mem || []);
      setContributors(contribsList || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-projects:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_project_pledges', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, projectsKey, contributionsKey, pledgesKey, membersKey]);

  const nameOf = (c) => {
    if (c.member_id) return members.find((m) => m.id === c.member_id)?.name || 'A member';
    if (c.contributor_id) return contributors.find((x) => x.id === c.contributor_id)?.name || 'A contributor';
    return 'Unknown';
  };

  const raisedByProjectId = useMemo(() => {
    const map = {};
    contributions.forEach((c) => { if (c.project_id) map[c.project_id] = (map[c.project_id] || 0) + num(c.amount); });
    return map;
  }, [contributions]);

  const totalRaisedAcrossProjects = useMemo(() => Object.values(raisedByProjectId).reduce((s, v) => s + v, 0), [raisedByProjectId]);
  const totalTarget = useMemo(() => projects.reduce((s, p) => s + (p.target_amount ? num(p.target_amount) : 0), 0), [projects]);
  const totalPledged = useMemo(() => pledges.reduce((s, pl) => s + num(pl.amount), 0), [pledges]);
  const activeCount = projects.filter((p) => p.status === 'active').length;

  // Which fund_members row is "me" — same match as My Profile: login_email,
  // never contact. Surfaces a "Your projects" rail above the full board so
  // a member sees their own stake first, not just the whole fund's list.
  const me = isDemo ? (members.find((m) => m.id === 'mem-you') || null) : memberByLoginEmail(members, userProfile?.email);
  const myProjectRows = useMemo(() => {
    if (!me) return [];
    return projects
      .map((p) => {
        const total = byProjectMember(contributions, p.id, me.id);
        const baseline = projectBaselineOf(contributions, p.id, me.id);
        const baselineDue = num(p.baseline_monthly_amount);
        return {
          project: p, total, extra: total - baseline, baselineDue,
          paidThisMonth: projectBaselinePaidThisMonth(contributions, p.id, me.id, p.baseline_monthly_amount),
        };
      })
      .filter((r) => r.total > 0 || r.baselineDue > 0)
      .sort((a, b) => b.total - a.total);
  }, [me, projects, contributions]);
  const myFirstName = me?.name?.split(' ')[0];
  const myTotal = useMemo(() => myProjectRows.reduce((s, r) => s + r.total, 0), [myProjectRows]);
  const myProjectIds = useMemo(() => new Set(myProjectRows.map((r) => r.project.id)), [myProjectRows]);

  const visible = statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter);
  const detail = projects.find((p) => p.id === detailId) || null;
  const detailExtraContributions = detail ? contributions.filter((c) => c.project_id === detail.id && c.category !== 'project_baseline') : [];
  const detailMemberRows = detail ? projectMemberRows(members, contributions, pledges, detail.id) : [];
  const myPledge = me && detail ? pledges.find((pl) => pl.project_id === detail.id && pl.member_id === me.id) : null;
  const detailBaselineRows = detail ? projectBaselineRows(members, contributions, detail) : [];
  const detailRaised = detail ? (raisedByProjectId[detail.id] || 0) : 0;
  const detailPct = detail?.target_amount ? Math.min(100, Math.round((detailRaised / detail.target_amount) * 100)) : null;
  const totalPledgedFor = (projectId) => pledges.filter((pl) => pl.project_id === projectId).reduce((s, pl) => s + num(pl.amount), 0);
  const openDetail = (id) => { setDetailId(id); setDetailTab('goals'); setEditingBaseline(false); setConfirmDeleteProject(false); setEditingMyPledge(false); };

  const resetAdd = () => { setPTitle(''); setPSummary(''); setPStatus('active'); setPTarget(''); setPBaseline(''); setPledgeAmounts({}); };

  const addProject = async () => {
    if (!pTitle.trim()) return;
    setSaving(true);
    const row = {
      title: pTitle.trim(), summary: pSummary.trim() || null, target_amount: pTarget ? num(pTarget) : null,
      baseline_monthly_amount: pBaseline ? num(pBaseline) : null, status: pStatus, created_by: myId,
    };
    const pledgeRows = Object.entries(pledgeAmounts).filter(([, v]) => num(v) > 0).map(([memberId, v]) => ({ member_id: memberId, amount: num(v) }));
    if (isDemo) {
      const projectId = `demo-${Date.now()}`;
      const next = [{ ...row, id: projectId }, ...projects];
      setProjects(next); saveDemo(projectsKey, next);
      if (pledgeRows.length) {
        const nextPledges = [...pledges, ...pledgeRows.map((pr, i) => ({ id: `demo-pl-${Date.now()}-${i}`, project_id: projectId, ...pr }))];
        setPledges(nextPledges); saveDemo(pledgesKey, nextPledges);
      }
      setSaving(false); setAddOpen(false); resetAdd();
      toast.success('Project added', row.title);
      return;
    }
    const { data: inserted, error } = await createClient().from('fund_projects').insert({ ...row, agency_id: agencyId }).select('id').single();
    if (error) { setSaving(false); toast.error('Could not add', error.message); return; }
    if (pledgeRows.length) {
      const { error: pErr } = await createClient().from('fund_project_pledges').insert(pledgeRows.map((pr) => ({ ...pr, project_id: inserted.id, agency_id: agencyId })));
      if (pErr) toast.error('Project added, but goals failed to save', pErr.message);
    }
    setSaving(false);
    setAddOpen(false); resetAdd();
    toast.success('Project added', row.title);
  };

  const openPledges = (project) => {
    const map = {};
    pledges.filter((pl) => pl.project_id === project.id).forEach((pl) => { map[pl.member_id] = String(pl.amount); });
    setEditPledgeAmounts(map);
    setBaselinePledgeAmounts(map);
    setPledgeEditFor(project);
  };

  // Writes only the rows the manager actually changed in this modal —
  // never a blanket delete-everything-then-reinsert. A member can set
  // their own goal via self-service (saveMyPledge below) at any time;
  // touching only the diff means a field the manager never looked at
  // can't clobber a concurrent edit of theirs.
  const savePledges = async () => {
    if (!pledgeEditFor) return;
    setSavingPledges(true);
    const projectId = pledgeEditFor.id;
    const memberIds = new Set([...Object.keys(editPledgeAmounts), ...Object.keys(baselinePledgeAmounts)]);
    const changedIds = [...memberIds].filter((id) => (editPledgeAmounts[id] || '') !== (baselinePledgeAmounts[id] || ''));
    const toUpsert = changedIds.filter((id) => num(editPledgeAmounts[id]) > 0).map((id) => ({ member_id: id, amount: num(editPledgeAmounts[id]) }));
    const toClear = changedIds.filter((id) => !num(editPledgeAmounts[id]));
    if (isDemo) {
      const next = pledges.filter((pl) => !(pl.project_id === projectId && toClear.includes(pl.member_id)));
      toUpsert.forEach((u) => {
        const idx = next.findIndex((pl) => pl.project_id === projectId && pl.member_id === u.member_id);
        if (idx >= 0) next[idx] = { ...next[idx], amount: u.amount };
        else next.push({ id: `demo-pl-${projectId}-${u.member_id}`, project_id: projectId, ...u });
      });
      setPledges(next); saveDemo(pledgesKey, next);
      setSavingPledges(false); setPledgeEditFor(null);
      toast.success('Goals updated');
      return;
    }
    const sb = createClient();
    if (toClear.length) {
      const { error: delErr } = await sb.from('fund_project_pledges').delete().eq('project_id', projectId).in('member_id', toClear);
      if (delErr) { setSavingPledges(false); toast.error('Could not save', delErr.message); return; }
    }
    if (toUpsert.length) {
      const { error } = await sb.from('fund_project_pledges')
        .upsert(toUpsert.map((u) => ({ ...u, project_id: projectId, agency_id: agencyId })), { onConflict: 'project_id,member_id' });
      if (error) { setSavingPledges(false); toast.error('Could not save', error.message); return; }
    }
    setSavingPledges(false); setPledgeEditFor(null);
    toast.success('Goals updated');
  };

  // A member setting their own goal — separate from the manager's bulk
  // "Set goals" above, which can still override it. Upserts just this one
  // (project, member) row rather than touching anyone else's.
  const saveMyPledge = async () => {
    if (!me || !detail) return;
    const amount = num(myPledgeInput);
    if (!amount) return;
    setEditingMyPledge(false);
    if (isDemo) {
      const others = pledges.filter((pl) => !(pl.project_id === detail.id && pl.member_id === me.id));
      const id = myPledge ? myPledge.id : `demo-pl-${detail.id}-${me.id}`;
      const next = [...others, { id, project_id: detail.id, member_id: me.id, amount }];
      setPledges(next); saveDemo(pledgesKey, next);
      toast.success('Goal saved', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_project_pledges')
      .upsert({ project_id: detail.id, member_id: me.id, amount, agency_id: agencyId }, { onConflict: 'project_id,member_id' });
    if (error) { toast.error('Could not save', error.message); return; }
    toast.success('Goal saved', money(amount));
  };

  const patchProject = async (id, patch) => {
    if (patch.status === 'completed') confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#5B9BFF', '#306CEC', '#22C55E', '#F5A623'] });
    if (isDemo) {
      const next = projects.map((p) => p.id === id ? { ...p, ...patch } : p);
      setProjects(next); saveDemo(projectsKey, next);
      return;
    }
    const { error } = await createClient().from('fund_projects').update(patch).eq('id', id);
    if (error) toast.error('Could not save', error.message);
  };

  const openEditBaseline = () => { setBaselineInput(detail?.baseline_monthly_amount ? String(num(detail.baseline_monthly_amount)) : ''); setEditingBaseline(true); };

  const saveBaseline = async () => {
    if (!detail) return;
    const next = baselineInput.trim() ? num(baselineInput) : null;
    setEditingBaseline(false);
    await patchProject(detail.id, { baseline_monthly_amount: next });
    toast.success(next ? 'Baseline set' : 'Baseline removed', next ? `${money(next)}/month, owed by every member` : undefined);
  };

  // Everything about a deleted project goes with it — every backer's
  // contribution to it (baseline or extra) is removed, not just unlinked,
  // and any goals set for it (fund_project_pledges) cascade-delete too.
  const removeProject = async (id) => {
    setConfirmDeleteProject(false);
    setDetailId(null);
    if (isDemo) {
      const nextProjects = projects.filter((p) => p.id !== id);
      setProjects(nextProjects); saveDemo(projectsKey, nextProjects);
      const nextContributions = contributions.filter((c) => c.project_id !== id);
      setContributions(nextContributions); saveDemo(contributionsKey, nextContributions);
      const nextPledges = pledges.filter((pl) => pl.project_id !== id);
      setPledges(nextPledges); saveDemo(pledgesKey, nextPledges);
      toast.success('Project deleted');
      return;
    }
    const { error } = await createClient().from('fund_projects').delete().eq('id', id);
    if (error) { toast.error('Could not delete', error.message); return; }
    toast.success('Project deleted');
  };

  const openFund = (project, opts = {}) => {
    setFundOpen(project);
    setFSourceType('member');
    setFSourceId(opts.memberId || '');
    setFCategory(opts.category || 'project');
    setFAmount(opts.category === 'project_baseline' ? String(num(project.baseline_monthly_amount)) : '');
    setFNote(''); setFDate(new Date().toISOString().slice(0, 10));
  };

  const saveFund = async () => {
    const amount = num(fAmount);
    if (!amount || !fSourceId || !fundOpen) return;
    const row = {
      member_id: fSourceType === 'member' ? fSourceId : null,
      contributor_id: fSourceType === 'contributor' ? fSourceId : null,
      category: fSourceType === 'member' ? fCategory : (contributors.find((c) => c.id === fSourceId)?.type === 'donor' ? 'donation' : 'investment'),
      project_id: fundOpen.id, amount, description: fNote.trim() || null, created_by: myId, created_at: new Date(fDate).toISOString(),
    };
    if (isDemo) {
      const next = [{ ...row, id: `demo-${Date.now()}` }, ...contributions];
      setContributions(next); saveDemo(contributionsKey, next);
      setFundOpen(null);
      toast.success('Contribution logged', money(amount));
      return;
    }
    const { error } = await createClient().from('fund_contributions').insert({ ...row, agency_id: agencyId });
    if (error) { toast.error('Could not save', error.message); return; }
    setFundOpen(null);
    toast.success('Contribution logged', money(amount));
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 18, padding: 18,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)', position: 'relative', overflow: 'hidden',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading projects…</div>;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <Boxes size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Projects</div>
            <div style={{ fontSize: 12.5, color: tSub }}>
              {myFirstName
                ? <>Hi {myFirstName} — here&rsquo;s what you&rsquo;re backing, and everything else you can back</>
                : <>What the fund is raising for, and who&rsquo;s backing each one</>}
            </div>
          </div>
        </div>
        {canEdit && (
          <ShimmerButton onClick={() => setAddOpen(true)} background="linear-gradient(135deg,#1E4FB8,#306CEC)" className="gap-2 text-[13px] font-bold">
            <Plus size={15} /> Add a project
          </ShimmerButton>
        )}
      </div>

      {/* Your projects — what this member is personally invested in, front
          and centre above the full board. */}
      {me && (
        <div className="dash-card" style={{ ...card, marginBottom: 18, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(145deg, rgba(91,155,255,0.30), rgba(91,155,255,0.10))',
              border: '1.5px solid rgba(91,155,255,0.4)', color: '#5B9BFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
            }}>
              {me.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: tKey }}>{myFirstName ? `${myFirstName}'s projects` : 'Your projects'}</div>
              {myProjectRows.length > 0 && <div style={{ fontSize: 10.5, color: tSub, marginTop: 1 }}>{money(myTotal)} put in across {myProjectRows.length} project{myProjectRows.length !== 1 ? 's' : ''}</div>}
            </div>
          </div>
          {myProjectRows.length === 0 ? (
            <div style={{ padding: '18px', fontSize: 12, color: tSub, fontStyle: 'italic' }}>You haven&rsquo;t backed a project yet — pick one below to get started.</div>
          ) : (
            <div>
              {myProjectRows.map((r) => (
                <div
                  key={r.project.id}
                  onClick={() => openDetail(r.project.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project.title}</div>
                    {r.baselineDue > 0 && (
                      <div style={{ fontSize: 10.5, marginTop: 2 }}>
                        {r.paidThisMonth
                          ? <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={9} /> Baseline paid this month</span>
                          : <span style={{ color: '#F5A623' }}>Owes {money(r.baselineDue)} baseline this month</span>}
                      </div>
                    )}
                  </div>
                  {r.extra > 0 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#9333EA', background: 'rgba(147,51,234,0.14)', borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      +{money(r.extra)} extra
                    </span>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(r.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats strip */}
      {projects.length > 0 && (
        <div className="dash-card" style={{ ...card, marginBottom: 18, padding: isMobile ? 14 : 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
            <ProjectStat label="Raised toward projects" value={totalRaisedAcrossProjects} prefix="KSh " Icon={Wallet} tint="#5B9BFF" />
            <ProjectStat label="Combined goal" value={totalTarget} prefix="KSh " Icon={Target} tint="#14B8A6" />
            <ProjectStat label="Active projects" value={activeCount} Icon={Boxes} tint="#F5A623" />
            <ProjectStat label="Member goals set" value={totalPledged} prefix="KSh " Icon={Users} tint="#9333EA" />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`All (${projects.length})`} />
        {PROJECT_STATUSES.map((s) => {
          const n = projects.filter((p) => p.status === s.key).length;
          if (!n) return null;
          return <Chip key={s.key} active={statusFilter === s.key} onClick={() => setStatusFilter(s.key)} label={`${s.label} (${n})`} tint={s.tint} />;
        })}
      </div>

      {/* Masonry board */}
      {visible.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '44px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: tKey, marginBottom: 6 }}>No projects here yet</div>
          <div style={{ fontSize: 12.5, color: tSub }}>{canEdit ? 'Add the first one to start raising for it.' : ''}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
          {visible.map((p) => {
            const st = PROJECT_STATUS_BY_KEY[p.status];
            const raised = raisedByProjectId[p.id] || 0;
            const pct = p.target_amount ? Math.min(100, Math.round((raised / p.target_amount) * 100)) : null;
            const backers = contributions.filter((c) => c.project_id === p.id);
            const backerPeople = [...new Map(backers.map((c) => {
              // A deleted member's old contribution has neither id set —
              // key it by the contribution's own id so each one still
              // counts as a distinct backer instead of collapsing onto a
              // single shared "c:undefined" entry.
              const key = c.member_id ? `m:${c.member_id}` : c.contributor_id ? `c:${c.contributor_id}` : `x:${c.id}`;
              return [key, { key, name: nameOf(c), isMember: !!c.member_id }];
            })).values()];
            const pledgedTotal = totalPledgedFor(p.id);
            return (
              <div key={p.id}>
                <MagicCard className="dash-card" style={{ ...card, padding: 14, borderRadius: 14, cursor: 'pointer' }} gradientColor={`${st?.tint || '#5B9BFF'}26`}>
                  <div onClick={() => openDetail(p.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: st?.tint, background: `${st?.tint}22`, borderRadius: 999, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{st?.label}</span>
                        {myProjectIds.has(p.id) && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#5B9BFF', background: 'rgba(91,155,255,0.16)', borderRadius: 999, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>You&rsquo;re backing this</span>
                        )}
                      </div>
                      {pct != null && <ProgressRing pct={pct} size={32} stroke={3} tint={st?.tint || '#5B9BFF'} />}
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: tKey, margin: '0 0 4px', letterSpacing: '-.01em', lineHeight: 1.3 }}>{p.title}</h3>
                    {p.summary && (
                      <div style={{ fontSize: 11.5, color: tSub, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.summary}
                      </div>
                    )}

                    <div style={{ fontSize: 16, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', marginBottom: 1 }}>{money(raised)}</div>
                    <div style={{ fontSize: 10.5, color: tSub, marginBottom: 10 }}>
                      {p.target_amount != null ? <>of {money(p.target_amount)} goal</> : 'raised so far'}
                    </div>

                    {(backerPeople.length > 0 || pledgedTotal > 0 || canEdit) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        {backerPeople.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexShrink: 0 }}>
                              {backerPeople.slice(0, 4).map((b, i) => (
                                <div
                                  key={b.key}
                                  title={b.name}
                                  style={{
                                    width: 19, height: 19, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 8.5, fontWeight: 800, color: '#fff', marginLeft: i === 0 ? 0 : -6, flexShrink: 0,
                                    background: b.isMember ? '#306CEC' : '#9333EA', border: '2px solid var(--color-bg-secondary, #080f1e)',
                                  }}
                                >
                                  {b.name.slice(0, 1).toUpperCase()}
                                </div>
                              ))}
                              {backerPeople.length > 4 && (
                                <div style={{ width: 19, height: 19, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: tSub, marginLeft: -6, flexShrink: 0, background: 'rgba(255,255,255,0.1)', border: '2px solid var(--color-bg-secondary, #080f1e)' }}>
                                  +{backerPeople.length - 4}
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: 10, color: tSub, marginLeft: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {backerPeople.length} backer{backerPeople.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : <span style={{ fontSize: 10, color: tSub, fontStyle: 'italic' }}>{canEdit ? 'No backers yet' : ''}</span>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {pledgedTotal > 0 && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#9333EA', background: 'rgba(147,51,234,0.14)', borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                              {money(pledgedTotal)} pledged
                            </span>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openFund(p); }}
                              title="Log a contribution to this project"
                              style={{
                                width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer', flexShrink: 0,
                                background: 'rgba(48,108,236,0.16)', color: 'var(--color-accent-text, #7EB3FF)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openDetail(p.id); setConfirmDeleteProject(true); }}
                              title="Delete this project"
                              style={{
                                width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer', flexShrink: 0,
                                background: 'rgba(239,68,68,0.16)', color: '#EF4444',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </MagicCard>
              </div>
            );
          })}
        </div>
      )}

      {/* Add project modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add a project" maxWidth="460px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Title"><input className="fund-input" value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="What is the project?" /></Field>
          <Field label="Summary"><textarea className="fund-input" rows={2} value={pSummary} onChange={(e) => setPSummary(e.target.value)} placeholder="What it is and the value it creates" /></Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: 6 }}>
              {PROJECT_STATUSES.filter((s) => s.key !== 'completed').map((s) => (
                <Chip key={s.key} active={pStatus === s.key} onClick={() => setPStatus(s.key)} label={s.label} tint={s.tint} />
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: tSub, marginTop: 4 }}>
              {pStatus === 'prospect' ? 'An idea being pitched — not yet raising, won’t show as something members owe toward.' : 'Raising now — shows up as an active goal members can back.'}
            </div>
          </Field>
          <Field label="Target amount (KES, optional)"><input className="fund-input" type="number" value={pTarget} onChange={(e) => setPTarget(e.target.value)} placeholder="180000" /></Field>
          <Field label="Monthly baseline per member (KES, optional)">
            <input className="fund-input" type="number" value={pBaseline} onChange={(e) => setPBaseline(e.target.value)} placeholder="2000" />
            <div style={{ fontSize: 10.5, color: tSub, marginTop: 4 }}>A required due every member owes this project each month, same as the chama&rsquo;s own instalment — leave blank if this project has no baseline.</div>
          </Field>
          <div>
            <span className="fund-label">Member goals (optional)</span>
            <div style={{ fontSize: 11, color: tSub, marginBottom: 8 }}>How much each member is expected to put in — leave blank for members not contributing.</div>
            <PledgeFields members={members} values={pledgeAmounts} onChange={(id, v) => setPledgeAmounts((prev) => ({ ...prev, [id]: v }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="fund-btn primary" onClick={addProject} disabled={saving || !pTitle.trim()}>{saving ? 'Saving…' : 'Add project'}</button>
          </div>
        </div>
      </Modal>

      {/* Edit member goals for an existing project */}
      <Modal isOpen={!!pledgeEditFor} onClose={() => setPledgeEditFor(null)} title={`Member goals — ${pledgeEditFor?.title || ''}`} maxWidth="420px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: tSub }}>How much each member is expected to put toward this project — leave blank for members not contributing.</div>
          <PledgeFields members={members} values={editPledgeAmounts} onChange={(id, v) => setEditPledgeAmounts((prev) => ({ ...prev, [id]: v }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setPledgeEditFor(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={savePledges} disabled={savingPledges}>{savingPledges ? 'Saving…' : 'Save goals'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      {detail && (
        <Modal isOpen onClose={() => setDetailId(null)} title={detail.title} maxWidth="560px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header: ring + status + raised/target */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {detailPct != null && <ProgressRing pct={detailPct} size={56} stroke={6} tint={PROJECT_STATUS_BY_KEY[detail.status]?.tint || '#5B9BFF'} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: PROJECT_STATUS_BY_KEY[detail.status]?.tint, background: `${PROJECT_STATUS_BY_KEY[detail.status]?.tint}22`, borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{PROJECT_STATUS_BY_KEY[detail.status]?.label}</span>
                  {canEdit && (
                    <select className="fund-input" style={{ width: 'auto', height: 26, fontSize: 11, marginLeft: 'auto' }} value={detail.status} onChange={(e) => patchProject(detail.id, { status: e.target.value })}>
                      {PROJECT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setConfirmDeleteProject(true)}
                      title="Delete this project"
                      style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.14)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: canEdit ? 0 : 'auto' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>
                  {money(detailRaised)}{detail.target_amount != null && <span style={{ fontSize: 13, color: tSub, fontWeight: 600 }}> of {money(detail.target_amount)}</span>}
                </div>
              </div>
            </div>
            {confirmDeleteProject && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 10, padding: '9px 12px' }}>
                <span style={{ fontSize: 11.5, color: '#EF4444', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>
                  Delete &ldquo;{detail.title}&rdquo;? Every backer&rsquo;s contribution to it and any goals set for it are deleted too. This can&rsquo;t be undone.
                </span>
                <button className="fund-btn" style={{ height: 30, fontSize: 11.5, background: 'linear-gradient(135deg,#B91C1C,#EF4444)', border: 'none', color: '#fff', flexShrink: 0 }} onClick={() => removeProject(detail.id)}>Delete</button>
                <button className="fund-btn" style={{ height: 30, fontSize: 11.5, flexShrink: 0 }} onClick={() => setConfirmDeleteProject(false)}>Cancel</button>
              </div>
            )}
            {detail.summary && <div style={{ fontSize: 13, color: tSub, lineHeight: 1.55 }}>{detail.summary}</div>}

            {/* Baseline rule — a required monthly due, owed by every member */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Repeat size={13} style={{ color: tSub, flexShrink: 0 }} />
              {editingBaseline ? (
                <>
                  <input className="fund-input" style={{ width: 120, height: 30 }} type="number" autoFocus value={baselineInput} onChange={(e) => setBaselineInput(e.target.value)} placeholder="0" />
                  <span style={{ fontSize: 11, color: tSub }}>/month per member</span>
                  <button className="fund-btn" style={{ height: 30 }} onClick={saveBaseline}><Check size={12} /></button>
                  <button className="fund-btn" style={{ height: 30 }} onClick={() => setEditingBaseline(false)}><X size={12} /></button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: tSub }}>
                    Baseline: <strong style={{ color: tKey }}>{detail.baseline_monthly_amount ? `${money(detail.baseline_monthly_amount)}/month` : 'None'}</strong>
                    {detail.baseline_monthly_amount ? ' per member' : ''}
                  </span>
                  {canEdit && (
                    <button className="fund-btn" style={{ height: 26, fontSize: 10.5 }} onClick={openEditBaseline}><Pencil size={10} /> Edit</button>
                  )}
                </>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--color-border)' }}>
              <TabButton active={detailTab === 'goals'} onClick={() => setDetailTab('goals')} label={`Member goals${detailMemberRows.length ? ` (${detailMemberRows.length})` : ''}`} />
              <TabButton active={detailTab === 'baseline'} onClick={() => setDetailTab('baseline')} label="Baseline" />
              <TabButton active={detailTab === 'extra'} onClick={() => setDetailTab('extra')} label={`Extra contributions${detailExtraContributions.length ? ` (${detailExtraContributions.length})` : ''}`} />
            </div>

            {detailTab === 'goals' ? (
              <div>
                {me && (
                  <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(91,155,255,0.08)', border: '1px solid rgba(91,155,255,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>Your goal</span>
                      {!editingMyPledge && (
                        <button
                          className="fund-btn" style={{ height: 26, fontSize: 10.5 }}
                          onClick={() => { setMyPledgeInput(myPledge ? String(myPledge.amount) : ''); setEditingMyPledge(true); }}
                        >
                          <Pencil size={10} /> {myPledge ? 'Edit' : 'Set a goal'}
                        </button>
                      )}
                    </div>
                    {editingMyPledge ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <input className="fund-input" style={{ height: 32 }} type="number" inputMode="decimal" autoFocus value={myPledgeInput} onChange={(e) => setMyPledgeInput(e.target.value)} placeholder="e.g. 20000" />
                        <button className="fund-btn" style={{ height: 32 }} onClick={saveMyPledge} disabled={!num(myPledgeInput)}><Check size={12} /></button>
                        <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingMyPledge(false)}><X size={12} /></button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        {myPledge ? (
                          <span style={{ fontSize: 15, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(myPledge.amount)}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>Not set yet — how much are you aiming to put toward this?</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button className="fund-btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => openPledges(detail)}><Plus size={12} /> Set everyone&rsquo;s goals</button>
                  </div>
                )}
                {detailMemberRows.length === 0 ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No member goals set for this project yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {detailMemberRows.map(({ member, pledged, contributed }) => {
                      const mPct = pledged ? Math.min(100, Math.round((contributed / pledged) * 100)) : null;
                      const isMe = member.id === me?.id;
                      return (
                        <div key={member.id} style={{ padding: '8px 10px', borderRadius: 9, background: isMe ? 'rgba(91,155,255,0.10)' : 'rgba(255,255,255,0.03)', border: isMe ? '1px solid rgba(91,155,255,0.25)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mPct != null ? 6 : 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>{member.name}{isMe && <span style={{ color: '#5B9BFF' }}> (you)</span>}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: tKey, fontVariantNumeric: 'tabular-nums' }}>
                              {money(contributed)}{pledged > 0 && <span style={{ color: tSub, fontWeight: 600 }}> / {money(pledged)}</span>}
                            </div>
                          </div>
                          {mPct != null && (
                            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${mPct}%`, background: mPct >= 100 ? '#22C55E' : 'linear-gradient(90deg,#1E4FB8,#5B9BFF)' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : detailTab === 'baseline' ? (
              <div>
                {!detail.baseline_monthly_amount ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No baseline set for this project — everyone just puts in whatever extra they choose.</div>
                ) : detailBaselineRows.length === 0 ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No members yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {detailBaselineRows.map(({ member, total, paidThisMonth }) => (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>{member.name}</div>
                          <div style={{ fontSize: 10.5, marginTop: 1 }}>
                            {paidThisMonth
                              ? <span style={{ color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={10} /> Paid this month</span>
                              : <span style={{ color: '#F5A623' }}>Not paid this month</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(total)}</div>
                        {canEdit && (
                          <button
                            onClick={() => openFund(detail, { memberId: member.id, category: 'project_baseline' })}
                            title="Log this member's baseline"
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.16)', color: '#22C55E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button className="fund-btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => openFund(detail)}><Plus size={12} /> Log contribution</button>
                  </div>
                )}
                <div style={{ fontSize: 11, color: tSub, marginBottom: 10 }}>Whatever extra a member chose to put in, plus every investor and donor backing this project — baseline dues live on their own tab.</div>
                {detailExtraContributions.length === 0 ? (
                  <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No one has put in anything extra yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {detailExtraContributions.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                        {c.member_id ? <Users size={13} style={{ color: '#5B9BFF', flexShrink: 0 }} /> : <HeartHandshake size={13} style={{ color: '#9333EA', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: tKey }}>{nameOf(c)}</div>
                          <div style={{ fontSize: 10.5, color: tSub }}>{fmtDate(c.created_at)}{c.description ? ` · ${c.description}` : ''}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Log a contribution to this project */}
      <Modal isOpen={!!fundOpen} onClose={() => setFundOpen(null)} title={`Log a contribution — ${fundOpen?.title || ''}`} maxWidth="420px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span className="fund-label">From</span>
            <select className="fund-input" value={fSourceType} onChange={(e) => { setFSourceType(e.target.value); setFSourceId(''); setFCategory('project'); }}>
              <option value="member">A member</option>
              <option value="contributor">An investor or donor</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <span className="fund-label">{fSourceType === 'member' ? 'Member' : 'Investor / donor'}</span>
            <select className="fund-input" value={fSourceId} onChange={(e) => setFSourceId(e.target.value)}>
              <option value="">Select…</option>
              {fSourceType === 'member'
                ? members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)
                : contributors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {fSourceType === 'member' && (
            <label style={{ display: 'block' }}>
              <span className="fund-label">What is this?</span>
              <select className="fund-input" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                <option value="project">Extra — completely their choice</option>
                <option value="project_baseline">Baseline due{fundOpen?.baseline_monthly_amount ? ` (${money(fundOpen.baseline_monthly_amount)}/month)` : ''}</option>
              </select>
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Amount (KES)</span>
              <input className="fund-input" type="number" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
            </label>
            <label style={{ display: 'block' }}>
              <span className="fund-label">Date</span>
              <input className="fund-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <span className="fund-label">Note (optional)</span>
            <input className="fund-input" value={fNote} onChange={(e) => setFNote(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="fund-btn" onClick={() => setFundOpen(null)}>Cancel</button>
            <button className="fund-btn primary" onClick={saveFund} disabled={!num(fAmount) || !fSourceId}>Save</button>
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
          display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 9px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; transition: .12s;
        }
        .fund-btn:hover { border-color: var(--color-border-active); }
        .fund-btn.primary { background: linear-gradient(135deg,#1E4FB8,#306CEC); border: none; color: #fff; }
        .fund-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Chip({ active, onClick, label, tint }) {
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: 700,
        background: active ? (tint ? `${tint}26` : 'rgba(48,108,236,0.18)') : 'transparent',
        color: active ? (tint || 'var(--color-accent-text, #7EB3FF)') : tSub,
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="fund-label">{label}</span>
      {children}
    </label>
  );
}

function ProgressRing({ pct, size = 40, stroke = 4, tint = '#5B9BFF' }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={clamped >= 100 ? '#22C55E' : tint} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .3s' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.26} fontWeight="800" fill="var(--color-text-primary, #E2EEFF)">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

function TabButton({ active, onClick, label }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 0', marginBottom: -1, border: 'none', borderBottom: active ? '2px solid #5B9BFF' : '2px solid transparent',
        background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
        color: active ? tKey : tSub,
      }}
    >
      {label}
    </button>
  );
}

function ProjectStat({ label, value, prefix = '', Icon, tint }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{prefix}<NumberTicker value={value} /></div>
      </div>
    </div>
  );
}

function PledgeFields({ members, values, onChange }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  if (!members.length) return <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>No members yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
      {members.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12.5, color: tKey, fontWeight: 600 }}>{m.name}</div>
          <input
            className="fund-input"
            type="number"
            placeholder="0"
            style={{ width: 120 }}
            value={values[m.id] || ''}
            onChange={(e) => onChange(m.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
