'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import {
  ArrowLeft, Pencil, Camera, Eye, EyeOff, Check, X,
  User, Mail, Phone, Lock, Building2, LayoutDashboard,
} from 'lucide-react';

const WORKSPACE_EMOJIS = [
  '🚀','⚡','🎯','💡','🌍','🏆','🔥','💎',
  '🎨','📊','📈','🛠️','🌐','🏢','💼','📋',
  '🌟','✨','🎪','🎭','🌈','🦋','🏔️','🌊',
  '🧠','💪','🤝','🌱','🔮','🎵','📱','🖥️',
];

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [showPwRow, setShowPwRow] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [agencyMembers, setAgencyMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingMember, setUpdatingMember] = useState(null);

  // Workspace settings
  const { workspace, updateWorkspaceSettings } = useWorkspaceStore();
  const [wsName, setWsName] = useState('');
  const [wsIcon, setWsIcon] = useState('🚀');
  const [wsEditing, setWsEditing] = useState(false);
  const [wsSaving, setWsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (workspace) {
      setWsName(workspace.name || '');
      setWsIcon(workspace.icon || '🚀');
    }
  }, [workspace]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      sb.from('profiles')
        .select('full_name, role, avatar_url, phone, agency_id, agency:agency_id(name)')
        .eq('id', user.id).single()
        .then(({ data }) => {
          const p = { ...data, email: user.email };
          setProfile(p);
          setFullName(p.full_name || '');
          setPhone(p.phone || '');
        });
    });
  }, [router]);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { flash('Choose an image file', false); return; }
    if (file.size > 2 * 1024 * 1024) { flash('Max 2 MB', false); return; }
    uploadPhoto(file);
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/os/api/profile/avatar', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) { flash(json.error || 'Upload failed', false); setUploading(false); return; }
    setProfile((p) => ({ ...p, avatar_url: json.url }));
    setUploading(false);
    flash('Photo updated');
  };

  const saveInfo = async () => {
    if (!fullName.trim()) { flash('Name is required', false); return; }
    setSaving(true);
    const { error } = await createClient().from('profiles').update({
      full_name: fullName.trim(), phone,
    }).eq('id', userId);
    setSaving(false);
    if (error) { flash(error.message, false); return; }
    setProfile((p) => ({ ...p, full_name: fullName.trim(), phone }));
    setEditing(false);
    flash('Profile updated');
  };

  const cancelEdit = () => {
    setFullName(profile.full_name || '');
    setPhone(profile.phone || '');
    setEditing(false);
  };

  const changePw = async () => {
    if (newPw.length < 6) { flash('Min 6 characters', false); return; }
    setChangingPw(true);
    const { error } = await createClient().auth.updateUser({ password: newPw });
    setChangingPw(false);
    error ? flash(error.message, false) : (flash('Password changed'), setNewPw(''), setShowPwRow(false));
  };

  useEffect(() => {
    if (!profile || !['manager', 'superadmin'].includes(profile.role) || !profile.agency_id) return;

    setLoadingMembers(true);
    const sb = createClient();
    sb.from('profiles')
      .select('id, full_name, email, role, avatar_url, approved, phone')
      .eq('agency_id', profile.agency_id)
      .order('full_name')
      .then(({ data, error }) => {
        if (!error && data) {
          setAgencyMembers(data);
        }
        setLoadingMembers(false);
      });
  }, [profile]);

  const handleApproveMember = async (targetId) => {
    setUpdatingMember(targetId);
    const sb = createClient();
    const { error } = await sb
      .from('profiles')
      .update({ approved: true })
      .eq('id', targetId);

    if (error) {
      flash(error.message, false);
    } else {
      setAgencyMembers((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, approved: true } : m))
      );
      flash('Member approved successfully');
    }
    setUpdatingMember(null);
  };

  const handleRoleChange = async (targetId, newRole) => {
    setUpdatingMember(targetId);
    const sb = createClient();
    const { error } = await sb
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId);

    if (error) {
      flash(error.message, false);
    } else {
      setAgencyMembers((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, role: newRole } : m))
      );
      flash(`Role changed to ${newRole}`);
    }
    setUpdatingMember(null);
  };

  const handleRemoveMember = async (targetId) => {
    setUpdatingMember(targetId);
    const sb = createClient();
    const { error } = await sb
      .from('profiles')
      .update({ agency_id: null, role: 'member', approved: false })
      .eq('id', targetId);

    if (error) {
      flash(error.message, false);
    } else {
      setAgencyMembers((prev) => prev.filter((m) => m.id !== targetId));
      flash('Member removed from agency');
    }
    setUpdatingMember(null);
  };

  const saveWorkspace = async () => {
    if (!wsName.trim()) { flash('Workspace name is required', false); return; }
    if (!workspace?.id) return;
    setWsSaving(true);
    try {
      await updateWorkspaceSettings(workspace.id, { name: wsName.trim(), icon: wsIcon });
      setWsEditing(false);
      flash('Workspace updated');
    } catch (e) {
      flash(e.message || 'Failed to save', false);
    }
    setWsSaving(false);
  };

  const cancelWsEdit = () => {
    setWsName(workspace?.name || '');
    setWsIcon(workspace?.icon || '🚀');
    setWsEditing(false);
    setShowEmojiPicker(false);
  };

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#3D5A8A', fontSize: 14 }}>Loading…</span>
    </div>
  );

  const avatarSrc = profile.avatar_url;
  const initial = (profile.full_name || profile.email || '?').charAt(0).toUpperCase();
  const roleColor = { superadmin: '#F5A623', manager: '#5B9BFF', member: '#22C55E' }[profile.role] || '#5B9BFF';
  const roleLabel = { superadmin: 'Super Admin', manager: 'Manager', member: 'Member' }[profile.role] || 'Member';
  const val = (v) => v || <span style={{ color: '#2A3F60' }}>—</span>;

  return (
    <>
      <style>{`
        .ig-input::placeholder { color: rgba(148,180,255,0.40); }
        .ig-input:focus { outline: none; }
        .ig-input { color: #B8D4FF; color-scheme: dark; }
        .ig-input:-webkit-autofill,
        .ig-input:-webkit-autofill:hover,
        .ig-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 9999px transparent inset !important;
          -webkit-text-fill-color: #B8D4FF !important;
          background-color: transparent !important;
          transition: background-color 9999s ease;
        }
        .ig-field-wrap:focus-within {
          border-color: rgba(91,155,255,0.90) !important;
          box-shadow: 0 0 0 3px rgba(48,108,236,0.22);
        }
        .ig-field-wrap-disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#000', fontFamily: 'var(--font-sans,system-ui)', color: '#E2EEFF' }}>

        {/* Nav */}
        <div style={{
          height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', borderBottom: '1px solid rgba(48,108,236,0.18)',
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.back()} style={{
              display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
              color: '#7EB3FF', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 7,
            }}>
              <ArrowLeft size={15} /> Back
            </button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>My Profile</span>
          </div>

          {!editing ? (
            <button onClick={() => setEditing(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
              background: 'rgba(48,108,236,0.14)', border: '1.5px solid rgba(48,108,236,0.55)',
              borderRadius: 50, color: '#7EB3FF', cursor: 'pointer', fontSize: 13,
              fontFamily: 'inherit', fontWeight: 600,
            }}>
              <Pencil size={13} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelEdit} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                background: 'none', border: '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 50, color: '#6B8BB5', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}>
                <X size={13} /> Cancel
              </button>
              <button onClick={saveInfo} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 18px',
                background: '#306CEC', border: 'none',
                borderRadius: 50, color: '#fff', cursor: 'pointer', fontSize: 13,
                fontFamily: 'inherit', fontWeight: 700,
              }}>
                <Check size={13} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {msg && (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            padding: '10px 22px', borderRadius: 50, fontSize: 13, fontWeight: 600,
            background: msg.ok ? 'rgba(22,163,107,0.15)' : 'rgba(224,72,90,0.15)',
            border: `1px solid ${msg.ok ? '#16A36B' : '#E0485A'}`,
            color: msg.ok ? '#16A36B' : '#E0485A',
            zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px 80px' }}>

          {/* Profile card */}
          <div style={{
            background: '#000', border: '1px solid rgba(48,108,236,0.22)',
            borderRadius: 20, padding: '36px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 360,
          }}>

            {/* Left: avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flexShrink: 0, width: 120 }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 110, height: 110, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, fontWeight: 700, color: '#fff', overflow: 'hidden',
                  border: '3px solid rgba(48,108,236,0.35)',
                }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initial}
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Change photo" style={{
                  position: 'absolute', bottom: 4, right: 4,
                  width: 30, height: 30, borderRadius: '50%',
                  background: '#306CEC', border: '2px solid #000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: uploading ? 'wait' : 'pointer',
                }}>
                  {uploading
                    ? <div style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                    : <Camera size={13} color="#fff" />}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E2EEFF' }}>{profile.full_name || '—'}</div>
                <div style={{
                  marginTop: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.06em',
                  background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30`,
                  display: 'inline-block',
                }}>
                  {roleLabel}
                </div>
              </div>
              <div style={{ width: '100%', height: 1, background: 'rgba(48,108,236,0.15)' }} />
            </div>

            {/* Right: info */}
            <div style={{ width: 360 }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <PillField label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full name" icon={<User size={17} color="rgba(255,255,255,0.85)" />} />
                  <PillField label="Email" value={profile.email} disabled icon={<Mail size={17} color="rgba(255,255,255,0.85)" />} />
                  <PillField label="Phone" value={phone} onChange={setPhone} placeholder="Phone number" icon={<Phone size={17} color="rgba(255,255,255,0.85)" />} />
                  <PillField label="Agency" value={profile.agency?.name || '—'} disabled icon={<Building2 size={17} color="rgba(255,255,255,0.85)" />} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <InfoRow label="Name" value={val(profile.full_name)} />
                  <InfoRow label="Email" value={val(profile.email)} />
                  <InfoRow label="Phone" value={val(profile.phone)} />
                  <InfoRow label="Agency" value={val(profile.agency?.name)} />
                </div>
              )}
            </div>
          </div>

          {/* Change password */}
          <div style={{ marginTop: 12, borderRadius: 14, border: '1px solid rgba(48,108,236,0.18)', overflow: 'hidden' }}>
            <button onClick={() => setShowPwRow((v) => !v)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '15px 24px', background: '#000', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', color: '#6B8BB5', fontSize: 13, fontWeight: 600,
            }}>
              <span>Change Password</span>
              <span style={{ fontSize: 18, lineHeight: 1, color: '#3D5A8A', transform: showPwRow ? 'rotate(45deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>+</span>
            </button>
            {showPwRow && (
              <div style={{ padding: '18px 24px 24px', background: '#000', borderTop: '1px solid rgba(48,108,236,0.08)', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={lbl}>New Password</div>
                  <div className="ig-field-wrap" style={pillWrapSt}>
                    <input
                      className="ig-input"
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Minimum 6 characters"
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', padding: '0 0 0 16px' }}
                    />
                    <button onClick={() => setShowPw((v) => !v)} style={{ ...iconCircleSt, cursor: 'pointer', border: 'none', flexShrink: 0 }}>
                      {showPw ? <EyeOff size={16} color="rgba(255,255,255,0.85)" /> : <Lock size={16} color="rgba(255,255,255,0.85)" />}
                    </button>
                  </div>
                </div>
                <button onClick={changePw} disabled={changingPw || !newPw} style={{
                  padding: '0 24px', height: 50, borderRadius: 50, fontSize: 13, fontWeight: 700,
                  background: '#306CEC', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 16px rgba(48,108,236,0.30)',
                }}>
                  {changingPw ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Workspace Settings card */}
          {workspace && (
            <div style={{
              marginTop: 32, background: '#000', border: '1px solid rgba(48,108,236,0.22)',
              borderRadius: 20, padding: '36px 40px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LayoutDashboard size={20} style={{ color: '#5B9BFF' }} /> Workspace Settings
                  </h3>
                  <p style={{ color: '#3D5A8A', margin: '6px 0 0', fontSize: 13 }}>
                    {['manager', 'superadmin'].includes(profile?.role)
                      ? 'Customize how your workspace looks to the team.'
                      : 'Your current workspace details.'}
                  </p>
                </div>
                {['manager', 'superadmin'].includes(profile?.role) && !wsEditing && (
                  <button onClick={() => setWsEditing(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                    background: 'rgba(48,108,236,0.14)', border: '1.5px solid rgba(48,108,236,0.55)',
                    borderRadius: 50, color: '#7EB3FF', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
                  }}>
                    <Pencil size={13} /> Edit
                  </button>
                )}
                {wsEditing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelWsEdit} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                      background: 'none', border: '1.5px solid rgba(255,255,255,0.12)',
                      borderRadius: 50, color: '#6B8BB5', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                    }}>
                      <X size={13} /> Cancel
                    </button>
                    <button onClick={saveWorkspace} disabled={wsSaving} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 18px',
                      background: '#306CEC', border: 'none',
                      borderRadius: 50, color: '#fff', cursor: 'pointer', fontSize: 13,
                      fontFamily: 'inherit', fontWeight: 700,
                    }}>
                      <Check size={13} /> {wsSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                {/* Icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    onClick={() => wsEditing && setShowEmojiPicker((v) => !v)}
                    style={{
                      width: 80, height: 80, borderRadius: 20,
                      background: 'rgba(48,108,236,0.14)',
                      border: `2px solid ${wsEditing ? 'rgba(48,108,236,0.55)' : 'rgba(48,108,236,0.22)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 38, cursor: wsEditing ? 'pointer' : 'default',
                      transition: 'border-color .15s',
                    }}
                    title={wsEditing ? 'Click to change icon' : ''}
                  >
                    {wsIcon}
                  </div>
                  {wsEditing && (
                    <div style={{
                      position: 'absolute', fontSize: 10, color: '#5B9BFF', textAlign: 'center',
                      width: '100%', marginTop: 4,
                    }}>tap to change</div>
                  )}
                  {showEmojiPicker && wsEditing && (
                    <div style={{
                      position: 'absolute', top: '110%', left: 0, zIndex: 100,
                      background: '#0A1628', border: '1.5px solid rgba(48,108,236,0.35)',
                      borderRadius: 16, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, width: 288,
                    }}>
                      {WORKSPACE_EMOJIS.map((e) => (
                        <button key={e} onClick={() => { setWsIcon(e); setShowEmojiPicker(false); }} style={{
                          width: 30, height: 30, borderRadius: 8, border: 'none',
                          background: wsIcon === e ? 'rgba(48,108,236,0.30)' : 'none',
                          fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <div style={lbl}>Workspace Name</div>
                  {wsEditing ? (
                    <div className="ig-field-wrap" style={pillWrapSt}>
                      <input
                        className="ig-input"
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="Workspace name"
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', padding: '0 16px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#E2EEFF', marginTop: 6 }}>{workspace.name}</div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <div style={lbl}>Workspace ID</div>
                    <div style={{ fontSize: 12, color: '#3D5A8A', fontFamily: 'monospace', marginTop: 4 }}>{workspace.id}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agency Members card */}
          {profile && ['manager', 'superadmin'].includes(profile.role) && profile.agency_id && (
            <div style={{
              marginTop: 32, background: '#000', border: '1px solid rgba(48,108,236,0.22)',
              borderRadius: 20, padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 24,
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Building2 size={20} style={{ color: '#5B9BFF' }} /> Agency Members
                </h3>
                <p style={{ color: '#3D5A8A', margin: '6px 0 0', fontSize: 13 }}>
                  View and manage team memberships for your agency.
                </p>
              </div>

              {loadingMembers ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 10 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(48,108,236,0.15)', borderTopColor: '#5B9BFF', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#3D5A8A' }}>Loading members…</span>
                </div>
              ) : agencyMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(148,180,255,0.40)', fontSize: 13 }}>
                  No members in this agency.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid rgba(48,108,236,0.20)' }}>
                        {['Member', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '0 12px 12px', fontSize: 11, fontWeight: 700, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agencyMembers.map((member) => {
                        const isSelf = member.id === userId;
                        const initial = (member.full_name || member.email || '?').charAt(0).toUpperCase();
                        return (
                          <tr key={member.id} style={{ borderBottom: '1px solid rgba(48,108,236,0.10)' }}>
                            <td style={{ padding: '13px 12px', fontWeight: 600, color: '#fff', fontSize: 13.5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden',
                                  border: '1px solid rgba(48,108,236,0.30)',
                                }}>
                                  {member.avatar_url ? (
                                    <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    initial
                                  )}
                                </div>
                                <span>{member.full_name || '—'} {isSelf && <span style={{ color: '#3D5A8A', fontSize: 11 }}>(you)</span>}</span>
                              </div>
                            </td>
                            <td style={{ padding: '13px 12px', fontSize: 13, color: '#7EB3FF' }}>{member.email}</td>
                            <td style={{ padding: '13px 12px' }}>
                              {isSelf ? (
                                <span style={{
                                  fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
                                  background: member.role === 'superadmin' ? 'rgba(245,166,35,0.18)' : 'rgba(91,155,255,0.18)',
                                  color: member.role === 'superadmin' ? '#F5A623' : '#5B9BFF',
                                  border: member.role === 'superadmin' ? '1px solid rgba(245,166,35,0.30)' : '1px solid rgba(91,155,255,0.30)',
                                  textTransform: 'uppercase', letterSpacing: '.05em'
                                }}>
                                  {member.role === 'superadmin' ? 'Admin' : 'Manager'}
                                </span>
                              ) : (
                                <select
                                  value={member.role || 'member'}
                                  disabled={updatingMember === member.id}
                                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                  style={{
                                    background: '#0d1b38', border: '1px solid rgba(48,108,236,0.35)',
                                    borderRadius: 8, color: member.role === 'superadmin' ? '#F5A623' : member.role === 'manager' ? '#5B9BFF' : '#22C55E',
                                    fontSize: 12, fontWeight: 600, padding: '4px 8px', cursor: 'pointer',
                                    fontFamily: 'inherit', outline: 'none',
                                    opacity: updatingMember === member.id ? 0.5 : 1,
                                  }}
                                >
                                  <option value="member">Member</option>
                                  <option value="manager">Manager</option>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '13px 12px' }}>
                              <span style={{
                                fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
                                background: member.approved ? 'rgba(22,163,107,0.18)' : 'rgba(245,166,35,0.18)',
                                color: member.approved ? '#16A36B' : '#F5A623',
                                border: member.approved ? '1px solid rgba(22,163,107,0.30)' : '1px solid rgba(245,166,35,0.30)',
                                textTransform: 'uppercase', letterSpacing: '.05em'
                              }}>
                                {member.approved ? 'Approved' : 'Pending'}
                              </span>
                            </td>
                            <td style={{ padding: '13px 12px' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {!member.approved && !isSelf && (
                                  <button
                                    onClick={() => handleApproveMember(member.id)}
                                    disabled={updatingMember === member.id}
                                    style={{
                                      padding: '4px 12px', borderRadius: 50, fontSize: 11.5, fontWeight: 600,
                                      background: 'rgba(22,163,107,0.18)', color: '#16A36B', border: '1px solid rgba(22,163,107,0.35)',
                                      cursor: 'pointer', transition: '.15s',
                                    }}
                                  >
                                    Approve
                                  </button>
                                )}
                                {!isSelf && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    disabled={updatingMember === member.id}
                                    style={{
                                      padding: '4px 12px', borderRadius: 50, fontSize: 11.5, fontWeight: 600,
                                      background: 'rgba(224,72,90,0.12)', color: '#E0485A', border: '1px solid rgba(224,72,90,0.25)',
                                      cursor: 'pointer', transition: '.15s',
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                                {isSelf && <span style={{ fontSize: 12, color: '#3D5A8A' }}>—</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

function PillField({ label, value, onChange, placeholder, disabled, type = 'text', wide, icon }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : {}}>
      <div style={lbl}>{label}</div>
      <div className={`ig-field-wrap${disabled ? ' ig-field-wrap-disabled' : ''}`} style={pillWrapSt}>
        {icon && <div style={iconCircleSt}>{icon}</div>}
        <input
          className="ig-input"
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, fontFamily: 'inherit',
            padding: icon ? '0 8px 0 0' : '0 16px',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#7EB3FF' }}>{value}</div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: '#3D5A8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' };

const pillWrapSt = {
  display: 'flex', alignItems: 'center',
  background: 'rgba(48,108,236,0.14)',
  borderRadius: 50,
  border: '1.5px solid rgba(48,108,236,0.55)',
  padding: '0 6px',
  height: 50,
  gap: 8,
  transition: 'border-color .15s, box-shadow .15s',
};

const iconCircleSt = {
  width: 38, height: 38, borderRadius: '50%',
  background: 'rgba(48,108,236,0.22)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};
