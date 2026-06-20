'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Pencil, Camera, Eye, EyeOff, Check, X,
  User, Mail, Phone, Lock, Building2,
} from 'lucide-react';

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

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      sb.from('profiles')
        .select('full_name, role, avatar_url, phone, agency:agency_id(name)')
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
    if (!file || !userId) return;
    setUploading(true);
    const sb = createClient();
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { flash(error.message, false); setUploading(false); return; }
    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    await sb.from('profiles').update({ avatar_url: url }).eq('id', userId);
    setProfile((p) => ({ ...p, avatar_url: url }));
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
