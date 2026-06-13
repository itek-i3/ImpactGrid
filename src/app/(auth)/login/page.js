'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch { setError('Invalid email or password. Please try again.'); }
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
        .ig-btn-login:hover:not(:disabled) { background:#1E4FB8 !important; transform:translateY(-1px); box-shadow:0 8px 32px rgba(48,108,236,0.50) !important; }
        .ig-btn-login:active:not(:disabled) { transform:translateY(0); }
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

        {/* subtle grid overlay */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(48,108,236,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(48,108,236,0.04) 1px, transparent 1px)',
          backgroundSize:'48px 48px',
        }} />

        {/* blue glow top-right */}
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(48,108,236,0.28) 0%, transparent 60%)', top:-220, right:-180, pointerEvents:'none' }} />
        {/* blue glow bottom-left */}
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

          {/* title */}
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
            User Login
          </h1>

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'rgba(224,72,90,0.15)', border:'1px solid rgba(224,72,90,0.35)', borderRadius:50, color:'#FF6B7A', fontSize:13, marginBottom:20 }}>
              <AlertCircle size={14} style={{ flexShrink:0 }} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* email field */}
            <div className="ig-field-wrap" style={{ display:'flex', alignItems:'center', background:'rgba(48,108,236,0.14)', borderRadius:50, border:'1.5px solid rgba(48,108,236,0.55)', padding:'0 6px', height:58, gap:8, transition:'border-color .15s, box-shadow .15s, background .15s' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <User size={18} color="rgba(255,255,255,0.85)" />
              </div>
              <input
                className="ig-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14.5, fontFamily:'inherit', padding:'0 8px 0 0' }}
              />
            </div>

            {/* password field */}
            <div className="ig-field-wrap" style={{ display:'flex', alignItems:'center', background:'rgba(48,108,236,0.14)', borderRadius:50, border:'1.5px solid rgba(48,108,236,0.55)', padding:'0 6px', height:58, gap:8, transition:'border-color .15s, box-shadow .15s, background .15s' }}>
              <input
                className="ig-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14.5, fontFamily:'inherit', padding:'0 0 0 18px' }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                style={{ width:44, height:44, borderRadius:'50%', background:'rgba(48,108,236,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'none', cursor:'pointer' }}>
                {showPassword
                  ? <EyeOff size={17} color="rgba(255,255,255,0.85)" />
                  : <Lock    size={17} color="rgba(255,255,255,0.85)" />
                }
              </button>
            </div>

            {/* submit */}
            <button type="submit" className="ig-btn-login" disabled={loading}
              style={{ width:'100%', height:58, background:'#306CEC', color:'#FFFFFF', border:'none', borderRadius:50, fontSize:15, fontWeight:800, letterSpacing:'0.10em', textTransform:'uppercase', cursor:loading ? 'not-allowed' : 'pointer', fontFamily:'"League Spartan", var(--font-spartan, sans-serif)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background .15s, box-shadow .15s, transform .12s', opacity:loading ? 0.75 : 1, marginTop:6, boxShadow:'0 4px 24px rgba(48,108,236,0.35)' }}>
              {loading ? (
                <>
                  <span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,.30)', borderTopColor:'#fff', borderRadius:'50%', animation:'ig-spin .6s linear infinite', display:'inline-block' }} />
                  Signing in…
                </>
              ) : 'Login'}
            </button>

          </form>

          <p style={{ textAlign:'center', fontSize:13.5, color:'rgba(148,180,255,0.55)', marginTop:24 }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="ig-lnk" style={{ color:'#7EB3FF', fontWeight:700, textDecoration:'none', transition:'color .15s' }}>
              Sign up
            </Link>
          </p>

        </div>
      </div>
    </>
  );
}
