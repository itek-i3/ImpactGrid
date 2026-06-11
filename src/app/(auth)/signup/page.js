'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, User, Mail, Lock, ChevronDown, AlertCircle, Building2 } from 'lucide-react';

const AGENCIES = [
  { id: 'itek',      label: 'iTek' },
  { id: 'i3x',       label: 'i3x Africa' },
  { id: 'i3studios', label: 'i3 Studios' },
  { id: 'assets',    label: 'Assets' },
  { id: 'i3kingdom', label: 'i3 Launchpad' },
  { id: 'i3plus',    label: 'i3+' },
];

export default function SignupPage() {
  const router = useRouter();
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [agency,       setAgency]       = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agencyOpen,   setAgencyOpen]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const agencyRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (agencyRef.current && !agencyRef.current.contains(e.target)) setAgencyOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!agency) { setError('Please select your agency.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name, agency, role: 'member' } },
      });
      if (error) setError(error.message);
      else { router.push('/'); router.refresh(); }
    } catch { setError('Could not create account. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@700;800;900&display=swap');
        @keyframes ig-spin { to { transform:rotate(360deg); } }
        @keyframes ig-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        .ig-input::placeholder { color:rgba(148,180,255,0.40); }
        .ig-input:focus { outline:none; }
        .ig-input {
          color:#B8D4FF;
          color-scheme: dark;
          transition: background-color 9999s ease, color 9999s ease;
        }
        .ig-input:-webkit-autofill,
        .ig-input:-webkit-autofill:hover,
        .ig-input:-webkit-autofill:focus,
        .ig-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0px 9999px transparent inset !important;
          box-shadow: 0 0 0px 9999px transparent inset !important;
          -webkit-text-fill-color: #B8D4FF !important;
          background-color: transparent !important;
          transition: background-color 9999s ease, color 9999s ease;
        }
.ig-field-wrap:focus-within { border-color:rgba(91,155,255,0.90) !important; box-shadow:0 0 0 3px rgba(48,108,236,0.25); }
        .ig-btn-signup:hover:not(:disabled) { background:#1E4FB8 !important; transform:translateY(-1px); box-shadow:0 8px 32px rgba(48,108,236,0.50) !important; }
        .ig-btn-signup:active:not(:disabled) { transform:translateY(0); }
        .ig-lnk:hover { color:#5B9BFF !important; }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{
        minHeight:'100dvh',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--font-sans, Inter, sans-serif)',
        background:'linear-gradient(135deg, #000000 0%, #010408 40%, #000000 100%)',
        position:'relative', overflow:'hidden', padding:'24px 16px',
      }}>

        {/* grid overlay */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(48,108,236,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(48,108,236,0.04) 1px, transparent 1px)', backgroundSize:'48px 48px' }} />

        {/* blue glows */}
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(48,108,236,0.28) 0%, transparent 60%)', top:-220, right:-180, pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(30,79,184,0.22) 0%, transparent 60%)', bottom:-180, left:-140, pointerEvents:'none' }} />

        {/* frosted card */}
        <div style={{
          width:'100%', maxWidth:420,
          animation:'ig-up .45s ease both', position:'relative', zIndex:1,
          background:'rgba(255,255,255,0.03)',
          backdropFilter:'blur(40px) saturate(180%)',
          WebkitBackdropFilter:'blur(40px) saturate(180%)',
          border:'1.5px solid rgba(48,108,236,0.55)',
          borderTop:'1.5px solid rgba(91,155,255,0.70)',
          borderLeft:'1.5px solid rgba(48,108,236,0.65)',
          borderRadius:32,
          padding:'60px 40px 56px',
          boxShadow:'0 24px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(48,108,236,0.20), inset 0 1px 0 rgba(91,155,255,0.15)',
        }}>

          <h1 style={{
            textAlign:'center',
            fontFamily:'"League Spartan", var(--font-spartan, sans-serif)',
            fontSize:28, fontWeight:900, letterSpacing:'0.12em',
            textTransform:'uppercase',
            background:'linear-gradient(135deg, #FFFFFF 0%, #7EB3FF 50%, #306CEC 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
            marginBottom:44,
          }}>
            Create Account
          </h1>

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'rgba(224,72,90,0.15)', border:'1px solid rgba(224,72,90,0.35)', borderRadius:50, color:'#FF6B7A', fontSize:13, marginBottom:20 }}>
              <AlertCircle size={14} style={{ flexShrink:0 }} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* full name */}
            <div className="ig-field-wrap" style={{ display:'flex', alignItems:'center', background:'rgba(48,108,236,0.14)', borderRadius:50, border:'1.5px solid rgba(48,108,236,0.55)', padding:'0 6px', height:58, gap:8, transition:'border-color .15s, box-shadow .15s, background .15s' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <User size={18} color="rgba(255,255,255,0.85)" />
              </div>
              <input className="ig-input" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14.5, fontFamily:'inherit', padding:'0 8px 0 0' }} />
            </div>

            {/* email */}
            <div className="ig-field-wrap" style={{ display:'flex', alignItems:'center', background:'rgba(48,108,236,0.14)', borderRadius:50, border:'1.5px solid rgba(48,108,236,0.55)', padding:'0 6px', height:58, gap:8, transition:'border-color .15s, box-shadow .15s, background .15s' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Mail size={18} color="rgba(255,255,255,0.85)" />
              </div>
              <input className="ig-input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14.5, fontFamily:'inherit', padding:'0 8px 0 0' }} />
            </div>

            {/* agency custom dropdown */}
            <div ref={agencyRef} style={{ position:'relative' }}>
              <div
                onClick={() => setAgencyOpen(o => !o)}
                style={{ display:'flex', alignItems:'center', background: agencyOpen ? 'rgba(48,108,236,0.24)' : 'rgba(48,108,236,0.14)', borderRadius:50, border:`1.5px solid ${agencyOpen ? 'rgba(91,155,255,0.90)' : 'rgba(48,108,236,0.50)'}`, boxShadow: agencyOpen ? '0 0 0 3px rgba(48,108,236,0.20)' : 'none', padding:'0 6px', height:58, gap:8, cursor:'pointer', transition:'border-color .15s, box-shadow .15s, background .15s' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Building2 size={18} color="rgba(255,255,255,0.85)" />
                </div>
                <span style={{ flex:1, fontSize:14.5, color: agency ? '#B8D4FF' : 'rgba(148,180,255,0.40)', padding:'0 8px 0 0', userSelect:'none' }}>
                  {agency ? AGENCIES.find(a => a.id === agency)?.label : 'Select agency'}
                </span>
                <ChevronDown size={16} color="rgba(148,180,255,0.60)" style={{ flexShrink:0, marginRight:8, transition:'transform .2s', transform: agencyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </div>

              {agencyOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 8px)', left:0, right:0, zIndex:50,
                  background:'rgba(5,12,24,0.97)',
                  backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
                  border:'1.5px solid rgba(48,108,236,0.50)',
                  borderRadius:20, overflow:'hidden',
                  boxShadow:'0 12px 48px rgba(0,0,0,0.70), 0 0 0 1px rgba(48,108,236,0.15)',
                }}>
                  {AGENCIES.map((a, i) => (
                    <div key={a.id}
                      onClick={() => { setAgency(a.id); setAgencyOpen(false); }}
                      style={{
                        padding:'13px 20px', fontSize:14, color: agency === a.id ? '#7EB3FF' : '#B8D4FF',
                        fontWeight: agency === a.id ? 700 : 400,
                        background: agency === a.id ? 'rgba(48,108,236,0.15)' : 'transparent',
                        borderBottom: i < AGENCIES.length - 1 ? '1px solid rgba(48,108,236,0.12)' : 'none',
                        cursor:'pointer', transition:'background .12s, color .12s',
                      }}
                      onMouseEnter={e => { if (agency !== a.id) e.currentTarget.style.background = 'rgba(48,108,236,0.08)'; }}
                      onMouseLeave={e => { if (agency !== a.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {a.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* password */}
            <div className="ig-field-wrap" style={{ display:'flex', alignItems:'center', background:'rgba(48,108,236,0.14)', borderRadius:50, border:'1.5px solid rgba(48,108,236,0.55)', padding:'0 6px', height:58, gap:8, transition:'border-color .15s, box-shadow .15s, background .15s' }}>
              <input className="ig-input" type={showPassword ? 'text' : 'password'} placeholder="Password (min. 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14.5, fontFamily:'inherit', padding:'0 0 0 18px' }} />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'none', cursor:'pointer' }}>
                {showPassword ? <EyeOff size={17} color="rgba(255,255,255,0.85)" /> : <Lock size={17} color="rgba(255,255,255,0.85)" />}
              </button>
            </div>

            {/* submit */}
            <button type="submit" className="ig-btn-signup" disabled={loading}
              style={{ width:'100%', height:58, background:'#306CEC', color:'#FFFFFF', border:'none', borderRadius:50, fontSize:15, fontWeight:800, letterSpacing:'0.10em', textTransform:'uppercase', cursor:loading ? 'not-allowed' : 'pointer', fontFamily:'"League Spartan", var(--font-spartan, sans-serif)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background .15s, box-shadow .15s, transform .12s', opacity:loading ? 0.75 : 1, marginTop:6, boxShadow:'0 4px 24px rgba(48,108,236,0.35)' }}>
              {loading ? (
                <>
                  <span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,.30)', borderTopColor:'#fff', borderRadius:'50%', animation:'ig-spin .6s linear infinite', display:'inline-block' }} />
                  Creating account…
                </>
              ) : 'Sign Up'}
            </button>

          </form>

          <p style={{ textAlign:'center', fontSize:13.5, color:'rgba(148,180,255,0.55)', marginTop:24 }}>
            Already have an account?{' '}
            <Link href="/login" className="ig-lnk" style={{ color:'#7EB3FF', fontWeight:700, textDecoration:'none', transition:'color .15s' }}>
              Login
            </Link>
          </p>

        </div>
      </div>
    </>
  );
}
