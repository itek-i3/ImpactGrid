'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Boxes, MapPin, User, Lock, TrendingUp, Calendar } from 'lucide-react';

const SECTOR_TINT = { Services: '#5B9BFF', FMCG: '#F5A623', 'Real Estate': '#9B8CFF', Agriculture: '#4ECDC4' };

function scoreColor(pct) {
  if (pct === null || pct === undefined) return 'var(--color-text-muted)';
  if (pct >= 75) return '#16A36B';
  if (pct >= 50) return '#F5A623';
  return '#E0485A';
}

export default function AcquiredBusinessesPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const isAcr = isDemo || !!agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let evals = [];
        try {
          const raw = localStorage.getItem(`ig-${agencyId || 'guest'}-acq-evaluations`);
          evals = raw ? JSON.parse(raw) : [];
        } catch (_) {}
        if (!cancelled) { setEvaluations(evals); setLoading(false); }
        return;
      }
      if (!agencyId) { if (!cancelled) { setEvaluations([]); setLoading(false); } return; }
      const { data } = await createClient().from('acquisition_evaluations').select('id, data').eq('agency_id', agencyId);
      if (!cancelled) { setEvaluations((data || []).map(r => ({ ...(r.data || {}), id: r.id }))); setLoading(false); }
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`acq-biz-page:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acquisition_evaluations', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo]);

  const acquired = [...evaluations]
    .filter(ev => ev.dealState === 'acquired')
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14 };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>General Business is available to managers and admins in ACR.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <Boxes size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>General Business</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Businesses that closed through the acquisition pipeline — kept separate from the Portfolio Business</div>
          </div>
        </div>
        <button className="biz-btn ghost" onClick={() => setCurrentView('acquisition')}>Open Acquisition tab</button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 24 }}>Loading…</div>
      ) : acquired.length === 0 ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>None yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
            Mark a business&apos;s deal state as <strong>Acquired</strong> on the Acquisition tab and it&apos;ll show up here.
          </div>
          <button className="biz-btn primary" onClick={() => setCurrentView('acquisition')} style={{ margin: '0 auto' }}>Go to Acquisition</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {acquired.map(ev => {
            const tint = SECTOR_TINT[ev.sector] || '#5B9BFF';
            return (
              <div key={ev.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
                      {(ev.businessName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.businessName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {ev.sector || 'No sector'}{ev.ownerName ? ` · formerly ${ev.ownerName}'s` : ''}
                      </div>
                    </div>
                  </div>
                  {typeof ev.total === 'number' && (
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: scoreColor(ev.total), background: 'rgba(255,255,255,0.04)', padding: '3px 9px', borderRadius: 999 }}>
                      {ev.total}/100
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {ev.businessLocation && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={12} style={{ color: 'var(--color-text-tertiary)' }} /> {ev.businessLocation}</span>}
                  {ev.date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Calendar size={12} style={{ color: 'var(--color-text-tertiary)' }} /> Evaluated {ev.date}</span>}
                </div>

                <button
                  className="biz-btn ghost sm"
                  onClick={() => setCurrentView('valuation')}
                  style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                >
                  <TrendingUp size={12} /> Value this business
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .biz-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: .12s;
        }
        .biz-btn.sm { height: 30px; padding: 0 10px; font-size: 11.5px; border-radius: 8px; }
        .biz-btn:hover { border-color: var(--color-border-active); }
        .biz-btn.primary { background: linear-gradient(135deg,#1E4FB8,#306CEC); border: none; color: #fff; }
        .biz-btn.ghost { background: transparent; }
      `}</style>
    </div>
  );
}
