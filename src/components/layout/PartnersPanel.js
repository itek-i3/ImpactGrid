'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { HeartHandshake, Plus, Pencil, Trash2, X, Lock, User, Mail, Phone, Globe, MapPin, Search, Link2, Eye, ChevronLeft } from 'lucide-react';
import { focusFirstError } from '@/lib/utils/formErrors';

const ORG_TYPES = ['Corporate', 'NGO / Non-profit', 'Government', 'Foundation', 'Academic Institution', 'Media', 'Startup', 'Other'];
const CATEGORIES = ['Strategic Partner', 'Event Sponsor', 'Media Partner', 'Community Partner', 'Vendor / Supplier', 'Other'];
const PRIORITIES = [
  { value: 'high',   label: 'High',   col: '#E0485A' },
  { value: 'medium', label: 'Medium', col: '#F5A623' },
  { value: 'low',    label: 'Low',    col: '#8A94A6' },
];
const STATUSES = [
  { value: 'prospective',    label: 'Prospective',    col: '#8A94A6' },
  { value: 'in_discussion',  label: 'In Discussion',  col: '#306CEC' },
  { value: 'active',         label: 'Active',         col: '#16A36B' },
  { value: 'on_hold',        label: 'On Hold',        col: '#F5A623' },
  { value: 'lapsed',         label: 'Lapsed',         col: '#9B8CFF' },
  { value: 'ended',          label: 'Ended',          col: '#E0485A' },
];
const statusInfo = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];
const priorityInfo = (v) => PRIORITIES.find(p => p.value === v) || null;
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const websiteHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const has = (v) => (v ?? '').toString().trim().length > 0;

// Read-only detail view for one partner — opened by clicking its card.
function PartnerDetail({ p, onBack, onEdit, onDeleteClick, confirming, onConfirmDelete, onCancelDelete }) {
  const st = statusInfo(p.status);
  const pr = priorityInfo(p.priority);
  const facts = [
    ['Website', p.website, true],
    ['Location', p.location],
    ['Contact person', p.contact_name],
    ['Mobile phone', p.contact_phone],
    ['Email', p.contact_email],
    ['LinkedIn', p.linkedin, true],
    ['Relationship owner', p.relationship_owner],
  ].filter(([, v]) => has(v));

  return (
    <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20 }}>
      <button className="ptn-btn ghost sm" onClick={onBack} style={{ marginBottom: 16 }}><ChevronLeft size={14} /> Back to partners</button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: `${st.col}22`, color: st.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
            {(p.name || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)' }}>{p.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {p.org_type || 'No type'}{p.industry ? ` · ${p.industry}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="ptn-btn" onClick={onEdit}><Pencil size={14} /> Edit</button>
          <button className="ptn-btn danger" onClick={onDeleteClick}><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: `${st.col}1C`, border: `1px solid ${st.col}44`, color: st.col, fontSize: 10.5, fontWeight: 700 }}>
          {st.label}
        </span>
        {pr && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: `${pr.col}1C`, border: `1px solid ${pr.col}44`, color: pr.col, fontSize: 10.5, fontWeight: 700 }}>
            {pr.label} priority
          </span>
        )}
        {p.category && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-tertiary)', fontSize: 10.5, fontWeight: 700 }}>
            {p.category}
          </span>
        )}
      </div>

      {confirming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, background: 'rgba(224,72,90,0.10)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, padding: '7px 10px' }}>
          <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600, flex: 1 }}>Delete “{p.name}”?</span>
          <button className="ptn-btn danger sm" onClick={onConfirmDelete}>Delete</button>
          <button className="ptn-btn ghost sm" onClick={onCancelDelete}>Cancel</button>
        </div>
      )}

      {facts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px 24px', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border-subtle)' }}>
          {facts.map(([label, value, isLink]) => (
            <div key={label}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
              {isLink ? (
                <a href={websiteHref(value)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, color: 'var(--color-text-link, #5B9BFF)', textDecoration: 'none', overflowWrap: 'anywhere' }}>{value}</a>
              ) : (
                <div style={{ fontSize: 13.5, color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}>{value}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartnersPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const currentUserId = userProfile?.id || (isDemo ? 'demo-current-user' : '');
  const isI3x = isDemo || !!(agencies?.find(a => a.id === activeAgencyId)?.slug === 'i3x-africa');
  const canAccess = isDemo || (isI3x && ['manager', 'superadmin'].includes(userProfile?.role));

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [fName, setFName] = useState('');
  const [fNameError, setFNameError] = useState(false);
  const [fOrgType, setFOrgType] = useState('');
  const [fWebsite, setFWebsite] = useState('');
  const [fContactName, setFContactName] = useState('');
  const [fContactEmail, setFContactEmail] = useState('');
  const [fLinkedin, setFLinkedin] = useState('');
  const [fContactPhone, setFContactPhone] = useState('');
  const [fIndustry, setFIndustry] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fRelationshipOwner, setFRelationshipOwner] = useState('');
  const [fStatus, setFStatus] = useState('prospective');

  const demoKey = `demo-partners-${agencyId || 'x'}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try { const raw = localStorage.getItem(demoKey); list = raw ? JSON.parse(raw) : []; } catch (_) {}
        if (!cancelled) { setPartners(list); setLoading(false); }
        return;
      }
      if (!agencyId) { if (!cancelled) { setPartners([]); setLoading(false); } return; }
      const { data } = await createClient().from('i3x_partners').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
      if (!cancelled) { setPartners(data || []); setLoading(false); }
    }
    load();
    if (isDemo || !agencyId) return () => { cancelled = true; };
    const sb = createClient();
    const ch = sb.channel(`partners-page:${agencyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'i3x_partners', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, [agencyId, isDemo, demoKey]);

  const persistDemo = (next) => { setPartners(next); try { localStorage.setItem(demoKey, JSON.stringify(next)); } catch (_) {} };

  const resetForm = () => {
    setFName(''); setFOrgType(''); setFWebsite(''); setFContactName(''); setFContactEmail('');
    setFLinkedin(''); setFContactPhone(''); setFIndustry(''); setFLocation(''); setFCategory('');
    setFPriority(''); setFRelationshipOwner(''); setFStatus('prospective');
    setFNameError(false);
  };

  const openNew = () => { setEditingId(null); resetForm(); setModalOpen(true); };
  const openEdit = (p) => {
    setViewingId(null);
    setEditingId(p.id);
    setFName(p.name || ''); setFOrgType(p.org_type || ''); setFWebsite(p.website || '');
    setFContactName(p.contact_name || ''); setFContactEmail(p.contact_email || ''); setFLinkedin(p.linkedin || '');
    setFContactPhone(p.contact_phone || ''); setFIndustry(p.industry || ''); setFLocation(p.location || '');
    setFCategory(p.category || ''); setFPriority(p.priority || ''); setFRelationshipOwner(p.relationship_owner || '');
    setFStatus(p.status || 'prospective');
    setFNameError(false);
    setConfirmDeleteId(null);
    setModalOpen(true);
  };

  const save = async () => {
    const name = fName.trim();
    if (!name) { setFNameError(true); focusFirstError(); return; }
    setFNameError(false);
    if (!isDemo && !agencyId) return;
    setSaving(true);
    const base = {
      agency_id: agencyId, name,
      org_type: fOrgType.trim() || null, website: fWebsite.trim() || null,
      contact_name: fContactName.trim() || null, contact_email: fContactEmail.trim() || null,
      linkedin: fLinkedin.trim() || null, contact_phone: fContactPhone.trim() || null,
      industry: fIndustry.trim() || null, location: fLocation.trim() || null,
      category: fCategory.trim() || null, priority: fPriority || null,
      relationship_owner: fRelationshipOwner.trim() || null, status: fStatus,
    };
    if (isDemo) {
      if (editingId) persistDemo(partners.map(p => p.id === editingId ? { ...p, ...base } : p));
      else persistDemo([...partners, { ...base, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      setSaving(false); setModalOpen(false); return;
    }
    try {
      const sb = createClient();
      if (editingId) {
        const { data } = await sb.from('i3x_partners').update({ ...base, updated_by: isUuid(currentUserId) ? currentUserId : null }).eq('id', editingId).select('*').maybeSingle();
        if (data) setPartners(prev => prev.map(p => p.id === data.id ? data : p));
      } else {
        const { data, error } = await sb.from('i3x_partners').insert({ ...base, created_by: isUuid(currentUserId) ? currentUserId : null }).select('*').maybeSingle();
        if (error) console.error('[i3x_partners] insert failed:', error.message);
        if (data) setPartners(prev => [...prev, data]);
      }
      setModalOpen(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setConfirmDeleteId(null);
    setViewingId(v => (v === id ? null : v));
    if (isDemo) { persistDemo(partners.filter(p => p.id !== id)); return; }
    setPartners(prev => prev.filter(p => p.id !== id));
    try { await createClient().from('i3x_partners').delete().eq('id', id); } catch (_) {}
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners
      .filter(p => statusFilter === 'all' || (p.status || 'prospective') === statusFilter)
      .filter(p => !q || `${p.name} ${p.industry || ''} ${p.org_type || ''} ${p.contact_name || ''} ${p.category || ''}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }, [partners, search, statusFilter]);

  const viewing = viewingId ? partners.find(p => p.id === viewingId) : null;

  const card = { background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 14 };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block' };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Lock size={24} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>Partners & Sponsors is available to managers and admins in i3x Africa.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '8px 4px 40px' }}>
      <datalist id="ptn-org-types">{ORG_TYPES.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id="ptn-categories">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>

      {viewing ? (
        <PartnerDetail
          p={viewing}
          onBack={() => setViewingId(null)}
          onEdit={() => openEdit(viewing)}
          onDeleteClick={() => setConfirmDeleteId(viewing.id)}
          confirming={confirmDeleteId === viewing.id}
          onConfirmDelete={() => remove(viewing.id)}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      ) : (
      <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-text, #5B9BFF)' }}>
            <HeartHandshake size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Partners & Sponsors</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Track organisations i3x Africa is partnering or sponsoring with</div>
          </div>
        </div>
        <button className="ptn-btn primary" onClick={openNew}><Plus size={15} /> New partner</button>
      </div>

      {/* Toolbar */}
      {partners.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input
              className="ptn-input" style={{ paddingLeft: 32 }}
              placeholder="Search partners…" value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="ptn-input" style={{ width: isMobile ? '100%' : 170 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5, padding: 24 }}>Loading…</div>
      ) : partners.length === 0 ? (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>No partners yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>Add the first partner or sponsor to start building your roster.</div>
          <button className="ptn-btn primary" onClick={openNew} style={{ margin: '0 auto' }}><Plus size={15} /> New partner</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5 }}>
          No partners match the current search/filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {rows.map(p => {
            const st = statusInfo(p.status);
            const pr = priorityInfo(p.priority);
            return (
              <div key={p.id} style={{ ...card, padding: 16, cursor: 'pointer' }} onClick={() => setViewingId(p.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${st.col}22`, color: st.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {p.org_type || 'No type'}{p.industry ? ` · ${p.industry}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="ptn-icon" title="View" onClick={(e) => { e.stopPropagation(); setViewingId(p.id); }}><Eye size={13} /></button>
                    <button className="ptn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil size={13} /></button>
                    <button className="ptn-icon" title="Delete" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: `${st.col}1C`, border: `1px solid ${st.col}44`, color: st.col, fontSize: 10.5, fontWeight: 700 }}>
                    {st.label}
                  </span>
                  {pr && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: `${pr.col}1C`, border: `1px solid ${pr.col}44`, color: pr.col, fontSize: 10.5, fontWeight: 700 }}>
                      {pr.label} priority
                    </span>
                  )}
                  {p.category && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-tertiary)', fontSize: 10.5, fontWeight: 700 }}>
                      {p.category}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {p.contact_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><User size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {p.contact_name}</span>}
                  {p.contact_email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis' }}><Mail size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {p.contact_email}</span>}
                  {p.contact_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Phone size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {p.contact_phone}</span>}
                  {p.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} /> {p.location}</span>}
                  {p.linkedin && (
                    <a href={websiteHref(p.linkedin)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-link, #5B9BFF)', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                      <Link2 size={12} style={{ flexShrink: 0 }} /> LinkedIn
                    </a>
                  )}
                  {p.website && (
                    <a href={websiteHref(p.website)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-link, #5B9BFF)', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                      <Globe size={12} style={{ flexShrink: 0 }} /> {p.website}
                    </a>
                  )}
                </div>

                {p.relationship_owner && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
                    Owned by <b style={{ color: 'var(--color-text-secondary)' }}>{p.relationship_owner}</b>
                  </div>
                )}

                {confirmDeleteId === p.id && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(224,72,90,0.10)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, padding: '7px 10px' }}>
                    <span style={{ fontSize: 11.5, color: '#E0485A', fontWeight: 600, flex: 1 }}>Delete “{p.name}”?</span>
                    <button className="ptn-btn danger sm" onClick={() => remove(p.id)}>Delete</button>
                    <button className="ptn-btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg-elevated, #0d1b38)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{editingId ? 'Edit partner' : 'New partner'}</div>
              <button className="ptn-icon" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <label style={lbl}>Organization name *</label>
            <input
              className={`ptn-input${fNameError ? ' error' : ''}`}
              value={fName}
              onChange={e => { setFName(e.target.value); if (fNameError) setFNameError(false); }}
              placeholder="e.g. Safaricom Foundation"
              aria-required="true"
              aria-invalid={fNameError}
              autoFocus
            />
            {fNameError && <div className="ptn-field-error">Organization name is required.</div>}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={lbl}>Organization type</label>
                <input className="ptn-input" list="ptn-org-types" value={fOrgType} onChange={e => setFOrgType(e.target.value)} placeholder="e.g. Corporate, NGO" />
              </div>
              <div>
                <label style={lbl}>Industry</label>
                <input className="ptn-input" value={fIndustry} onChange={e => setFIndustry(e.target.value)} placeholder="e.g. Telecommunications" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Website</label>
              <input className="ptn-input" value={fWebsite} onChange={e => setFWebsite(e.target.value)} placeholder="e.g. www.safaricom.co.ke" />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Location</label>
              <input className="ptn-input" value={fLocation} onChange={e => setFLocation(e.target.value)} placeholder="e.g. Nairobi, Kenya" />
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
              <label style={lbl}>Point of contact</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <input className="ptn-input" value={fContactName} onChange={e => setFContactName(e.target.value)} placeholder="Contact person" />
                <input className="ptn-input" type="tel" value={fContactPhone} onChange={e => setFContactPhone(e.target.value)} placeholder="Mobile phone" />
              </div>
              <input className="ptn-input" style={{ marginTop: 10 }} type="email" value={fContactEmail} onChange={e => setFContactEmail(e.target.value)} placeholder="Email" />
              <input className="ptn-input" style={{ marginTop: 10 }} value={fLinkedin} onChange={e => setFLinkedin(e.target.value)} placeholder="LinkedIn profile URL" />
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
              <label style={lbl}>Partnership</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <input className="ptn-input" list="ptn-categories" value={fCategory} onChange={e => setFCategory(e.target.value)} placeholder="Partnership category" />
                <select className="ptn-input" value={fPriority} onChange={e => setFPriority(e.target.value)}>
                  <option value="">Priority — not set</option>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 10 }}>
                <input className="ptn-input" value={fRelationshipOwner} onChange={e => setFRelationshipOwner(e.target.value)} placeholder="Relationship owner" />
                <select className="ptn-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="ptn-btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="ptn-btn primary" onClick={save} disabled={saving}><Plus size={14} /> {editingId ? 'Save changes' : 'Add partner'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ptn-input {
          width: 100%; height: 38px; padding: 0 12px; border-radius: 10px; font-size: 13px;
          background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
          color: var(--color-text-primary); font-family: inherit; outline: none; transition: .12s;
        }
        .ptn-input::placeholder { color: var(--color-text-tertiary); }
        .ptn-input:focus { border-color: var(--color-border-active); box-shadow: 0 0 0 3px rgba(48,108,236,.12); }
        .ptn-input.error { border-color: var(--color-error); background: var(--color-error-bg); }
        .ptn-input.error:focus { box-shadow: 0 0 0 3px var(--color-error-bg); }
        .ptn-field-error { font-size: 11.5px; color: var(--color-error); margin-top: 5px; font-weight: 600; }
        .ptn-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary);
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: .12s;
        }
        .ptn-btn.sm { height: 30px; padding: 0 10px; font-size: 11.5px; border-radius: 8px; }
        .ptn-btn:hover { border-color: var(--color-border-active); }
        .ptn-btn.primary { background: linear-gradient(135deg,#1E4FB8,#306CEC); border: none; color: #fff; }
        .ptn-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
        .ptn-btn.ghost { background: transparent; }
        .ptn-btn.danger { background: #E0485A; border: none; color: #fff; }
        .ptn-icon {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
          color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: .12s;
        }
        .ptn-icon:hover { color: var(--color-text-primary); border-color: var(--color-border-active); }
      `}</style>
    </div>
  );
}
