'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import ImgOrFallback from '@/components/ui/ImgOrFallback';
import { Trophy, TrendingUp, TrendingDown, Medal, Crown } from 'lucide-react';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const moneyK = (v) => { const n = Number(v) || 0; if (Math.abs(n) >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`; if (Math.abs(n) >= 1e3) return `KES ${Math.round(n / 1e3)}K`; return money(n); };

const METRICS = [
  { key: 'mProfit', label: 'Profit · month' },
  { key: 'mRev', label: 'Revenue · month' },
  { key: 'yRev', label: 'Revenue · year' },
];
const MEDAL = ['#F5C542', '#C9D4E3', '#CD8A56']; // gold / silver / bronze

export default function ScoreboardPanel() {
  const { agencies, activeAgencyId, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();

  const [now] = useState(() => new Date());
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yr = String(now.getFullYear());
  const prevYr = String(now.getFullYear() - 1);

  const [rowsByAgency, setRowsByAgency] = useState({}); // agency_id -> finance rows
  const [metric, setMetric] = useState('mProfit');
  const [loading, setLoading] = useState(true);

  const agencyIds = useMemo(() => (agencies || []).map((a) => a.id), [agencies]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemo || agencyIds.length === 0) { if (!cancelled) setLoading(false); return; }
      setLoading(true);
      const { data } = await createClient().from('daily_finance').select('agency_id, entry_date, revenue, expenses').in('agency_id', agencyIds);
      if (cancelled) return;
      const map = {};
      (data || []).forEach((r) => { (map[r.agency_id] ||= []).push(r); });
      setRowsByAgency(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [agencyIds, isDemo]);

  const scored = useMemo(() => {
    const list = (agencies || []).map((a) => {
      let mRev = 0, mExp = 0, yRev = 0, yExp = 0, pyRev = 0;
      (rowsByAgency[a.id] || []).forEach((r) => {
        const d = r.entry_date || '';
        const rev = Number(r.revenue) || 0, exp = Number(r.expenses) || 0;
        if (d.startsWith(ym)) { mRev += rev; mExp += exp; }
        if (d.startsWith(yr)) { yRev += rev; yExp += exp; }
        else if (d.startsWith(prevYr)) { pyRev += rev; }
      });
      const mProfit = mRev - mExp;
      return {
        id: a.id, name: a.name, logo_url: a.logo_url,
        mRev, mExp, mProfit, margin: mRev > 0 ? Math.round((mProfit / mRev) * 100) : null,
        yRev, yProfit: yRev - yExp, growth: pyRev > 0 ? Math.round(((yRev - pyRev) / pyRev) * 100) : null,
      };
    });
    return list.sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
  }, [agencies, rowsByAgency, metric, ym, yr, prevYr]);

  const leaderVal = scored.length ? (scored[0][metric] || 0) : 0;

  const tKey = 'var(--color-text-primary, #E2EEFF)';
  const tSub = 'var(--color-text-tertiary, #6C82A3)';
  const card = { background: 'var(--color-bg-elevated, rgba(255,255,255,0.03))', border: '1px solid var(--color-border-subtle, rgba(48,108,236,0.14))', borderRadius: 16 };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '16px 14px 60px' : '26px 36px 80px', color: tKey }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,197,66,0.14)', color: '#F5C542', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={22} /></div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>Agency scoreboard</h1>
          <div style={{ fontSize: 12.5, color: tSub }}>How the agencies in the group are performing against each other</div>
        </div>
      </div>

      {/* Metric toggle */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '18px 0 16px' }}>
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)} style={{ padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            color: metric === m.key ? '#0b1120' : '#9DB8DD', background: metric === m.key ? 'linear-gradient(135deg,#7EB3FF,#5B9BFF)' : 'var(--color-bg-elevated, rgba(255,255,255,0.04))',
            border: metric === m.key ? 'none' : '1px solid var(--color-border-subtle, rgba(48,108,236,0.2))' }}>{m.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: tSub, fontSize: 13 }}>Loading…</div>
      ) : scored.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: tSub, fontSize: 13 }}>No agencies to compare.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scored.map((a, i) => {
            const val = a[metric] || 0;
            const barPct = leaderVal > 0 ? Math.max(4, Math.round((val / leaderVal) * 100)) : 0;
            const medal = MEDAL[i];
            const isMe = a.id === activeAgencyId;
            return (
              <div key={a.id} style={{ ...card, padding: isMobile ? '14px 15px' : '16px 20px', position: 'relative', overflow: 'hidden',
                border: isMe ? '1px solid rgba(48,108,236,0.5)' : card.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 15 }}>
                  {/* Rank */}
                  <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: medal ? `${medal}22` : 'rgba(108,130,163,0.14)', color: medal || tSub, fontWeight: 800, fontSize: 16 }}>
                    {i === 0 ? <Crown size={19} /> : medal ? <Medal size={18} /> : i + 1}
                  </div>
                  {/* Logo + name */}
                  <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg,#1E4FB8,#306CEC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17, fontWeight: 800 }}>
                    <ImgOrFallback src={a.logo_url} fallback={(a.name || 'A').charAt(0).toUpperCase()} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: isMobile ? 15 : 16.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      {isMe && <span style={{ fontSize: 10, fontWeight: 800, color: '#7EB3FF', background: 'rgba(48,108,236,0.16)', padding: '2px 7px', borderRadius: 999 }}>YOU</span>}
                    </div>
                    {/* progress bar */}
                    <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 7, maxWidth: 320 }}>
                      <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 999, background: medal ? `linear-gradient(90deg, ${medal}99, ${medal})` : 'linear-gradient(90deg,#1E4FB8,#5B9BFF)' }} />
                    </div>
                  </div>
                  {/* Primary metric value */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: metric === 'mProfit' && val < 0 ? '#E0485A' : tKey }}>{moneyK(val)}</div>
                    {a.growth != null && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, marginTop: 3, color: a.growth < 0 ? '#E0485A' : '#22C55E' }}>
                        {a.growth < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}{a.growth > 0 ? '+' : ''}{a.growth}% YoY
                      </div>
                    )}
                  </div>
                </div>
                {/* secondary stats */}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: 22, marginTop: 12, paddingLeft: 53, fontSize: 12, color: tSub }}>
                    <span>Revenue <b style={{ color: tKey, fontWeight: 700 }}>{moneyK(a.mRev)}</b></span>
                    <span>Expenses <b style={{ color: tKey, fontWeight: 700 }}>{moneyK(a.mExp)}</b></span>
                    <span>Margin <b style={{ color: a.margin != null && a.margin < 0 ? '#E0485A' : tKey, fontWeight: 700 }}>{a.margin == null ? '—' : `${a.margin}%`}</b></span>
                    <span>{yr} revenue <b style={{ color: tKey, fontWeight: 700 }}>{moneyK(a.yRev)}</b></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11.5, color: tSub, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Medal size={13} /> Ranked by {METRICS.find((m) => m.key === metric)?.label.toLowerCase()}. Only agencies you belong to are shown.
      </div>
    </div>
  );
}
