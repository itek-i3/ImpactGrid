'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building, Plus, ArrowLeft, ShieldCheck, AlertCircle, Users, Calendar, Link2, ExternalLink } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function AdminPanelContent() {
  const router = useRouter();
  const toast = useToast();
  
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [agencies, setAgencies] = useState([]);
  const [loadingAgencies, setLoadingAgencies] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Fetch user profile to verify superadmin status
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/os/api/profile');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Unauthorized');
        }
        const json = await res.json();
        if (json.data && json.data.role === 'superadmin') {
          setProfile(json.data);
          setLoadingProfile(false);
          loadAgencies();
        } else {
          // Redirect unauthorized users after 3 seconds
          setLoadingProfile(false);
          setTimeout(() => {
            router.push('/');
          }, 3000);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    }
    checkAuth();
  }, [router]);

  // 2. Fetch agencies list
  const loadAgencies = async () => {
    setLoadingAgencies(true);
    try {
      const res = await fetch('/os/api/admin/agencies');
      if (res.ok) {
        const json = await res.json();
        setAgencies(json.data || []);
      } else {
        toast.error('Failed to load agencies', 'An error occurred while fetching the agency list.');
      }
    } catch (err) {
      console.error('Failed to load agencies:', err);
    } finally {
      setLoadingAgencies(false);
    }
  };

  // 3. Handle Name change to auto-fill Slug
  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    
    // Auto-slugify: lowercase, replace spaces with hyphens, remove non-alphanumeric chars
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
    setSlug(generatedSlug);
  };

  // 4. Submit New Agency
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!name.trim()) {
      setFormError('Agency Name is required.');
      return;
    }
    if (!slug.trim()) {
      setFormError('Agency Slug is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/os/api/admin/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          logoUrl: logoUrl.trim() || null
        })
      });

      if (res.ok) {
        toast.success('Agency Created', `Successfully created "${name}" and seeded its workspace.`);
        setName('');
        setSlug('');
        setLogoUrl('');
        loadAgencies();
      } else {
        const json = await res.json();
        setFormError(json.error?.message || 'Failed to create agency.');
        toast.error('Creation Failed', json.error?.message || 'Could not complete agency setup.');
      }
    } catch (err) {
      console.error('Create agency error:', err);
      setFormError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Screen
  if (loadingProfile) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #000000 0%, #010408 45%, #000000 100%)',
        color: '#B8D4FF',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        gap: 16,
      }}>
        <div style={{
          width: 38, height: 38,
          border: '3px solid rgba(48, 108, 236, 0.25)',
          borderTopColor: '#5B9BFF',
          borderRadius: '50%',
          animation: 'ig-spin .8s linear infinite',
        }} />
        <span style={{ fontSize: 14, letterSpacing: '.05em', color: 'rgba(148, 180, 255, 0.70)' }}>Verifying Permissions…</span>
        <style>{`@keyframes ig-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Access Denied Screen (Redirection fallback)
  if (!profile || profile.role !== 'superadmin') {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #000000 0%, #010408 45%, #000000 100%)',
        color: '#FF6B7A',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        padding: 24,
        textAlign: 'center',
        gap: 16,
      }}>
        <AlertCircle size={44} style={{ color: '#E0485A' }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Access Denied</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.60)', maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
          You do not have permission to view the Superadmin Panel. Redirection to the workspace is in progress...
        </p>
        <Link href="/" style={{
          marginTop: 8,
          padding: '10px 24px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(48, 108, 236, 0.25)',
          borderRadius: 50,
          color: '#7EB3FF',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
          transition: 'all .15s',
        }}>
          Go back immediately
        </Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@700;800;900&display=swap');
        @keyframes ig-spin { to { transform: rotate(360deg); } }
        @keyframes ig-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        
        .admin-input::placeholder { color: rgba(148, 180, 255, 0.35); }
        .admin-input:focus { outline: none; border-color: rgba(91, 155, 255, 0.85) !important; box-shadow: 0 0 0 3px rgba(48, 108, 236, 0.20); }
        .admin-input {
          width: 100%;
          background: rgba(48, 108, 236, 0.10);
          border: 1.5px solid rgba(48, 108, 236, 0.45);
          border-radius: 12px;
          height: 48px;
          padding: 0 16px;
          font-size: 14px;
          color: #B8D4FF;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .btn-submit:hover:not(:disabled) { background: #1E4FB8 !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(48, 108, 236, 0.45) !important; }
        .btn-submit:active:not(:disabled) { transform: translateY(0); }

        .btn-back:hover { background: rgba(48, 108, 236, 0.15) !important; color: #fff !important; }

        .agency-row:hover { background: rgba(48, 108, 236, 0.08) !important; }

        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        background: 'linear-gradient(135deg, #000000 0%, #010408 40%, #000000 100%)',
        position: 'relative',
        overflowX: 'hidden',
        padding: '40px 24px',
        color: '#E2EEFF',
      }}>
        {/* grid overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(48,108,236,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(48,108,236,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* ambient glows */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(48,108,236,0.22) 0%, transparent 60%)', top: -200, right: -150, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,79,184,0.15) 0%, transparent 65%)', bottom: -150, left: -100, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1, animation: 'ig-up .40s ease both' }}>
          
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 44,
            borderBottom: '1px solid rgba(48, 108, 236, 0.20)',
            paddingBottom: 24,
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ShieldCheck size={24} style={{ color: '#5B9BFF' }} />
                <h1 style={{
                  fontSize: 28,
                  fontWeight: 900,
                  fontFamily: '"League Spartan", var(--font-spartan, sans-serif)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  margin: 0,
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #7EB3FF 60%, #306CEC 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  Superadmin Panel
                </h1>
              </div>
              <p style={{ color: '#3D5A8A', margin: 0, fontSize: 14 }}>
                Register new agencies, audit active workspaces, and monitor memberships.
              </p>
            </div>
            
            <Link href="/" className="btn-back" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(48, 108, 236, 0.25)',
              borderRadius: 12,
              color: '#7EB3FF',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all .15s',
            }}>
              <ArrowLeft size={15} /> Back to Workspace
            </Link>
          </div>

          {/* Grid Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>
            
            {/* List Column */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1.5px solid rgba(48, 108, 236, 0.35)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.50)',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={18} style={{ color: '#5B9BFF' }} /> Registered Agencies
              </h2>

              {loadingAgencies ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28,
                    border: '2.5px solid rgba(48, 108, 236, 0.15)',
                    borderTopColor: '#5B9BFF',
                    borderRadius: '50%',
                    animation: 'ig-spin .7s linear infinite',
                  }} />
                  <span style={{ fontSize: 13, color: '#3D5A8A' }}>Loading list…</span>
                </div>
              ) : agencies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(148,180,255,0.40)', fontSize: 14 }}>
                  No agencies registered yet. Use the form on the right to create one.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid rgba(48, 108, 236, 0.20)', paddingBottom: 10 }}>
                        <th style={{ padding: '0 12px 12px 12px', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Agency</th>
                        <th style={{ padding: '0 12px 12px 12px', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Slug</th>
                        <th style={{ padding: '0 12px 12px 12px', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Members</th>
                        <th style={{ padding: '0 12px 12px 12px', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Seeded Workspace</th>
                        <th style={{ padding: '0 12px 12px 12px', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Registered At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agencies.map((agency) => (
                        <tr key={agency.id} className="agency-row" style={{ borderBottom: '1px solid rgba(48, 108, 236, 0.10)', transition: 'background-color .15s' }}>
                          <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: 'rgba(48, 108, 236, 0.15)',
                                border: '1px solid rgba(48, 108, 236, 0.30)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 'bold', color: '#7EB3FF',
                                overflow: 'hidden'
                              }}>
                                {agency.logoUrl ? (
                                  <img src={agency.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  agency.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{agency.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 12px', fontSize: 13, color: '#7EB3FF', fontFamily: 'var(--font-mono, monospace)' }}>
                            {agency.slug}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(91, 155, 255, 0.08)',
                              border: '1px solid rgba(91, 155, 255, 0.15)',
                              fontSize: 12.5, fontWeight: 600, color: '#7EB3FF'
                            }}>
                              <Users size={12} /> {agency.memberCount}
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px', fontSize: 12.5, color: '#3D5A8A' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              Active <ExternalLink size={11} style={{ opacity: 0.6 }} />
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px', fontSize: 12.5, color: 'rgba(148, 180, 255, 0.60)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Calendar size={12} /> {new Date(agency.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Create Form Column */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1.5px solid rgba(48, 108, 236, 0.35)',
              borderTop: '1.5px solid rgba(91, 155, 255, 0.50)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.50)',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} style={{ color: '#5B9BFF' }} /> Register Agency
              </h2>

              {formError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(224,72,90,0.12)', border: '1px solid rgba(224,72,90,0.30)', borderRadius: 10, color: '#FF6B7A', fontSize: 13, marginBottom: 20 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />{formError}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Agency Name</label>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="e.g. Itek, i3+"
                    value={name}
                    onChange={handleNameChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Agency Slug</label>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="e.g. itek, i3-plus"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    required
                  />
                  <span style={{ fontSize: 10, color: '#3D5A8A', marginTop: 4, display: 'block' }}>Used for scoping users and workspaces (a-z, 0-9, hyphens).</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Logo URL (Optional)</label>
                  <input
                    className="admin-input"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={submitting} style={{
                  width: '100%', height: 48,
                  background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                  color: '#FFFFFF', border: 'none', borderRadius: 12,
                  fontSize: 13.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .15s', opacity: submitting ? 0.75 : 1,
                  boxShadow: '0 4px 18px rgba(48,108,236,0.30)',
                  marginTop: 10
                }}>
                  {submitting ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.30)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ig-spin .6s linear infinite', display: 'inline-block' }} />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> Create Agency
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <ToastProvider>
      <AdminPanelContent />
    </ToastProvider>
  );
}
