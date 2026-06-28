'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Monitor, Layout, Type } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';

export const FONTS = [
  { name: 'Default', value: 'default', stack: "'Plus Jakarta Sans','DM Sans',sans-serif" },
  { name: 'Inter',   value: 'inter',   stack: "'Inter',sans-serif" },
  { name: 'DM Sans', value: 'dmsans',  stack: "'DM Sans',sans-serif" },
];

export const prefKey = (uid, k) => `ig-${uid || 'guest'}-${k}`;

// ── Apply helpers (also called by SessionProvider on every page load) ─────────

export function applyFont(stack) {
  document.documentElement.style.setProperty('--font-sans', stack);
  document.body.style.fontFamily = stack;
}

export function applyZoom(pct) {
  document.body.style.zoom = `${pct}%`;
}

export function applyCompact(on) {
  document.documentElement.setAttribute('data-compact', on ? 'true' : 'false');
}

export function applyAllPrefs(uid) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const k   = (key) => prefKey(uid, key);
    const font = localStorage.getItem(k('font'));
    if (font) { const f = FONTS.find((x) => x.value === font); if (f) applyFont(f.stack); }
    const zoom = localStorage.getItem(k('zoom'));
    if (zoom) applyZoom(Number(zoom));
    const compact = localStorage.getItem(k('compact'));
    if (compact) applyCompact(compact === 'true');
  } catch {}
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const router = useRouter();
  const { theme, setTheme, userProfile } = useWorkspaceStore();
  const uid = userProfile?.id;

  const [fontVal,  setFontVal]  = useState('default');
  const [zoom,     setZoom]     = useState(100);
  const [compact,  setCompact]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [ready,    setReady]    = useState(false);

  useEffect(() => {
    if (!uid) return;
    const k = (key) => prefKey(uid, key);
    try {
      const font  = localStorage.getItem(k('font'));
      const z     = localStorage.getItem(k('zoom'));
      const cmpct = localStorage.getItem(k('compact'));
      if (font)  setFontVal(font);
      if (z)     setZoom(Number(z));
      if (cmpct) setCompact(cmpct === 'true');
    } catch {}
    setReady(true);
  }, [uid]);

  const handleFont    = (v)  => { setFontVal(v);  const f = FONTS.find((x) => x.value === v); if (f) applyFont(f.stack); };
  const handleZoom    = (v)  => { setZoom(v);     applyZoom(v); };
  const handleCompact = (on) => { setCompact(on); applyCompact(on); };

  const save = () => {
    if (!uid) return;
    const k = (key) => prefKey(uid, key);
    localStorage.setItem(k('font'),    fontVal);
    localStorage.setItem(k('zoom'),    String(zoom));
    localStorage.setItem(k('compact'), String(compact));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const isLight = theme === 'light';
  const cardBg   = isLight ? '#FFFFFF' : '#000';
  const pageBg   = isLight ? '#F5F7FF' : '#000';
  const navBg    = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(0,0,0,0.96)';
  const navBdr   = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(48,108,236,0.18)';
  const cardBdr  = isLight ? 'rgba(0,0,0,0.09)' : 'rgba(48,108,236,0.20)';
  const optBg    = isLight ? '#F5F7FF' : 'rgba(255,255,255,0.03)';
  const optBdr   = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(48,108,236,0.18)';
  const titleClr = isLight ? '#0F1C38' : '#E2EEFF';
  const descClr  = isLight ? '#7A8EB0' : '#3D5A8A';

  return (
    <>
      <style>{`
        .cust-card  { background:${cardBg}; border:1px solid ${cardBdr}; border-radius:20px; padding:28px 32px; margin-bottom:18px; }
        .cust-title { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; color:${titleClr}; margin-bottom:4px; }
        .cust-desc  { font-size:12.5px; color:${descClr}; margin:0 0 20px; }
        .cust-label { font-size:10.5px; font-weight:700; color:${descClr}; text-transform:uppercase; letter-spacing:.07em; margin-bottom:12px; }
        .cust-opt   { flex:1; min-width:120px; padding:14px 16px; border-radius:14px; cursor:pointer;
                      border:2px solid ${optBdr}; background:${optBg};
                      transition:.15s; position:relative; }
        .cust-opt.on{ border-color:rgba(48,108,236,0.70); background:rgba(48,108,236,0.10); }
        .cust-check { position:absolute; top:9px; right:9px; width:18px; height:18px; border-radius:50%;
                      background:#306CEC; display:flex; align-items:center; justify-content:center; }
        .zoom-track { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:99px; outline:none; cursor:pointer; }
        .zoom-track::-webkit-slider-thumb {
          -webkit-appearance:none; appearance:none; width:22px; height:22px; border-radius:50%;
          background:#306CEC; cursor:pointer;
          box-shadow:0 0 0 4px rgba(48,108,236,0.20),0 2px 8px rgba(0,0,0,0.3); transition:box-shadow .15s;
        }
        .zoom-track::-webkit-slider-thumb:hover { box-shadow:0 0 0 6px rgba(48,108,236,0.30),0 2px 8px rgba(0,0,0,0.3); }
        .zoom-track::-moz-range-thumb { width:22px; height:22px; border-radius:50%; border:none; background:#306CEC; cursor:pointer; }
      `}</style>

      <div style={{ minHeight:'100vh', background: pageBg, fontFamily:'var(--font-sans,system-ui)', color: titleClr }}>

        {/* Sticky nav */}
        <div style={{
          height:54, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 28px', borderBottom:`1px solid ${navBdr}`,
          background: navBg, backdropFilter:'blur(12px)',
          position:'sticky', top:0, zIndex:50,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => router.back()} style={{
              display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
              color:'#306CEC', cursor:'pointer', fontSize:13, fontFamily:'inherit', padding:'4px 8px', borderRadius:7,
            }}>
              <ArrowLeft size={15}/> Back
            </button>
            <span style={{ fontSize:15, fontWeight:700, color: titleClr }}>Customize Dashboard</span>
          </div>
          <button onClick={save} disabled={!uid} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 22px',
            background: saved ? 'rgba(16,185,129,0.15)' : '#306CEC',
            border: saved ? '1.5px solid #10B981' : 'none',
            borderRadius:50, color: saved ? '#10B981' : '#fff',
            cursor: uid ? 'pointer' : 'not-allowed', fontSize:13, fontFamily:'inherit', fontWeight:700, transition:'all .2s',
          }}>
            <Check size={13}/> {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {!ready ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color: descClr, fontSize:14 }}>
            Loading your preferences…
          </div>
        ) : (
          <div style={{ maxWidth:700, margin:'0 auto', padding:'36px 24px 80px' }}>

            {/* ── Appearance ── */}
            <div className="cust-card">
              <div className="cust-title"><Monitor size={16} color="#5B9BFF"/> Appearance</div>
              <p className="cust-desc">Choose how ImpactGrid looks for you.</p>
              <div className="cust-label">Theme</div>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { key:'dark',  label:'Dark',  emoji:'🌙', desc:'Easy on the eyes' },
                  { key:'light', label:'Light', emoji:'☀️', desc:'Bright and clean' },
                ].map(({ key, label, emoji, desc }) => (
                  <div key={key} onClick={() => setTheme(key)} className={`cust-opt${theme===key?' on':''}`}>
                    {theme===key && <span className="cust-check"><Check size={10} color="#fff"/></span>}
                    <div style={{ fontSize:26, marginBottom:6 }}>{emoji}</div>
                    <div style={{ fontWeight:700, fontSize:13.5, color: titleClr }}>{label}</div>
                    <div style={{ fontSize:11.5, color: descClr, marginTop:2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Text Size ── */}
            <div className="cust-card">
              <div className="cust-title"><Type size={16} color="#5B9BFF"/> Text Size</div>
              <p className="cust-desc">Scales all text and elements — like your laptop's display settings.</p>

              <div style={{
                background:'rgba(48,108,236,0.06)', border:'1px solid rgba(48,108,236,0.15)',
                borderRadius:12, padding:'16px 20px', marginBottom:20,
                fontSize: `${(zoom / 100) * 16}px`,
              }}>
                <div style={{ fontSize:'1.375em', fontWeight:700, color: titleClr, marginBottom:4 }}>Workspace heading</div>
                <div style={{ fontSize:'0.875em', color:'#306CEC', marginBottom:4 }}>Sub-heading text appears here</div>
                <div style={{ fontSize:'0.8125em', color: descClr, lineHeight:1.6 }}>
                  This is how your body text looks at {zoom}%. Adjust the slider to find what feels comfortable.
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:12, color: descClr }}>Smaller</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#306CEC', background:'rgba(48,108,236,0.12)', padding:'3px 14px', borderRadius:99 }}>{zoom}%</span>
                <span style={{ fontSize:12, color: descClr }}>Larger</span>
              </div>

              <input
                type="range" className="zoom-track"
                min={80} max={130} step={5} value={zoom}
                onChange={(e) => handleZoom(Number(e.target.value))}
                style={{
                  background:`linear-gradient(to right,#306CEC 0%,#306CEC ${((zoom-80)/50)*100}%,rgba(48,108,236,0.20) ${((zoom-80)/50)*100}%,rgba(48,108,236,0.20) 100%)`,
                }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                {[80,90,100,110,120,130].map((v) => (
                  <span key={v} onClick={() => handleZoom(v)} style={{
                    fontSize:11, color: zoom===v ? '#306CEC': descClr,
                    fontWeight: zoom===v ? 700:400, cursor:'pointer',
                  }}>{v}%</span>
                ))}
              </div>
            </div>

            {/* ── Font ── */}
            <div className="cust-card">
              <div className="cust-title"><Type size={16} color="#5B9BFF"/> Font</div>
              <p className="cust-desc">Choose your preferred reading font.</p>
              <div className="cust-label">Typeface</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {FONTS.map(({ name, value, stack }) => (
                  <div key={value} onClick={() => handleFont(value)} className={`cust-opt${fontVal===value?' on':''}`}>
                    {fontVal===value && <span className="cust-check"><Check size={10} color="#fff"/></span>}
                    <div style={{ fontFamily:stack, fontWeight:700, fontSize:22, color: titleClr, marginBottom:4 }}>Aa</div>
                    <div style={{ fontFamily:stack, fontWeight:600, fontSize:12.5, color: fontVal===value ? '#306CEC' : descClr }}>{name}</div>
                    <div style={{ fontFamily:stack, fontSize:11, color: descClr, marginTop:3 }}>The quick brown fox</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Layout Density ── */}
            <div className="cust-card">
              <div className="cust-title"><Layout size={16} color="#5B9BFF"/> Layout Density</div>
              <p className="cust-desc">Control breathing room between elements.</p>
              <div className="cust-label">Density</div>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { key:false, label:'Comfortable', desc:'More space, easier to read', emoji:'🔲' },
                  { key:true,  label:'Compact',     desc:'Tighter layout, more visible', emoji:'⬛' },
                ].map(({ key, label, desc, emoji }) => (
                  <div key={String(key)} onClick={() => handleCompact(key)} className={`cust-opt${compact===key?' on':''}`}>
                    {compact===key && <span className="cust-check"><Check size={10} color="#fff"/></span>}
                    <div style={{ fontSize:24, marginBottom:6 }}>{emoji}</div>
                    <div style={{ fontWeight:700, fontSize:13.5, color: titleClr }}>{label}</div>
                    <div style={{ fontSize:11.5, color: descClr, marginTop:3 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
