'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Building2, Plus, Pencil, Trash2, X, MapPin, User, Lock, Wallet } from 'lucide-react';

const SECTORS = ['Services', 'FMCG', 'Real Estate', 'Agriculture'];
const DOMAINS = ['Laundromat', 'Car Wash', 'Salon / Spa', 'Restaurant', 'Water Center', 'Shortlet / Short-stay', 'Land', 'Agriculture', 'Retail Shop', 'Water ATM', 'Other'];
const SECTOR_TINT = { Services: '#5B9BFF', FMCG: '#F5A623', 'Real Estate': '#9B8CFF', Agriculture: '#4ECDC4' };
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default function BusinessesPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const isAcr = isDemo || !!agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));

  const [businesses, setBusinesses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState('');
  const [fSector, setFSector] = useState('Services');
  const [fDomain, setFDomain] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fHandler, setFHandler] = useState('');

  const demoKey = `demo-biz-${agencyId || 'x'}`;

  // Members (for the "handled by" suggestions)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo || !workspaceId) return;
      try {
        const res = await fetch(`/os/api/workspaces/${workspaceId}/chat-members`);
        if (res.ok) { const j = await res.json(); if (!cancelled && j.data) setMembers(j.data); }
      } catch (_) {}
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId, isDemo]);

  // Businesses + realtime
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(demoKey); list = raw ? JSON.parse(raw) : []; } catch (_) {}
        if (!cancelled) { setBusinesses(list); setLoading(false); }
        return;
      }
      if (!agencyId) { if (!cancelled) { setBusinesses([]); setLoading(false); } return; }
      const { data } = await createClient().from('businesses').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
      if (!cancelled) { setBusinesses(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`biz-page:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, demoKey]);

  const persistDemo = (next) => { setBusinesses(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const openNew = () => {
    setEditingId(null);
    setFName(''); setFSector('Services'); setFDomain(''); setFLocation(''); setFHandler('');
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditingId(b.id);
    setFName(b.name || ''); setFSector(b.sector || 'Services'); setFDomain(b.domain || '');
    setFLocation(b.location || ''); setFHandler(b.handler || '');
    setConfirmDeleteId(null);
    setModalOpen(true);
  };

  const save = async () => {
    const name = fName.trim();
    if (!name) return;
    if (!isDemo && !agencyId) return;
    setSaving(true);
    const base = {
      agency_id: agencyId, name,
      sector: fSector || null, domain: fDomain.trim() || null,
      location: fLocation.trim() || null, handler: fHandler.trim() || null,
    };
    if (isDemo) {
      if (editingId) persistDemo(businesses.map(b => b.id === editingId ? { ...b, ...base } : b));
      else persistDemo([...businesses, { ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      setSaving(false); setModalOpen(false); return;
    }
    try {
      const sb = createClient();
      if (editingId) {
        const { data } = await sb.from('businesses').update(base).eq('id', editingId).select('*').maybeSingle();
        if (data) setBusinesses(prev => prev.map(b => b.id === data.id ? data : b));
      } else {
        const { data, error } = await sb.from('businesses').insert({ ...base, created_by: isUuid(currentUserId) ? currentUserId : null }).select('*').maybeSingle();
        if (error) console.error('[businesses] insert failed:', error.message);
        if (data) setBusinesses(prev => [...prev, data]);
      }
      setModalOpen(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setConfirmDeleteId(null);
    if (isDemo) { persistDemo(businesses.filter(b => b.id !== id)); return; }
    setBusinesses(prev => prev.filter(b => b.id !== id));
    try { await createClient().from('businesses').delete().eq('id', id); } catch (_) {}
  };

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>Businesses are available to managers and admins in ACR.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      <datalist id="biz-domains">{DOMAINS.map(d => <option key={d} value={d} />)}</datalist>
      <datalist id="biz-handlers">{members.map(m => <option key={m.id} value={m.full_name || m.email} />)}</datalist>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B9BFF' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Businesses</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Create and manage the businesses you track finances for</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="biz-btn ghost" onClick={() => setCurrentView('finance')}><Wallet size={14} /> Daily Finance</button>
          <button className="biz-btn primary" onClick={openNew}><Plus size={15} /> New business</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 24 }}>Loading…</div>
      ) : businesses.length === 0 ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>No businesses yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>Add your first business — it’ll appear in the Daily Finance switcher.</div>
          <button className="biz-btn primary" onClick={openNew} style={{ margin: '0 auto' }}><Plus size={15} /> New business</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {businesses.map(b => {
            const tint = SECTOR_TINT[b.sector] || '#5B9BFF';
            return (
              <div key={b.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${tint}22`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
                      {(b.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {b.domain || 'No domain'}{b.sector ? ` · ${b.sector}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="biz-icon" title="Edit" onClick={() => openEdit(b)}><Pencil size={13} /></button>
                    <button className="biz-icon" title="Delete" onClick={() => setConfirmDeleteId(b.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {b.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={12} style={{ color: 'var(--color-text-tertiary)' }} /> {b.location}</span>}
                  {b.handler && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><User size={12} style={{ color: 'var(--color-text-tertiary)' }} /> {b.handler}</span>}
                </div>

                {confirmDeleteId === b.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(224,72,90,0.10)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, padding: '7px 10px' }}>
                    <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600, flex: 1 }}>Delete “{b.name}” and all its finance entries?</span>
                    <button className="biz-btn danger sm" onClick={() => remove(b.id)}>Delete</button>
                    <button className="biz-btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg-elevated, #0d1b38)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{editingId ? 'Edit business' : 'New business'}</div>
              <button className="biz-icon" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <label style={lbl}>Business name *</label>
            <input className="biz-input" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Sunshine Laundromat" autoFocus />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Sector / Industry</label>
                <select className="biz-input" value={fSector} onChange={e => setFSector(e.target.value)}>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Domain</label>
                <input className="biz-input" list="biz-domains" value={fDomain} onChange={e => setFDomain(e.target.value)} placeholder="e.g. Laundromat" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Location</label>
                <input className="biz-input" value={fLocation} onChange={e => setFLocation(e.target.value)} placeholder="e.g. Westlands, Nairobi" />
              </div>
              <div>
                <label style={lbl}>Handled by</label>
                <input className="biz-input" list="biz-handlers" value={fHandler} onChange={e => setFHandler(e.target.value)} placeholder="Who runs it" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="biz-btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="biz-btn primary" onClick={save} disabled={!fName.trim() || saving}><Plus size={14} /> {editingId ? 'Save changes' : 'Create business'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .biz-input {
          width: 100%; height: 38px; padding: 0 12px; border-radius: 10px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
        }
        .biz-input::placeholder { color: var(--color-text-tertiary); }
        .biz-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .biz-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: .12s;
        }
        .biz-btn.sm { height: 30px; padding: 0 10px; font-size: 11.5px; border-radius: 8px; }
        .biz-btn:hover { border-color: var(--color-border-active); }
        .biz-btn.primary { background: linear-gradient(135deg,#1E4FB8,#306CEC); border: none; color: #fff; }
        .biz-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
        .biz-btn.ghost { background: transparent; }
        .biz-btn.danger { background: #E0485A; border: none; color: #fff; }
        .biz-icon {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
          color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: .12s;
        }
        .biz-icon:hover { color: var(--color-text-primary); border-color: var(--color-border-active); }
      `}</style>
    </div>
  );
}
