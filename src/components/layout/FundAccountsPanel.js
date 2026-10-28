'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, ShieldAlert, HandCoins, Wallet, Boxes, Pencil, Check, X, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  money, num, canEditFund, loadDemo, saveDemo, byProject,
  reserveBalance, loansOpsBalance, opsReserveBalance, loanCapitalBalance, fundAccountBalance,
  DEMO_CONTRIBUTIONS_SEED, DEMO_SETTINGS_SEED, DEMO_LOANS_SEED, DEMO_LOAN_REPAYMENTS_SEED, DEMO_PROJECTS_SEED,
} from '@/lib/fund/shared';

// The member handbook's §5: money meant for one purpose is never used for
// another, so the fund keeps four separate ledgers. None of these balances
// is stored — each is derived live from fund_contributions (and, for Loans
// & Operations, fund_loans/fund_loan_repayments too) the same way every
// other total in ImpactFund is.
const ACCOUNTS_INFO = [
  {
    key: 'reserve', label: 'Reserve', tint: '#F5A623', Icon: ShieldAlert,
    filledBy: 'Membership contributions only, after setup costs',
    usedFor: 'Emergencies affecting the fund',
    neverFor: 'Projects or loans',
  },
  {
    key: 'loansOps', label: 'Loans & Operations', tint: '#22C55E', Icon: HandCoins,
    filledBy: 'The full monthly contribution, plus loan repayments',
    usedFor: 'Member loans and the fund’s running costs',
    neverFor: 'Projects',
  },
  {
    key: 'fund', label: 'Fund Account', tint: '#5B9BFF', Icon: Wallet,
    filledBy: 'Unearmarked investor & donor money only',
    usedFor: 'Bigger projects the fund invests in directly',
    neverFor: 'Loans, running costs, or the monthly contribution',
  },
];

export default function FundAccountsPanel() {
  const { workspace, activeAgencyId, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const toast = useToast();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const canEdit = canEditFund(userProfile, isDemo);
  const contributionsKey = `demo-fund-contributions-${agencyId || 'x'}`;
  const settingsKey = `demo-fund-settings-${agencyId || 'x'}`;
  const loansKey = `demo-fund-loans-${agencyId || 'x'}`;
  const repaymentsKey = `demo-fund-loan-repayments-${agencyId || 'x'}`;
  const projectsKey = `demo-fund-projects-${agencyId || 'x'}`;

  const [contributions, setContributions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingSettings, setEditingSettings] = useState(false);
  const [opsReserveInput, setOpsReserveInput] = useState('');
  const [setupInput, setSetupInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        setContributions(loadDemo(contributionsKey, DEMO_CONTRIBUTIONS_SEED));
        setSettings(loadDemo(settingsKey, DEMO_SETTINGS_SEED));
        setLoans(loadDemo(loansKey, DEMO_LOANS_SEED));
        setRepayments(loadDemo(repaymentsKey, DEMO_LOAN_REPAYMENTS_SEED));
        setProjects(loadDemo(projectsKey, DEMO_PROJECTS_SEED));
        setLoading(false);
        return;
      }
      if (!agencyId) { setLoading(false); return; }
      const sb = createClient();
      const [{ data: contribs }, { data: s }, { data: l }, { data: r }, { data: p }] = await Promise.all([
        sb.from('fund_contributions').select('*').eq('agency_id', agencyId),
        sb.from('fund_settings').select('*').eq('agency_id', agencyId).maybeSingle(),
        sb.from('fund_loans').select('*').eq('agency_id', agencyId),
        sb.from('fund_loan_repayments').select('*').eq('agency_id', agencyId),
        sb.from('fund_projects').select('id, title, status').eq('agency_id', agencyId),
      ]);
      if (cancelled) return;
      setContributions(contribs || []);
      setSettings(s || DEMO_SETTINGS_SEED);
      setLoans(l || []); setRepayments(r || []);
      setProjects(p || []);
      setLoading(false);
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`fund-accounts:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_contributions', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_settings', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loans', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_loan_repayments', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_projects', filter: `agency_id=eq.${agencyId}` }, () => !cancelled && load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, contributionsKey, settingsKey, loansKey, repaymentsKey, projectsKey]);

  const balances = useMemo(() => ({
    reserve: reserveBalance(contributions, settings),
    loansOps: loansOpsBalance(contributions, loans, repayments, settings),
    loanCapital: loanCapitalBalance(contributions, loans, repayments, settings),
    opsReserve: opsReserveBalance(contributions, settings),
    fund: fundAccountBalance(contributions),
  }), [contributions, loans, repayments, settings]);

  const projectRows = useMemo(() => projects
    .map((p) => ({ ...p, balance: byProject(contributions, p.id) }))
    .filter((p) => p.balance > 0)
    .sort((a, b) => b.balance - a.balance), [projects, contributions]);
  const projectTotal = projectRows.reduce((s, p) => s + p.balance, 0);

  const openEditSettings = () => {
    setOpsReserveInput(String(num(settings?.loans_ops_reserve_pct ?? 0)));
    setSetupInput(String(num(settings?.setup_costs)));
    setEditingSettings(true);
  };

  const saveSettings = async () => {
    const next = { ...settings, loans_ops_reserve_pct: Math.min(100, Math.max(0, num(opsReserveInput))), setup_costs: Math.max(0, num(setupInput)) };
    setEditingSettings(false);
    setSettings(next);
    if (isDemo) { saveDemo(settingsKey, next); return; }
    const { error } = await createClient().from('fund_settings').upsert({ agency_id: agencyId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
    if (error) toast.error('Could not save', error.message);
  };

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = {
    background: 'linear-gradient(160deg, rgba(30,79,184,0.12), rgba(255,255,255,0.02) 70%)',
    border: '1px solid rgba(91,155,255,0.16)', borderRadius: 18, padding: 18,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)', position: 'relative', overflow: 'hidden',
  };

  if (loading) return <div style={{ textAlign: 'center', color: tSub, fontSize: 12.5, padding: 60 }}>Loading accounts…</div>;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '14px 16px 40px' : '16px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14B8A6' }}>
          <Layers size={22} />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tKey, letterSpacing: '-.02em' }}>Accounts</div>
          <div style={{ fontSize: 12.5, color: tSub }}>Four ledgers — money meant for one purpose is never used for another</div>
        </div>
      </div>

      {/* Split rules */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {editingSettings ? (
          <>
            <RuleField label="Held for operations" value={opsReserveInput} onChange={setOpsReserveInput} suffix="% of Loans & Ops" />
            <RuleField label="Setup costs" value={setupInput} onChange={setSetupInput} suffix="KES" />
            <button className="fund-btn" style={{ height: 32 }} onClick={saveSettings}><Check size={13} /></button>
            <button className="fund-btn" style={{ height: 32 }} onClick={() => setEditingSettings(false)}><X size={13} /></button>
          </>
        ) : (
          <>
            <RuleStat label="Operations reserve" value={`${num(settings?.loans_ops_reserve_pct ?? 0)}% of Loans & Ops held back`} />
            <RuleStat label="Setup costs" value={money(settings?.setup_costs)} />
            {canEdit && (
              <button className="fund-btn" style={{ height: 28, fontSize: 11, marginLeft: 'auto' }} onClick={openEditSettings}><Pencil size={11} /> Edit rules</button>
            )}
          </>
        )}
      </div>

      {/* Three ledger accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {ACCOUNTS_INFO.map((a) => {
          const balance = balances[a.key];
          return (
            <div key={a.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${a.tint}22`, color: a.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <a.Icon size={16} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: tKey }}>{a.label}</div>
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, color: balance < 0 ? '#EF4444' : tKey, fontVariantNumeric: 'tabular-nums', marginBottom: a.key === 'loansOps' ? 10 : 14 }}>
                KSh <NumberTicker value={Math.round(Math.abs(balance))} />{balance < 0 && <span style={{ fontSize: 12, fontWeight: 700 }}> short</span>}
              </div>
              {a.key === 'loansOps' && (
                <div style={{ display: 'flex', gap: 14, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Available to lend</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(balances.loanCapital)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Held for operations</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums' }}>{money(balances.opsReserve)}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <InfoRow label="Filled by" text={a.filledBy} />
                <InfoRow label="Used for" text={a.usedFor} />
                <InfoRow label="Never used for" text={a.neverFor} warn />
              </div>
            </div>
          );
        })}
      </div>

      {/* Project accounts */}
      <div className="dash-card" style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(147,51,234,0.16)', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Boxes size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: tKey }}>Project accounts</div>
            <div style={{ fontSize: 10.5, color: tSub }}>One ledger per project — that project&rsquo;s contributions, for that project only</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(projectTotal)}</div>
          <button
            onClick={() => setCurrentView('fundProjects')}
            title="Open Projects"
            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: tSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
        {projectRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: tSub, fontSize: 12.5, fontStyle: 'italic' }}>No project has any money in yet.</div>
        ) : (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {projectRows.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--color-divider, rgba(255,255,255,0.06))' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: tKey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: tSub, textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.status}</span>
                <div style={{ fontSize: 13, fontWeight: 800, color: tKey, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(p.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

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
      `}</style>
    </div>
  );
}

function InfoRow({ label, text, warn }) {
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, color: warn ? '#EF4444' : tSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: warn ? '#EF4444' : 'var(--color-text-secondary, #9FB3D1)', lineHeight: 1.4 }}>{text}</div>
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
        <input className="fund-input" style={{ width: 80, height: 32 }} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{suffix}</span>
      </div>
    </label>
  );
}
