'use client';

import { useEffect, useMemo, useState } from 'react';
import { Repeat, Boxes, Check, IdCard } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, memberByLoginEmail, monthKeyOf, monthlyPaidThisMonth, projectBaselinePaidThisMonth, loadDemo,
  DEMO_MEMBERS_SEED, DEMO_CONTRIBUTIONS_SEED, DEMO_PROJECTS_SEED, DEMO_SETTINGS_SEED,
} from '@/lib/fund/shared';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const thisMonthKey = () => new Date().toISOString().slice(0, 7);

// A member's own instalment tracker — every monthly due they personally
// carry, in one place: the chama's own monthly contribution, plus each
// project's baseline due once that project has one. Scoped to just this
// person (never the full member roster, which stays manager-only) —
// resolved the same way My Profile and Projects do, by matching this
// account's login email against fund_members.login_email.
export default function FundMyInstallmentsPanel() {
  const { workspace, activeAgencyId, userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const membersKey = `demo-fund-members-${agencyId || 'x'}`;
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setMembers(loadDemo(membersKey, DEMO_MEMBERS_SEED));
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: m }, { data: contribs }, { data: p }, { data: s }] = await Promise.all([
        sb.from('fund_members').select('id, name, login_email').eq('agency_id', agencyId),
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title, baseline_monthly_amount').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
      ]);
      if (cancelled) return;
      setMembers(m || []); setContributions(contribs || []); setProjects(p || []);
      setSettings(s || DEMO_SETTINGS_SEED);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-my-installments:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, membersKey, contributionsKey, projectsKey, settingsKey]);

  const me = isDemo ? (members.find((m) => m.id === 'mem-you') || null) : memberByLoginEmail(members, userProfile?.email);
  const expectedMonthly = num(settings?.monthly_contribution_amount);

  const chama = useMemo(() => {
    if (!me) return null;
    const history = contributions.filter((c) => c.member_id === me.id && c.category === 'monthly').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const thisMonthTotal = history.filter((c) => monthKeyOf(c.created_at) === thisMonthKey()).reduce((s, c) => s + num(c.amount), 0);
    const paidThisMonth = monthlyPaidThisMonth(thisMonthTotal, expectedMonthly);
    const monthsMet = new Set(history.filter((c) => !expectedMonthly || num(c.amount) >= expectedMonthly).map((c) => monthKeyOf(c.created_at))).size;
    return { history, total: history.reduce((s, c) => s + num(c.amount), 0), thisMonthTotal, paidThisMonth, monthsMet };
  }, [me, contributions, expectedMonthly]);

  const projectDues = useMemo(() => {
    if (!me) return [];
    return projects
      .filter((p) => num(p.baseline_monthly_amount) > 0)
      .map((p) => {
        const required = num(p.baseline_monthly_amount);
        const history = contributions.filter((c) => c.project_id === p.id && c.member_id === me.id && c.category === 'project_baseline').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const monthsMet = new Set(history.filter((c) => num(c.amount) >= required).map((c) => monthKeyOf(c.created_at))).size;
        return {
          project: p, required, history, total: history.reduce((s, c) => s + num(c.amount), 0), monthsMet,
          paidThisMonth: projectBaselinePaidThisMonth(contributions, p.id, me.id, required),
        };
      });
  }, [me, projects, contributions]);

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 18, padding: 18,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading your instalments…</div>;

  if (!me) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px', background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <IdCard size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: tKey, marginBottom: 6 }}>You&rsquo;re not linked to a member record yet</div>
          <div style={{ fontSize: 12.5, color: tSub, lineHeight: 1.5 }}>Ask your fund manager to add you on the Members tab and link it to <strong style={{ color: tKey }}>{userProfile?.email || 'your account email'}</strong> — once that&rsquo;s done, your instalments show up here.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
          <Repeat size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>My Instalments</div>
          <div style={{ fontSize: 12.5, color: tSub }}>Every monthly due you carry — the chama contribution and each project&rsquo;s baseline — with full history</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Chama monthly contribution */}
        <InstalmentCard
          icon={<Repeat size={16} />} iconTint="#5B9BFF" title="Chama monthly contribution"
          subtitle={expectedMonthly > 0 ? `${money(expectedMonthly)} expected each month` : 'No fixed amount set yet'}
          total={chama.total} monthsMet={chama.monthsMet}
          paidThisMonth={chama.paidThisMonth}
          owedThisMonth={expectedMonthly > 0 ? Math.max(0, expectedMonthly - chama.thisMonthTotal) : 0}
          history={chama.history}
          emptyText="No chama instalments logged yet."
          card={card} tKey={tKey} tSub={tSub}
        />

        {/* Project baselines */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Boxes size={15} style={{ color: tSub }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Project baselines</span>
          </div>
          {projectDues.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 12.5, color: tSub, fontStyle: 'italic' }}>You don&rsquo;t owe a baseline on any project right now.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projectDues.map((d) => (
                <InstalmentCard
                  key={d.project.id}
                  icon={<Boxes size={16} />} iconTint="#9333EA" title={d.project.title}
                  subtitle={`${money(d.required)} baseline due each month`}
                  total={d.total} monthsMet={d.monthsMet}
                  paidThisMonth={d.paidThisMonth}
                  owedThisMonth={d.paidThisMonth ? 0 : d.required}
                  history={d.history}
                  emptyText="No baseline payments logged yet for this project."
                  card={card} tKey={tKey} tSub={tSub}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InstalmentCard({ icon, iconTint, title, subtitle, total, monthsMet, paidThisMonth, owedThisMonth, history, emptyText, card, tKey, tSub }) {
  return (
    <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `${iconTint}22`, color: iconTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontSize: 10.5, color: tSub }}>{subtitle}</div>
        </div>
        {paidThisMonth ? (
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.14)', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Check size={10} /> Paid this month
          </span>
        ) : (
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#F5A623', background: 'rgba(245,166,35,0.14)', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {owedThisMonth > 0 ? `Owes ${money(owedThisMonth)}` : 'Not paid this month'}
          </span>
        )}
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Total paid</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>KSh <NumberTicker value={total} /></div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Months met in full</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{monthsMet}</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Payment history</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: tSub, fontStyle: 'italic' }}>{emptyText}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {history.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: 12, color: tSub }}>{fmtDate(c.created_at)}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-success-text, #22C55E)', fontVariantNumeric: 'tabular-nums' }}>+{money(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
