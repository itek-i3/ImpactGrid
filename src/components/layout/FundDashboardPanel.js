'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Boxes, Wallet, HeartHandshake, Trophy, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { DotPattern } from '@/components/magicui/dot-pattern';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, canEditFund, totalOf, raisedByType, topContributors, isPaidMember, loadDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTORS_SEED, DEMO_PROJECTS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_SETTINGS_SEED,
} from '@/lib/fund/shared';

export default function FundDashboardPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(userProfile, isDemo);
  const agencyName = agencies?.find((a) => a.id === activeAgencyId)?.name || 'ImpactFund';
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const contributorsKey = `demo-fund-contributors-${agencyId || 'x'}`;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;

  const [contributions, setContributions] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setContributors(loadDemo(contributorsKey, DEMO_CONTRIBUTORS_SEED));
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: contribs }, { data: c }, { data: p }, { data: m }, { data: s }] = await Promise.all([
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_contributors').select('id, type, name').eq('agency_id', agencyId),
        sb.from('fund_projects').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
        sb.from('fund_members').select('id, name').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
      ]);
      if (cancelled) return;
      setContributions(contribs || []); setContributors(c || []); setProjects(p || []); setMembers(m || []);
      setSettings(s || { membership_fee: 5000 });
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-dashboard:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributors', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_members', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, contributionsKey, contributorsKey, projectsKey, membersKey, settingsKey]);

  const totalRaised = useMemo(() => totalOf(contributions), [contributions]);
  const raised = useMemo(() => raisedByType(contributions), [contributions]);
  const leaders = useMemo(() => (canEdit ? topContributors(contributions, members, contributors, 3) : []), [contributions, members, contributors, canEdit]);
  const paidMemberCount = useMemo(() => members.filter((m) => isPaidMember(contributions, m.id, settings?.membership_fee)).length, [members, contributions, settings]);
  const raisedByProjectId = useMemo(() => {
    const map = {};
    contributions.forEach((c) => { if (c.project_id) map[c.project_id] = (map[c.project_id] || 0) + num(c.amount); });
    return map;
  }, [contributions]);
  const activeProjects = projects.filter((p) => p.status === 'active');

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 20, padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading ImpactFund…</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Hero */}
      <div className="dash-card" style={{ ...card, position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
        <DotPattern className="[mask-image:radial-gradient(400px_circle_at_top_right,white,transparent)]" style={{ color: 'rgba(91,155,255,0.35)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent-text, #7EB3FF)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
            {agencyName}
          </div>
          <h1 style={{ fontSize: isMobile ? 22 : 27, fontWeight: 800, color: tKey, margin: '0 0 6px', letterSpacing: '-.02em' }}>
            Members, investors and donors — one fund, one money trail.
          </h1>
          <div style={{ fontSize: 13, color: tSub, maxWidth: 560, lineHeight: 1.5, marginBottom: 20 }}>
            Every shilling in is tracked back to who gave it and, where it applies, which project it&rsquo;s backing.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
            <StatTile label="Total raised" value={totalRaised} prefix="KSh " Icon={Wallet} tint="#5B9BFF" />
            <StatTile label="Projects" value={projects.length} Icon={Boxes} tint="#14B8A6" />
            <StatTile label="Investors & donors" value={contributors.length} Icon={HeartHandshake} tint="#9333EA" />
            <StatTile label="Members" value={paidMemberCount} Icon={Users} tint="#F5A623" />
          </div>
        </div>
      </div>

      {/* Money trail */}
      <div className="dash-card" style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(48,108,236,0.18)', color: 'var(--color-accent-text, #7EB3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={16} />
          </div>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Where the money&rsquo;s coming from</h2>
        </div>
        <MoneyBar segments={[
          { label: 'Members', value: raised.members, tint: '#5B9BFF' },
          { label: 'Investors', value: raised.investors, tint: '#9333EA' },
          { label: 'Donors', value: raised.donors, tint: '#EC4899' },
          // A deleted member's old contributions — their money stays in
          // the fund's history, just without a name attached to it.
          ...(raised.other > 0 ? [{ label: 'Other', value: raised.other, tint: '#6C82A3' }] : []),
        ]} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Active projects */}
        <div className="dash-card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Active projects</h2>
            <button onClick={() => setCurrentView('fundProjects')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-text, #7EB3FF)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
              See all <ArrowRight size={12} />
            </button>
          </div>
          {activeProjects.length === 0 ? (
            <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>Nothing raising right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeProjects.slice(0, 5).map((p) => {
                const r = raisedByProjectId[p.id] || 0;
                const pct = p.target_amount ? Math.min(100, Math.round((r / p.target_amount) * 100)) : null;
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                      <span style={{ fontSize: 11.5, color: tSub, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(r)}{p.target_amount != null ? ` / ${money(p.target_amount)}` : ''}</span>
                    </div>
                    {pct != null && (
                      <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#1E4FB8,#5B9BFF)' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top contributors */}
        <div className="dash-card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="card-icon-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(245,166,35,0.18)', color: 'var(--color-warning-text, #F5A623)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy size={16} />
            </div>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, color: tKey, margin: 0, letterSpacing: '-.01em' }}>Top contributors</h2>
          </div>
          {!canEdit ? (
            <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>Visible to managers.</div>
          ) : leaders.length === 0 ? (
            <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>No contributions logged yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaders.map((l, i) => (
                <div key={`${l.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{['🥇', '🥈', '🥉'][i] || '•'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'capitalize' }}>{l.type}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(l.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MoneyBar({ segments }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const total = segments.reduce((s, seg) => s + num(seg.value), 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 12 }}>
        {total === 0 ? <div style={{ flex: 1 }} /> : segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} style={{ flex: s.value, background: s.tint }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tSub }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.tint, flexShrink: 0 }} />
            {s.label} · <strong style={{ color: tKey, fontWeight: 700 }}>{money(s.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, prefix = '', Icon, tint }) {
  const tKey = 'var(--color-text-primary, #E2EEFF)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary, #6C82A3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{prefix}<NumberTicker value={value} /></div>
      </div>
    </div>
  );
}
