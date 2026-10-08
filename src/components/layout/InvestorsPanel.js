'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { Landmark, Plus, Pencil, Trash2, X, Lock, User, Mail, Phone, Globe, MapPin, Search } from 'lucide-react';

const INVESTOR_TYPES = ['VC', 'PE', 'Angel Investor', 'DFI', 'Family Office', 'Bank', 'Grant / Donor', 'Other'];
const SECTOR_SUGGESTIONS = ['SMEs', 'Agriculture', 'FMCG', 'Real Estate', 'Services', 'Technology', 'Healthcare', 'Education', 'Manufacturing', 'Financial Services'];
const STAGE_FOCUS = ['Pre-seed', 'Seed', 'Early-stage', 'Growth-stage', 'Mature', 'Any stage'];
const CURRENCIES = ['USD', 'KES'];
const STATUSES = [
  { value: 'prospect',  label: 'Prospect',  col: '#8A94A6' },
  { value: 'contacted', label: 'Contacted', col: '#306CEC' },
  { value: 'in_talks',  label: 'In Talks',  col: '#F5A623' },
  { value: 'committed', label: 'Committed', col: '#9B8CFF' },
  { value: 'invested',  label: 'Invested',  col: '#16A36B' },
  { value: 'passed',    label: 'Passed',    col: '#E0485A' },
];
const statusInfo = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function formatShortMoney(value, currency) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const sym = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh ' : `${currency} `;
  const abs = Math.abs(n);
  let short;
  if (abs >= 1_000_000) short = `${+(n / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) short = `${+(n / 1_000).toFixed(1)}K`;
  else short = `${n}`;
  return `${sym}${short}`;
}

function ticketLabel(min, max, currency) {
  const lo = formatShortMoney(min, currency);
  const hi = formatShortMoney(max, currency);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return null;
}

export default function InvestorsPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const workspaceId = workspace?.id;
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const isAcr = isDemo || !!agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));

  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [fName, setFName] = useState('');
  const [fNameError, setFNameError] = useState(false);
  const [fType, setFType] = useState('');
  const [fSector, setFSector] = useState('');
  const [fStage, setFStage] = useState('');
  const [fTicketMin, setFTicketMin] = useState('');
  const [fTicketMax, setFTicketMax] = useState('');
  const [fCurrency, setFCurrency] = useState('USD');
  const [fGeography, setFGeography] = useState('');
  const [fStatus, setFStatus] = useState('prospect');
  const [fContactName, setFContactName] = useState('');
  const [fContactEmail, setFContactEmail] = useState('');
  const [fContactPhone, setFContactPhone] = useState('');
  const [fWebsite, setFWebsite] = useState('');
  const [fNotes, setFNotes] = useState('');

  const demoKey = `demo-investors-${agencyId || 'x'}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(demoKey); list = raw ? JSON.parse(raw) : []; } catch (_) {}
        if (!cancelled) { setInvestors(list); setLoading(false); }
        return;
      }
      if (!agencyId) { if (!cancelled) { setInvestors([]); setLoading(false); } return; }
      const { data } = await createClient().from('potential_investors').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
      if (!cancelled) { setInvestors(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`investors-page:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potential_investors', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, demoKey]);

  const persistDemo = (next) => { setInvestors(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const resetForm = () => {
    setFName(''); setFType(''); setFSector(''); setFStage(''); setFTicketMin(''); setFTicketMax('');
    setFCurrency('USD'); setFGeography(''); setFStatus('prospect');
    setFContactName(''); setFContactEmail(''); setFContactPhone(''); setFWebsite(''); setFNotes('');
    setFNameError(false);
  };

  const openNew = () => { setEditingId(null); resetForm(); setModalOpen(true); };
  const openEdit = (inv) => {
    setEditingId(inv.id);
    setFName(inv.name || ''); setFType(inv.investor_type || ''); setFSector(inv.sector || ''); setFStage(inv.stage_focus || '');
    setFTicketMin(inv.ticket_min ?? ''); setFTicketMax(inv.ticket_max ?? ''); setFCurrency(inv.ticket_currency || 'USD');
    setFGeography(inv.geography || ''); setFStatus(inv.status || 'prospect');
    setFContactName(inv.contact_name || ''); setFContactEmail(inv.contact_email || ''); setFContactPhone(inv.contact_phone || '');
    setFWebsite(inv.website || ''); setFNotes(inv.notes || '');
    setFNameError(false);
    setConfirmDeleteId(null);
    setModalOpen(true);
  };

  const save = async () => {
    const name = fName.trim();
    if (!name) { setFNameError(true); return; }
    setFNameError(false);
    if (!isDemo && !agencyId) return;
    setSaving(true);
    const base = {
      agency_id: agencyId, name,
      investor_type: fType.trim() || null, sector: fSector.trim() || null, stage_focus: fStage.trim() || null,
      ticket_min: fTicketMin === '' ? null : Number(fTicketMin), ticket_max: fTicketMax === '' ? null : Number(fTicketMax),
      ticket_currency: fCurrency, geography: fGeography.trim() || null, status: fStatus,
      contact_name: fContactName.trim() || null, contact_email: fContactEmail.trim() || null, contact_phone: fContactPhone.trim() || null,
      website: fWebsite.trim() || null, notes: fNotes.trim() || null,
    };
    if (isDemo) {
      if (editingId) persistDemo(investors.map(i => i.id === editingId ? { ...i, ...base } : i));
      else persistDemo([...investors, { ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      setSaving(false); setModalOpen(false); return;
    }
    try {
      const sb = createClient();
      if (editingId) {
        const { data } = await sb.from('potential_investors').update({ ...base, updated_by: isUuid(currentUserId) ? currentUserId : null }).eq('id', editingId).select('*').maybeSingle();
        if (data) setInvestors(prev => prev.map(i => i.id === data.id ? data : i));
      } else {
        const { data, error } = await sb.from('potential_investors').insert({ ...base, created_by: isUuid(currentUserId) ? currentUserId : null }).select('*').maybeSingle();
        if (error) console.error('[potential_investors] insert failed:', error.message);
        if (data) setInvestors(prev => [...prev, data]);
      }
      setModalOpen(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setConfirmDeleteId(null);
    if (isDemo) { persistDemo(investors.filter(i => i.id !== id)); return; }
    setInvestors(prev => prev.filter(i => i.id !== id));
    try { await createClient().from('potential_investors').delete().eq('id', id); } catch (_) {}
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return investors
      .filter(i => statusFilter === 'all' || (i.status || 'prospect') === statusFilter)
      .filter(i => !q || `${i.name} ${i.sector || ''} ${i.investor_type || ''} ${i.contact_name || ''}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }, [investors, search, statusFilter]);

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>Investors is available to managers and admins in ACR.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      <datalist id="inv-types">{INVESTOR_TYPES.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id="inv-sectors">{SECTOR_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <Landmark size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Investors</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Track potential investors for the businesses ACR manages</div>
          </div>
        </div>
        <button className="biz-btn primary" onClick={openNew}><Plus size={15} /> New investor</button>
      </div>

      {/* Toolbar */}
      {investors.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input
              className="biz-input" style={{ paddingLeft: 32 }}
              placeholder="Search investors…" value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="biz-input" style={{ width: isMobile ? '100%' : 170 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 24 }}>Loading…</div>
      ) : investors.length === 0 ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>No investors yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>Add the first potential investor to start building your pipeline.</div>
          <button className="biz-btn primary" onClick={openNew} style={{ margin: '0 auto' }}><Plus size={15} /> New investor</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5 }}>
          No investors match the current search/filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {rows.map(inv => {
            const st = statusInfo(inv.status);
            const ticket = ticketLabel(inv.ticket_min, inv.ticket_max, inv.ticket_currency);
            return (
              <div key={inv.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${st.col}22`, color: st.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
                      {(inv.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {inv.investor_type || 'No type'}{inv.sector ? ` · ${inv.sector}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="biz-icon" title="Edit" onClick={() => openEdit(inv)}><Pencil size={13} /></button>
                    <button className="biz-icon" title="Delete" onClick={() => setConfirmDeleteId(inv.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: `${st.col}1C`, border: `1px solid ${st.col}44`, color: st.col, fontSize: 10.5, fontWeight: 700 }}>
                    {st.label}
                  </span>
                  {ticket && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)', fontSize: 10.5, fontWeight: 700 }}>
                      Ticket: {ticket}
                    </span>
                  )}
                  {inv.stage_focus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-tertiary)', fontSize: 10.5, fontWeight: 700 }}>
                      {inv.stage_focus}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {inv.contact_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><User size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {inv.contact_name}</span>}
                  {inv.contact_email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis' }}><Mail size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {inv.contact_email}</span>}
                  {inv.contact_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Phone size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {inv.contact_phone}</span>}
                  {inv.geography && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {inv.geography}</span>}
                  {inv.website && (
                    <a href={inv.website.startsWith('http') ? inv.website : `https://${inv.website}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-link, #5B9BFF)', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                      <Globe size={12} style={{ flexShrink: 0 }} /> {inv.website}
                    </a>
                  )}
                </div>

                {inv.notes && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-text-tertiary)', lineHeight: 1.5, borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
                    {inv.notes}
                  </div>
                )}

                {confirmDeleteId === inv.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(224,72,90,0.10)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, padding: '7px 10px' }}>
                    <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600, flex: 1 }}>Delete “{inv.name}”?</span>
                    <button className="biz-btn danger sm" onClick={() => remove(inv.id)}>Delete</button>
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
            style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg-elevated, #0d1b38)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{editingId ? 'Edit investor' : 'New investor'}</div>
              <button className="biz-icon" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <label style={lbl}>Investor name *</label>
            <input
              className={`biz-input${fNameError ? ' error' : ''}`}
              value={fName}
              onChange={e => { setFName(e.target.value); if (fNameError) setFNameError(false); }}
              placeholder="e.g. Dinao Capital"
              aria-required="true"
              aria-invalid={fNameError}
              autoFocus
            />
            {fNameError && <div className="biz-field-error">Investor name is required.</div>}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Investor type</label>
                <input className="biz-input" list="inv-types" value={fType} onChange={e => setFType(e.target.value)} placeholder="e.g. VC, Angel, DFI" />
              </div>
              <div>
                <label style={lbl}>Investing sector</label>
                <input className="biz-input" list="inv-sectors" value={fSector} onChange={e => setFSector(e.target.value)} placeholder="e.g. SMEs" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Ticket size</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
                <input className="biz-input" type="number" inputMode="decimal" value={fTicketMin} onChange={e => setFTicketMin(e.target.value)} placeholder="Min (e.g. 0)" />
                <input className="biz-input" type="number" inputMode="decimal" value={fTicketMax} onChange={e => setFTicketMax(e.target.value)} placeholder="Max (e.g. 500000)" />
                <select className="biz-input" value={fCurrency} onChange={e => setFCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Stage focus</label>
                <select className="biz-input" value={fStage} onChange={e => setFStage(e.target.value)}>
                  <option value="">Not specified</option>
                  {STAGE_FOCUS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Geography focus</label>
                <input className="biz-input" value={fGeography} onChange={e => setFGeography(e.target.value)} placeholder="e.g. East Africa" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Pipeline status</label>
              <select className="biz-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
              <label style={lbl}>Point of contact</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <input className="biz-input" value={fContactName} onChange={e => setFContactName(e.target.value)} placeholder="Contact name" />
                <input className="biz-input" type="tel" value={fContactPhone} onChange={e => setFContactPhone(e.target.value)} placeholder="Phone" />
              </div>
              <input className="biz-input" style={{ marginTop: 10 }} type="email" value={fContactEmail} onChange={e => setFContactEmail(e.target.value)} placeholder="Email" />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Website</label>
              <input className="biz-input" value={fWebsite} onChange={e => setFWebsite(e.target.value)} placeholder="e.g. dinaocapital.com" />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Notes</label>
              <textarea className="biz-input" style={{ height: 72, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="How you connected, what they've said, next steps…" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="biz-btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="biz-btn primary" onClick={save} disabled={saving}><Plus size={14} /> {editingId ? 'Save changes' : 'Add investor'}</button>
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
        .biz-input.error { border-color: var(--color-error); background: var(--color-error-bg); }
        .biz-input.error:focus { box-shadow: 0 0 0 3px var(--color-error-bg); }
        .biz-field-error { font-size: 11.5px; color: var(--color-error); margin-top: 5px; font-weight: 600; }
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
