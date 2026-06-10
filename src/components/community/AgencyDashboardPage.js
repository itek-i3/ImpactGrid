'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Target, Wallet, TrendingUp, TrendingDown, Receipt, CreditCard, Coins,
  Lightbulb, Banknote, Search, Bell, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Plus, PanelLeft, LogOut,
  ClipboardList, Calendar, Clock, Check, Pencil, Trash2,
  Sun, Moon, FilePlus, FileText, Users2, UserCheck, UserX,
  Mail, ShieldCheck, ShieldOff, Copy, CheckCheck, LayoutGrid, ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ── Brand tokens (impact360.africa) ── */
const LIGHT_C = {
  paper: '#EEF2FB', ink: '#14213D', inkSoft: '#5B6B86', inkFaint: '#93A0B8',
  brand: '#306CEC', brandDeep: '#1E4FB8', brandBright: '#5B9BFF',
  signal: '#F5A623', alert: '#E0485A', pos: '#16A36B',
  card: '#FFFFFF', line: 'rgba(20,33,61,0.10)',
  sidebar: '#0E1A3A', sidebarLine: 'rgba(255,255,255,0.08)', sidebarSoft: '#8FA0C4',
  inputBg: '#FFFFFF',
};
const DARK_C = {
  paper: '#02040A', ink: '#E2EEFF', inkSoft: '#7EB3FF', inkFaint: '#3D5A8A',
  brand: '#306CEC', brandDeep: '#1E4FB8', brandBright: '#5B9BFF',
  signal: '#F5A623', alert: '#E0485A', pos: '#16A36B',
  card: 'rgba(255,255,255,0.04)', line: 'rgba(48,108,236,0.22)',
  sidebar: '#000000', sidebarLine: 'rgba(48,108,236,0.20)', sidebarSoft: '#7EB3FF',
  inputBg: '#0d1b38',
};
let C = { ...LIGHT_C };
const PIE = ['#306CEC','#F5A623','#16A36B','#7E6CF0','#19C4D9','#E0485A','#5B9BFF'];

const kes  = (n) => 'KES ' + Math.round(n).toLocaleString('en-KE');
const kesC = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return 'KES ' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e3) return 'KES ' + Math.round(n / 1e3) + 'K';
  return 'KES ' + n;
};
const fmtY = (v) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? Math.round(v/1e3)+'K' : v;

const chartAxis   = { fontSize:11.5, fill:C.inkSoft, fontFamily:"'JetBrains Mono',monospace" };
const ttStyle     = {
  contentStyle: { background:C.ink, border:'none', borderRadius:10, fontSize:12, fontFamily:"'JetBrains Mono',monospace", boxShadow:'0 8px 24px rgba(0,0,0,.18)' },
  labelStyle:   { color:'#fff', fontWeight:600, marginBottom:2 },
  itemStyle:    { color:'#fff' },
};
const toneColor   = { pos:C.pos, neg:C.alert, warn:C.signal, neutral:C.inkSoft, brand:C.brand };
const statusTone  = (s) => ({ 'On track':'pos','At risk':'warn','Behind':'neg','Completed':'brand','Paid':'pos','Pending':'warn','Overdue':'neg' }[s] || 'neutral');

/* ── Primitives ── */
const TONE_GRAD = { brand:'linear-gradient(135deg,#1E4FB8,#306CEC)', pos:'linear-gradient(135deg,#0D8A58,#16A36B)', signal:'linear-gradient(135deg,#C4820A,#F5A623)', alert:'linear-gradient(135deg,#B83040,#E0485A)' };

function Stat({ label, value, sub, tone = 'brand', delay = 0 }) {
  return (
    <div className="ig-card ig-hover rise" style={{ padding:'24px 26px', animationDelay:delay+'ms', position:'relative', overflow:'hidden' }}>
      {/* coloured top bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: TONE_GRAD[tone] || TONE_GRAD.brand, borderRadius:'16px 16px 0 0' }} />
      <div style={{ fontSize:11.5, letterSpacing:'.07em', textTransform:'uppercase', color:C.inkFaint, fontWeight:700, marginTop:6 }}>{label}</div>
      <div className="mono" style={{ fontSize:30, fontWeight:700, color:C.ink, marginTop:10, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:13, color:toneColor[tone], marginTop:8, fontWeight:600 }}>{sub}</div>}
    </div>
  );
}

function Pill({ children, tone = 'neutral', solid = false }) {
  const col = toneColor[tone] || C.inkSoft;
  return (
    <span className="ig-pill" style={{
      color: solid ? '#fff' : col,
      background: solid ? col : col + '1A',
      border: solid ? 'none' : '1px solid ' + col + '33',
    }}>{children}</span>
  );
}

function Card({ children, style, title, action }) {
  return (
    <div className="ig-card rise" style={{ padding:28, ...style }}>
      {(title || action) && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          {title && <h3 className="display" style={{ fontSize:15, fontWeight:700, color:C.ink, margin:0 }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const Delta = ({ v }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:2, color:v >= 0 ? C.pos : C.alert, fontWeight:600, fontSize:12.5 }}>
    {v >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(v)}%
  </span>
);

/* ── Views ── */
function ProjectDetail({ p, i, isManager, onClose, onUpdate, onAddMilestone, onToggleMilestone, onAddMemberRole, onRemoveMemberRole }) {
  const t          = statusTone(p.status);
  const milestones = p.milestones  || [];
  const roles      = p.memberRoles || [];
  const mDone      = milestones.filter(m => m.done).length;
  return (
    <div className="ig-card rise" style={{ marginTop:16, padding:'24px 28px', display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="display" style={{ fontSize:18, fontWeight:700, color:C.ink }}>{p.name}</div>
          <div style={{ fontSize:13, color:C.inkSoft, marginTop:2 }}>Lead · {p.owner || '—'} &nbsp;·&nbsp; Due {p.due || '—'}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Pill tone={t}>{p.status}</Pill>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.inkFaint, fontSize:18, lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div>
          <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Description</div>
          {isManager
            ? <textarea className="ig-finput" rows={3} defaultValue={p.description || ''} onBlur={e => onUpdate({ description: e.target.value })} placeholder="What is this project about?" style={{ width:'100%', resize:'vertical', lineHeight:1.5, fontSize:13, background:C.inputBg, color:C.ink, borderColor:C.line }} />
            : <p style={{ fontSize:13, color:C.inkSoft, margin:0, lineHeight:1.6 }}>{p.description || '—'}</p>
          }
        </div>

        <div>
          <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Goal / Outcome</div>
          {isManager
            ? <input className="ig-finput" defaultValue={p.goal || ''} onBlur={e => onUpdate({ goal: e.target.value })} placeholder="What does success look like?" style={{ width:'100%', background:C.inputBg, color:C.ink, borderColor:C.line }} />
            : <p style={{ fontSize:13, color:C.inkSoft, margin:0, lineHeight:1.6 }}>{p.goal || '—'}</p>
          }
        </div>

        <div>
          <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Team roles</div>
          {roles.length === 0 && <p style={{ fontSize:13, color:C.inkFaint, margin:0 }}>No roles added yet.</p>}
          {roles.map((r, ri) => (
            <div key={ri} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid '+C.line }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:C.brand, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {r.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>{r.name}</div>
                <div style={{ fontSize:12, color:C.inkSoft }}>{r.role}</div>
              </div>
              {isManager && <button className="ig-delrow" onClick={() => onRemoveMemberRole(ri)} style={{ opacity:1 }}>✕</button>}
            </div>
          ))}
          {isManager && <MemberRoleInput onAdd={onAddMemberRole} />}
        </div>

        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase' }}>Milestones</div>
            {milestones.length > 0 && <span style={{ fontSize:12, color:C.inkSoft }}>{mDone}/{milestones.length} done</span>}
          </div>
          {milestones.map((m, mi) => (
            <div key={mi} onClick={() => isManager && onToggleMilestone(mi)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid '+C.line, cursor: isManager ? 'pointer' : 'default' }}>
              <div style={{ width:16, height:16, borderRadius:4, border:m.done?'none':'1.5px solid '+C.inkFaint, background:m.done?C.pos:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                {m.done && <Check size={10} color="#fff" />}
              </div>
              <span style={{ fontSize:13, color:m.done?C.inkSoft:C.ink, textDecoration:m.done?'line-through':'none', flex:1 }}>{m.text}</span>
            </div>
          ))}
          {isManager && <MilestoneInput onAdd={onAddMilestone} />}
        </div>

        {isManager && (
          <div>
            <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Update progress</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
              <input className="ig-finput mono" type="number" min="0" max={p.target} defaultValue={p.current||0}
                onBlur={e => onUpdate({ current: Number(e.target.value) })}
                style={{ width:110, background:C.inputBg, color:C.ink, borderColor:C.line }} />
              <span style={{ color:C.inkSoft, fontSize:13 }}>/ {(p.target||0).toLocaleString()} {p.unit}</span>
            </div>
            <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Status</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['On track','At risk','Behind','Completed'].map(s => (
                <button key={s} onClick={() => onUpdate({ status:s })}
                  style={{ padding:'5px 14px', borderRadius:20, border:'1px solid '+C.line, fontFamily:'inherit', fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all .15s',
                    background:  p.status===s ? toneColor[statusTone(s)]+'22' : 'transparent',
                    color:       p.status===s ? toneColor[statusTone(s)]      : C.inkSoft,
                    borderColor: p.status===s ? toneColor[statusTone(s)]+'55' : C.line,
                  }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Notes</div>
          {isManager
            ? <textarea className="ig-finput" rows={4} defaultValue={p.notes || ''} onBlur={e => onUpdate({ notes: e.target.value })} placeholder="Add notes, blockers, or context…" style={{ width:'100%', resize:'vertical', lineHeight:1.5, fontSize:13, background:C.inputBg, color:C.ink, borderColor:C.line }} />
            : <p style={{ fontSize:13, color:C.inkSoft, margin:0, lineHeight:1.6 }}>{p.notes || '—'}</p>
          }
        </div>
      </div>
    </div>
  );
}

function MemberRoleInput({ onAdd }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  return (
    <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
      <input className="ig-finput" placeholder="Member name" value={name} onChange={e => setName(e.target.value)}
        style={{ flex:'1 1 130px', fontSize:12.5, background: C.inputBg, color: C.ink, borderColor: C.line }} />
      <input className="ig-finput" placeholder="Role in project" value={role} onChange={e => setRole(e.target.value)}
        style={{ flex:'1 1 130px', fontSize:12.5, background: C.inputBg, color: C.ink, borderColor: C.line }}
        onKeyDown={e => { if (e.key==='Enter' && name.trim() && role.trim()) { onAdd(name, role); setName(''); setRole(''); } }} />
      <button className="ig-fadd" onClick={() => { if (name.trim() && role.trim()) { onAdd(name, role); setName(''); setRole(''); } }}
        style={{ padding:'5px 12px', fontSize:12 }}>Add</button>
    </div>
  );
}

function GoalsView({ agencyUUID, isManager }) {
  const [projects,  setProjects] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [adding,    setAdding]   = useState(false);
  const [expanded,  setExpanded] = useState(null);
  const [editing,   setEditing]  = useState(false);
  const [form,      setForm]     = useState({ name:'', description:'', goal:'', owner:'', target:'', unit:'', due:'', status:'On track' });
  const supabase = createClient();

  const fromRow = (r) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    goal: r.goal || '',
    owner: r.owner || '',
    due: r.due || '',
    status: r.status || 'On track',
    current: r.progress || 0,
    target: r.target || 0,
    unit: r.unit || '',
    notes: r.notes || '',
    milestones: r.milestones || [],
    memberRoles: r.member_roles || [],
  });

  useEffect(() => {
    if (!agencyUUID) { setLoading(false); return; }
    setLoading(true);

    supabase.from('projects').select('*').eq('agency_id', agencyUUID)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setProjects((data || []).map(fromRow)); setLoading(false); });

    const channel = supabase
      .channel('projects:' + agencyUUID)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `agency_id=eq.${agencyUUID}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects(p => p.find(x => x.id === payload.new.id) ? p : [...p, fromRow(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects(p => p.map(x => x.id === payload.new.id ? fromRow(payload.new) : x));
          } else if (payload.eventType === 'DELETE') {
            setProjects(p => p.filter(x => x.id !== payload.old.id));
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agencyUUID]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const addGoal = async () => {
    if (!form.name.trim() || !agencyUUID) return;
    const row = {
      agency_id: agencyUUID,
      name: form.name, description: form.description, goal: form.goal,
      owner: form.owner, due: form.due, status: form.status,
      progress: 0, target: Number(form.target) || 0, unit: form.unit,
      notes: '', milestones: [], member_roles: [],
    };
    const { data, error } = await supabase.from('projects').insert([row]).select().single();
    if (data) setProjects(p => p.find(x => x.id === data.id) ? p : [...p, fromRow(data)]);
    setForm({ name:'', description:'', goal:'', owner:'', target:'', unit:'', due:'', status:'On track' });
    setAdding(false);
  };

  const updateProject = async (i, patch) => {
    const proj = projects[i];
    if (!proj?.id) return;
    const dbPatch = { ...patch };
    if ('memberRoles' in patch) { dbPatch.member_roles = patch.memberRoles; delete dbPatch.memberRoles; }
    if ('current' in patch)     { dbPatch.progress = patch.current;         delete dbPatch.current; }
    setProjects(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));
    await supabase.from('projects').update(dbPatch).eq('id', proj.id);
  };

  const addMilestone = (i, text) => {
    if (!text.trim()) return;
    const milestones = [...(projects[i].milestones || []), { text, done: false }];
    updateProject(i, { milestones });
  };
  const toggleMilestone = (pi, mi) => {
    const milestones = projects[pi].milestones.map((m, j) => j === mi ? { ...m, done: !m.done } : m);
    updateProject(pi, { milestones });
  };
  const addMemberRole = (i, name, role) => {
    const memberRoles = [...(projects[i].memberRoles || []), { name, role }];
    updateProject(i, { memberRoles });
  };
  const removeMemberRole = (pi, ri) => {
    const memberRoles = (projects[pi].memberRoles || []).filter((_, j) => j !== ri);
    updateProject(pi, { memberRoles });
  };

  const deleteProject = async (i) => {
    const proj = projects[i];
    if (!proj?.id) return;
    setProjects(p => p.filter((_, idx) => idx !== i));
    setExpanded(null);
    setEditing(false);
    await supabase.from('projects').delete().eq('id', proj.id);
  };

  const counts = projects.reduce((a, p) => ((a[p.status] = (a[p.status] || 0) + 1), a), {});

  if (loading) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading projects…</div>;

  return (
    <>
      <div className="ig-kpis">
        <Stat label="Active projects"  value={projects.length}                              sub="across all workstreams" tone="neutral" delay={0}   />
        <Stat label="On track"         value={counts['On track'] || 0}                      sub="meeting milestones"     tone="pos"     delay={60}  />
        <Stat label="At risk / behind" value={(counts['At risk']||0)+(counts['Behind']||0)} sub="need attention"         tone="neg"     delay={120} />
        <Stat label="Completed"        value={counts['Completed'] || 0}                     sub="delivered"              tone="brand"   delay={180} />
      </div>

      {isManager && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16, marginBottom: adding ? 0 : 4 }}>
          <button onClick={() => setAdding(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 14px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
            <Plus size={14} /> Add project
          </button>
        </div>
      )}

      {isManager && adding && (
        <div className="ig-card" style={{ padding:20, marginTop:12, marginBottom:4 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <input className="ig-finput" placeholder="Project name *" value={form.name} onChange={set('name')}
              style={{ gridColumn:'1/-1', background: C.inputBg, color: C.ink, borderColor: C.line }} autoFocus />
            <textarea className="ig-finput" placeholder="Description — what is this project about?" value={form.description} onChange={set('description')}
              rows={2} style={{ gridColumn:'1/-1', resize:'vertical', background: C.inputBg, color: C.ink, borderColor: C.line, lineHeight:1.5 }} />
            <input className="ig-finput" placeholder="Goal / outcome" value={form.goal} onChange={set('goal')}
              style={{ gridColumn:'1/-1', background: C.inputBg, color: C.ink, borderColor: C.line }} />
            <input className="ig-finput" placeholder="Lead / Owner" value={form.owner} onChange={set('owner')}
              style={{ background: C.inputBg, color: C.ink, borderColor: C.line }} />
            <input className="ig-finput" placeholder="Due (e.g. Dec 2026)" value={form.due} onChange={set('due')}
              style={{ background: C.inputBg, color: C.ink, borderColor: C.line }} />
            <input className="ig-finput" placeholder="Target (number)" value={form.target} onChange={set('target')} type="number" min="0"
              style={{ background: C.inputBg, color: C.ink, borderColor: C.line }} />
            <input className="ig-finput" placeholder="Unit (e.g. clients)" value={form.unit} onChange={set('unit')}
              style={{ background: C.inputBg, color: C.ink, borderColor: C.line }} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <select value={form.status} onChange={set('status')}
                style={{ appearance:'none', WebkitAppearance:'none', background: C.inputBg, color: C.ink, border:'1px solid '+C.line, borderRadius:8, padding:'8px 30px 8px 12px', fontSize:13, fontFamily:'inherit', cursor:'pointer', outline:'none', colorScheme: C.inputBg === '#FFFFFF' ? 'light' : 'dark' }}>
                {['On track','At risk','Behind','Completed'].map(s => <option key={s}>{s}</option>)}
              </select>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:C.inkSoft, fontSize:11 }}>▾</span>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="ig-fadd" onClick={addGoal}>Add project</button>
              <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact cards grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16, marginTop:20 }}>
        {projects.map((p, i) => {
          const pct = p.target ? Math.min(100, Math.round((p.current / p.target) * 100)) : 0;
          const t   = statusTone(p.status);
          return (
            <div key={p.name+i} className="ig-card ig-hover rise"
              onClick={() => setExpanded(i)}
              style={{ padding:'18px 20px', animationDelay:i*40+'ms', cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:12 }}>
                <div style={{ minWidth:0 }}>
                  <div className="display" style={{ fontWeight:700, fontSize:14.5, color:C.ink, lineHeight:1.3 }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize:12, color:C.inkSoft, marginTop:3, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <Pill tone={t}>{p.status}</Pill>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                <span className="mono" style={{ fontSize:16, fontWeight:600, color:C.ink }}>
                  {(p.current||0).toLocaleString()}
                  <span style={{ color:C.inkFaint, fontWeight:400, fontSize:12 }}> / {(p.target||0).toLocaleString()} {p.unit}</span>
                </span>
                <span className="mono" style={{ fontSize:12, fontWeight:600, color:toneColor[t] }}>{pct}%</span>
              </div>
              <div className="ig-track">
                <div style={{ width:pct+'%', background:toneColor[t], height:'100%', borderRadius:99, transition:'width .6s' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontSize:11.5, color:C.inkFaint }}>
                <span>Lead · {p.owner || '—'}</span>
                <span>Due {p.due || '—'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Project modal ── */}
      {expanded !== null && projects[expanded] && (() => {
        const p   = projects[expanded];
        const t   = statusTone(p.status);
        const pct = p.target ? Math.min(100, Math.round((p.current / p.target) * 100)) : 0;
        const close = () => { setExpanded(null); setEditing(false); };
        return (
          <div onClick={close}
            style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: C.card === 'rgba(255,255,255,0.04)' ? '#0d1525' : '#fff', borderRadius:20, border:'1px solid '+C.line, boxShadow:'0 24px 64px rgba(0,0,0,0.35)', width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto', padding:'32px 36px', display:'flex', flexDirection:'column', gap:24 }}>

              {/* ── Header ── */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div className="display" style={{ fontSize:20, fontWeight:800, color:C.ink, lineHeight:1.2, marginBottom:8 }}>{p.name}</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <Pill tone={t}>{p.status}</Pill>
                    <span style={{ fontSize:13, color:C.inkSoft }}>Lead · <strong style={{ color:C.ink }}>{p.owner || '—'}</strong></span>
                    <span style={{ fontSize:13, color:C.inkSoft }}>Due <strong style={{ color:C.ink }}>{p.due || '—'}</strong></span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  {isManager && !editing && (
                    <button onClick={() => setEditing(true)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:10, border:'1px solid '+C.line, background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:C.ink, transition:'all .15s' }}>
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                  {editing && (
                    <>
                      <button onClick={() => { if (window.confirm('Delete this project? This cannot be undone.')) deleteProject(expanded); }}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1px solid '+C.alert+'55', background:C.alert+'11', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:C.alert, transition:'all .15s' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                      <button onClick={() => setEditing(false)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:10, border:'none', background:C.brand, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'#fff', transition:'all .15s' }}>
                        <Check size={13} /> Done
                      </button>
                    </>
                  )}
                  <button onClick={close} style={{ background:'none', border:'none', cursor:'pointer', color:C.inkFaint, fontSize:22, lineHeight:1, padding:'2px 4px' }}>✕</button>
                </div>
              </div>

              {/* ── Progress bar ── */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                  <span style={{ fontSize:13, color:C.inkSoft }}>Progress</span>
                  <span className="mono" style={{ fontSize:14, fontWeight:700, color:toneColor[t] }}>{pct}%</span>
                </div>
                <div className="ig-track" style={{ height:10 }}>
                  <div style={{ width:pct+'%', background:toneColor[t], height:'100%', borderRadius:99, transition:'width .6s' }} />
                </div>
                <div style={{ fontSize:12, color:C.inkFaint, marginTop:6 }}>
                  {(p.current||0).toLocaleString()} / {(p.target||0).toLocaleString()} {p.unit}
                </div>
              </div>

              {/* ── Description ── */}
              <div>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Description</div>
                {editing
                  ? <textarea className="ig-finput" rows={3} key={'desc-'+expanded} defaultValue={p.description || ''} onBlur={e => updateProject(expanded, { description: e.target.value })} placeholder="What is this project about?" style={{ width:'100%', resize:'vertical', lineHeight:1.5, fontSize:13, background:C.inputBg, color:C.ink, borderColor:C.line }} />
                  : <p style={{ fontSize:14, color:C.inkSoft, margin:0, lineHeight:1.7 }}>{p.description || '—'}</p>
                }
              </div>

              {/* ── Goal / Outcome ── */}
              <div>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Goal / Outcome</div>
                {editing
                  ? <input className="ig-finput" key={'goal-'+expanded} defaultValue={p.goal || ''} onBlur={e => updateProject(expanded, { goal: e.target.value })} placeholder="What does success look like?" style={{ width:'100%', background:C.inputBg, color:C.ink, borderColor:C.line }} />
                  : <p style={{ fontSize:14, color:C.inkSoft, margin:0, lineHeight:1.7 }}>{p.goal || '—'}</p>
                }
              </div>

              {/* ── Team roles ── */}
              <div>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10 }}>Team roles</div>
                {(p.memberRoles || []).length === 0 && <p style={{ fontSize:13, color:C.inkFaint, margin:'0 0 8px' }}>No roles added yet.</p>}
                {(p.memberRoles || []).map((r, ri) => (
                  <div key={ri} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid '+C.line }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:C.brand, color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {r.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>{r.name}</div>
                      <div style={{ fontSize:12, color:C.inkSoft }}>{r.role}</div>
                    </div>
                    {editing && <button onClick={() => removeMemberRole(expanded, ri)} style={{ background:'none', border:'none', cursor:'pointer', color:C.inkFaint, fontSize:16, padding:'0 4px' }}>✕</button>}
                  </div>
                ))}
                {editing && <MemberRoleInput onAdd={(name, role) => addMemberRole(expanded, name, role)} />}
              </div>

              {/* ── Milestones ── */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase' }}>Milestones</div>
                  {(p.milestones||[]).length > 0 && <span style={{ fontSize:12, color:C.inkSoft }}>{(p.milestones||[]).filter(m=>m.done).length} / {(p.milestones||[]).length} done</span>}
                </div>
                {(p.milestones||[]).length === 0 && <p style={{ fontSize:13, color:C.inkFaint, margin:'0 0 8px' }}>No milestones yet.</p>}
                {(p.milestones||[]).map((m, mi) => (
                  <div key={mi} onClick={() => isManager && toggleMilestone(expanded, mi)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid '+C.line, cursor: isManager ? 'pointer' : 'default' }}>
                    <div style={{ width:18, height:18, borderRadius:5, border:m.done?'none':'1.5px solid '+C.inkFaint, background:m.done?C.pos:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                      {m.done && <Check size={11} color="#fff" />}
                    </div>
                    <span style={{ fontSize:13, color:m.done?C.inkSoft:C.ink, textDecoration:m.done?'line-through':'none', flex:1 }}>{m.text}</span>
                  </div>
                ))}
                {editing && <MilestoneInput onAdd={text => addMilestone(expanded, text)} />}
              </div>

              {/* ── Update progress + status (edit mode, managers only) ── */}
              {editing && (
                <div style={{ display:'flex', flexDirection:'column', gap:12, padding:'20px', borderRadius:12, background: C.card === 'rgba(255,255,255,0.04)' ? 'rgba(255,255,255,0.04)' : 'rgba(20,33,61,0.03)', border:'1px solid '+C.line }}>
                  <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase' }}>Update progress</div>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <input className="ig-finput mono" type="number" min="0" key={'prog-'+expanded} defaultValue={p.current||0}
                      onBlur={e => updateProject(expanded, { current: Number(e.target.value) })}
                      style={{ width:110, background:C.inputBg, color:C.ink, borderColor:C.line }} />
                    <span style={{ color:C.inkSoft, fontSize:13 }}>/ {(p.target||0).toLocaleString()} {p.unit}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase' }}>Status</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['On track','At risk','Behind','Completed'].map(s => (
                      <button key={s} onClick={() => updateProject(expanded, { status:s })}
                        style={{ padding:'6px 16px', borderRadius:20, border:'1px solid '+C.line, fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s',
                          background:  p.status===s ? toneColor[statusTone(s)]+'22' : 'transparent',
                          color:       p.status===s ? toneColor[statusTone(s)]      : C.inkSoft,
                          borderColor: p.status===s ? toneColor[statusTone(s)]+'55' : C.line,
                        }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              <div>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Notes</div>
                {editing
                  ? <textarea className="ig-finput" rows={4} key={'notes-'+expanded} defaultValue={p.notes || ''} onBlur={e => updateProject(expanded, { notes: e.target.value })} placeholder="Add notes, blockers, or context…" style={{ width:'100%', resize:'vertical', lineHeight:1.5, fontSize:13, background:C.inputBg, color:C.ink, borderColor:C.line }} />
                  : <p style={{ fontSize:14, color:C.inkSoft, margin:0, lineHeight:1.7 }}>{p.notes || '—'}</p>
                }
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
}

function MilestoneInput({ onAdd }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display:'flex', gap:8, marginTop:10 }}>
      <input className="ig-finput" placeholder="Add milestone…" value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter' && val.trim()) { onAdd(val); setVal(''); } }}
        style={{ flex:1, fontSize:12.5 }} />
      <button className="ig-fadd" onClick={() => { if (val.trim()) { onAdd(val); setVal(''); } }} style={{ padding:'5px 12px', fontSize:12 }}>Add</button>
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function RevenueView({ agencyUUID, isManager }) {
  const [monthly,  setMonthly] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [editing,  setEditing] = useState(false);
  const supabase = createClient();
  const curYear  = new Date().getFullYear();

  const fromRow = (r) => ({ id: r.id, m: r.month_label, goal: r.goal, actual: r.actual });

  useEffect(() => {
    if (!agencyUUID) { setLoading(false); return; }
    setLoading(true);
    supabase.from('monthly_revenue').select('*')
      .eq('agency_id', agencyUUID).eq('year', curYear)
      .order('month_order', { ascending: true })
      .then(({ data }) => { setMonthly((data || []).map(fromRow)); setLoading(false); });

    const channel = supabase.channel('revenue:' + agencyUUID)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_revenue', filter: `agency_id=eq.${agencyUUID}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setMonthly(p => p.map(x => x.id === payload.new.id ? fromRow(payload.new) : x));
          } else if (payload.eventType === 'INSERT') {
            setMonthly(p => {
              const next = p.find(x => x.id === payload.new.id) ? p : [...p, fromRow(payload.new)];
              return next.sort((a, b) => MONTHS.indexOf(a.m) - MONTHS.indexOf(b.m));
            });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agencyUUID]);

  const initYear = async () => {
    const rows = MONTHS.map((m, i) => ({
      agency_id: agencyUUID, month_label: m, month_order: i + 1,
      year: curYear, goal: 0, actual: null,
    }));
    const { data } = await supabase.from('monthly_revenue').insert(rows).select().order('month_order', { ascending: true });
    if (data) setMonthly(data.map(fromRow));
  };

  const saveCell = async (idx, key, raw) => {
    const val = raw === '' ? null : Number(raw);
    if (isNaN(val) && val !== null) return;
    const row = monthly[idx];
    setMonthly(p => p.map((m, i) => i === idx ? { ...m, [key]: val } : m));
    if (row?.id) await supabase.from('monthly_revenue').update({ [key]: val }).eq('id', row.id);
  };

  if (loading) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading revenue data…</div>;

  if (!monthly.length) return (
    <Card style={{ marginTop:16, textAlign:'center', padding:'48px 24px' }}>
      <p style={{ color:C.inkSoft, marginBottom:16 }}>No revenue data for {curYear} yet.</p>
      {isManager && <button onClick={initYear} className="ig-fadd">Initialise {curYear}</button>}
    </Card>
  );
  const real     = monthly.filter((m) => m.actual != null);
  const fyGoal   = monthly.reduce((a, m) => a + m.goal, 0);
  const ytdA     = real.reduce((a, m) => a + m.actual, 0);
  const ytdG     = real.reduce((a, m) => a + m.goal, 0);
  const variance = ytdG > 0 ? ((ytdA - ytdG) / ytdG) * 100 : 0;
  const best     = real.length ? real.reduce((a, m) => (m.actual > a.actual ? m : a)) : { m:'—', actual:0 };
  return (
    <>
      <div className="ig-kpis">
        <Stat label="FY26 revenue goal" value={kesC(fyGoal)} sub="full year target"                                                          tone="brand"                    delay={0}   />
        <Stat label="YTD actual"        value={kesC(ytdA)}   sub={real.length+' months realised'}                                            tone="pos"                      delay={60}  />
        <Stat label="Variance to goal"  value={(variance>=0?'+':'')+variance.toFixed(1)+'%'} sub={variance>=0?'ahead of plan':'behind plan'} tone={variance>=0?'pos':'neg'}  delay={120} />
        <Stat label="Best month"        value={best.m}       sub={kesC(best.actual)+' booked'}                                               tone="neutral"                  delay={180} />
      </div>
      <Card title="Revenue — goal vs. actual" style={{ marginTop:16 }}
        action={<div style={{ display:'flex', gap:14, fontSize:12, color:C.inkSoft }}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:10, height:10, borderRadius:3, background:C.brand, display:'inline-block' }} />Actual</span>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:14, height:2, background:C.signal, display:'inline-block' }} />Goal</span>
        </div>}>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={monthly} margin={{ top:8, right:8, left:-10, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
            <XAxis dataKey="m" tick={chartAxis} axisLine={false} tickLine={false} />
            <YAxis tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={fmtY} />
            <Tooltip {...ttStyle} formatter={(v, n) => [v == null ? '—' : kes(v), n==='actual' ? 'Actual' : 'Goal']} />
            <Bar dataKey="actual" fill={C.brand} radius={[5,5,0,0]} barSize={26} />
            <Line type="monotone" dataKey="goal" stroke={C.signal} strokeWidth={2.5} dot={false} strokeDasharray="5 4" />
          </ComposedChart>
        </ResponsiveContainer>

        {isManager && <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={() => setEditing((v) => !v)} className="ig-kbtn"
            style={{ width:'auto', padding:'0 14px', gap:6, fontFamily:'inherit', fontSize:12.5, fontWeight:600,
              background: editing ? C.pos : C.brand, color:'#fff', border:'none' }}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>}

        <div style={{ marginTop:16, borderTop:'1px solid '+C.line, paddingTop:20 }}>
          <table className="ig-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign:'right' }}>Goal</th>
                <th style={{ textAlign:'right' }}>Actual</th>
                <th style={{ textAlign:'right' }}>Variance</th>
                <th style={{ textAlign:'right' }}>vs. Goal</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, idx) => {
                const hasActual = m.actual != null;
                const diff      = hasActual ? m.actual - m.goal : null;
                const pct       = hasActual && m.goal > 0 ? ((m.actual - m.goal) / m.goal) * 100 : null;
                return (
                  <tr key={m.m}>
                    <td style={{ fontWeight:600, color:C.ink }}>{m.m}</td>
                    <td className="mono" style={{ textAlign:'right', color:C.inkSoft }}>
                      {isManager && editing
                        ? <input className="ig-finput mono" type="number" defaultValue={m.goal} onBlur={(e) => saveCell(idx,'goal',e.target.value)} style={{ width:110, textAlign:'right', padding:'4px 8px', fontSize:12.5 }} />
                        : kes(m.goal)}
                    </td>
                    <td className="mono" style={{ textAlign:'right', fontWeight:600, color:hasActual ? C.ink : C.inkFaint }}>
                      {isManager && editing
                        ? <input className="ig-finput mono" type="number" defaultValue={m.actual ?? ''} placeholder="—" onBlur={(e) => saveCell(idx,'actual',e.target.value)} style={{ width:110, textAlign:'right', padding:'4px 8px', fontSize:12.5 }} />
                        : hasActual ? kes(m.actual) : '—'}
                    </td>
                    <td className="mono" style={{ textAlign:'right', color: diff == null ? C.inkFaint : diff >= 0 ? C.pos : C.alert }}>
                      {diff == null ? '—' : (diff >= 0 ? '+' : '') + kes(diff)}
                    </td>
                    <td style={{ textAlign:'right' }}>
                      {pct == null
                        ? <span style={{ color:C.inkFaint, fontSize:12 }}>upcoming</span>
                        : <Pill tone={pct >= 0 ? 'pos' : 'neg'}>{(pct >= 0 ? '+' : '')+pct.toFixed(1)+'%'}</Pill>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid '+C.line }}>
                <td style={{ fontWeight:700, color:C.ink, paddingTop:14 }}>Total / YTD</td>
                <td className="mono" style={{ textAlign:'right', fontWeight:700, color:C.ink, paddingTop:14 }}>{kes(fyGoal)}</td>
                <td className="mono" style={{ textAlign:'right', fontWeight:700, color:C.brand, paddingTop:14 }}>{kes(ytdA)}</td>
                <td className="mono" style={{ textAlign:'right', fontWeight:700, color: ytdA-ytdG >= 0 ? C.pos : C.alert, paddingTop:14 }}>
                  {(ytdA-ytdG >= 0 ? '+' : '') + kes(ytdA - ytdG)}
                </td>
                <td style={{ textAlign:'right', paddingTop:14 }}>
                  <Pill tone={variance >= 0 ? 'pos' : 'neg'}>{(variance>=0?'+':'')+variance.toFixed(1)+'%'}</Pill>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function useSimpleTable(table, agencyUUID, orderCol = 'created_at') {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [sb]                  = useState(() => createClient());

  useEffect(() => {
    if (!agencyUUID) { setLoading(false); return; }
    setLoading(true);
    sb.from(table).select('*').eq('agency_id', agencyUUID).order(orderCol, { ascending: true })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
    const ch = sb.channel(table + ':' + agencyUUID)
      .on('postgres_changes', { event:'*', schema:'public', table, filter:`agency_id=eq.${agencyUUID}` },
        ({ eventType: ev, new: n, old: o }) => {
          if (ev === 'INSERT') setRows(p => p.find(x => x.id === n.id) ? p : [...p, n]);
          else if (ev === 'UPDATE') setRows(p => p.map(x => x.id === n.id ? n : x));
          else if (ev === 'DELETE') setRows(p => p.filter(x => x.id !== o.id));
        }).subscribe();
    return () => sb.removeChannel(ch);
  }, [agencyUUID]); // eslint-disable-line react-hooks/exhaustive-deps

  const dbInsert = async (data) => {
    const { data: row } = await sb.from(table).insert([{ agency_id: agencyUUID, ...data }]).select().single();
    return row;
  };
  const dbUpdate = async (id, patch) => {
    setRows(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    await sb.from(table).update(patch).eq('id', id);
  };
  const dbDelete = async (id) => {
    setRows(p => p.filter(x => x.id !== id));
    await sb.from(table).delete().eq('id', id);
  };

  return { rows, setRows, loading, dbInsert, dbUpdate, dbDelete };
}

function LossView({ agencyUUID, isManager }) {
  const { rows: lossRows, loading, dbInsert, dbUpdate, dbDelete } = useSimpleTable('losses', agencyUUID);
  const losses = [...lossRows].sort((a, b) => b.amount - a.amount);

  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState({ source:'', amount:'', note:'' });
  const [editingId, setEditingId] = useState(null);
  const [editForm,  setEditForm]  = useState({ source:'', amount:'', note:'' });

  const [ytdActual, setYtdActual] = useState(0);
  const [sbRev]                   = useState(() => createClient());
  useEffect(() => {
    if (!agencyUUID) return;
    sbRev.from('monthly_revenue').select('actual').eq('agency_id', agencyUUID)
      .then(({ data }) => setYtdActual((data || []).reduce((a, r) => a + (r.actual || 0), 0)));
  }, [agencyUUID]); // eslint-disable-line react-hooks/exhaustive-deps

  const set  = (k) => (e) => setForm(p => ({ ...p, [k]:e.target.value }));
  const setE = (k) => (e) => setEditForm(p => ({ ...p, [k]:e.target.value }));

  const addLoss = async () => {
    if (!form.source.trim() || !form.amount) return;
    await dbInsert({ source: form.source, amount: Number(form.amount), note: form.note });
    setForm({ source:'', amount:'', note:'' });
    setAdding(false);
  };
  const startEdit = (l) => { setEditForm({ source:l.source, amount:l.amount, note:l.note||'' }); setEditingId(l.id); };
  const saveEdit  = async () => {
    if (!editForm.source.trim()) return;
    await dbUpdate(editingId, { source:editForm.source, amount:Number(editForm.amount)||0, note:editForm.note });
    setEditingId(null);
  };

  const total = losses.reduce((a, l) => a + l.amount, 0);
  const top   = losses[0] || { source:'—', amount:0 };
  const share = ytdActual > 0 ? ((total / ytdActual) * 100).toFixed(1) + '%' : '—';
  const recov = losses.length >= 3 ? kesC(losses[0].amount + losses[2].amount) : losses.length >= 1 ? kesC(losses[0].amount) : '—';

  if (loading) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  if (!losses.length) return (
    <>
      {isManager && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button onClick={() => setAdding((v) => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 14px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
          <Plus size={14} /> Add loss
        </button>
      </div>}
      {isManager && adding && (
        <div className="ig-card" style={{ padding:20, marginBottom:12 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            <input  className="ig-finput" placeholder="Source *"       value={form.source} onChange={set('source')} style={{ flex:'1 1 180px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addLoss()} />
            <input  className="ig-finput" placeholder="Amount (KES) *" value={form.amount} onChange={set('amount')} style={{ width:160 }} type="number" min="0" />
            <input  className="ig-finput" placeholder="Note"           value={form.note}   onChange={set('note')}   style={{ flex:'1 1 220px' }} />
            <button className="ig-fadd"    onClick={addLoss}>Add</button>
            <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
      <Card style={{ textAlign:'center', padding:'48px 24px' }}>
        <div style={{ fontSize:36, marginBottom:12 }}>✓</div>
        <div style={{ color:C.ink, fontWeight:700, fontSize:16 }}>No revenue leakage recorded</div>
        <div style={{ color:C.inkSoft, fontSize:13.5, marginTop:6 }}>Actual revenue is meeting or exceeding targets.</div>
      </Card>
    </>
  );

  return (
    <>
      <div className="ig-kpis">
        <Stat label="Total leakage YTD"  value={kesC(total)} sub={losses.length+' sources identified'} tone="neg"     delay={0} />
        <Stat label="Largest source"     value={top.source}  sub={kesC(top.amount)}                    tone="neg"     delay={60} />
        <Stat label="Share of revenue"   value={share}       sub="of YTD actual"                       tone="warn"    delay={120} />
        <Stat label="Recoverable est."   value={recov}       sub="top + 3rd source"                    tone="brand"   delay={180} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:24, marginTop:20 }} className="ig-2col">
        <Card title="Loss by source">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={losses} layout="vertical" margin={{ top:0, right:16, left:8, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
              <XAxis type="number" tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1e3 ? Math.round(v/1e3)+'K' : v} />
              <YAxis type="category" dataKey="source" tick={{ ...chartAxis, fontSize:11 }} width={130} axisLine={false} tickLine={false} />
              <Tooltip {...ttStyle} formatter={(v) => [kes(v), 'Loss']} cursor={{ fill:'rgba(224,72,90,0.06)' }} />
              <Bar dataKey="amount" radius={[0,5,5,0]} barSize={18}>
                {losses.map((_, i) => <Cell key={i} fill={i === 0 ? C.alert : C.alert+(i < 3 ? 'CC' : '88')} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Composition">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={losses} dataKey="amount" nameKey="source" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none">
                {losses.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip {...ttStyle} formatter={(v, n) => [kes(v), n]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Detail" style={{ marginTop:16 }}
        action={isManager && <button onClick={() => setAdding((v) => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
            <Plus size={14} /> Add loss
          </button>}>
        {isManager && adding && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'4px 0 14px', borderBottom:'1px solid '+C.line, marginBottom:16 }}>
            <input  className="ig-finput" placeholder="Source *"       value={form.source} onChange={set('source')} style={{ flex:'1 1 180px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addLoss()} />
            <input  className="ig-finput" placeholder="Amount (KES) *" value={form.amount} onChange={set('amount')} style={{ width:160 }} type="number" min="0" />
            <input  className="ig-finput" placeholder="Note"           value={form.note}   onChange={set('note')}   style={{ flex:'1 1 220px' }} />
            <button className="ig-fadd"    onClick={addLoss}>Add</button>
            <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        )}
        <table className="ig-table">
          <thead>
            <tr>
              <th>Source</th><th>Note</th>
              <th style={{ textAlign:'right' }}>Amount</th>
              <th style={{ textAlign:'right' }}>Share</th>
              <th style={{ width:72 }} />
            </tr>
          </thead>
          <tbody>
            {losses.map((l) => isManager && editingId === l.id ? (
              <tr key={l.id}>
                <td><input className="ig-finput" value={editForm.source} onChange={setE('source')} style={{ width:'100%', padding:'5px 8px', fontSize:12.5 }} autoFocus /></td>
                <td><input className="ig-finput" value={editForm.note}   onChange={setE('note')}   style={{ width:'100%', padding:'5px 8px', fontSize:12.5 }} /></td>
                <td><input className="ig-finput mono" type="number" value={editForm.amount} onChange={setE('amount')} style={{ width:120, textAlign:'right', padding:'5px 8px', fontSize:12.5 }} /></td>
                <td />
                <td>
                  <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                    <button className="ig-fadd"    onClick={saveEdit}                style={{ padding:'4px 10px', fontSize:12 }}>Save</button>
                    <button className="ig-fcancel" onClick={() => setEditingId(null)} style={{ padding:'4px 8px',  fontSize:12 }}>✕</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={l.id}>
                <td style={{ fontWeight:600, color:C.ink }}>{l.source}</td>
                <td style={{ color:C.inkSoft }}>{l.note}</td>
                <td className="mono" style={{ textAlign:'right', color:C.alert, fontWeight:600 }}>{kes(l.amount)}</td>
                <td className="mono" style={{ textAlign:'right', color:C.inkSoft }}>{Math.round((l.amount/total)*100)}%</td>
                {isManager && <td>
                  <div className="ig-rowactions" style={{ display:'flex', gap:4, justifyContent:'flex-end', opacity:0, transition:'opacity .15s' }}>
                    <button onClick={() => startEdit(l)} className="ig-kbtn" style={{ width:28, height:28, borderRadius:7, color:C.inkSoft }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => dbDelete(l.id)} className="ig-kbtn" style={{ width:28, height:28, borderRadius:7, color:C.alert, borderColor:'rgba(224,72,90,.25)' }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ExpenditureView({ agencyUUID, isManager }) {
  const { rows: expRows,   loading: loadExp,   dbInsert: insExp,   dbDelete: delExp }   = useSimpleTable('expenditures',  agencyUUID);
  const { rows: spendRows, loading: loadSpend, dbInsert: insSpend, dbUpdate: updSpend } = useSimpleTable('monthly_spend',  agencyUUID, 'month_order');

  const [adding, setAdding] = useState(false);
  const [form,   setForm]   = useState({ cat:'', amount:'' });

  const expenses = [...expRows].sort((a, b) => b.amount - a.amount);
  const expTrend = spendRows.map(r => ({ id:r.id, m:r.month_label, amount:r.amount || 0 }));

  const set    = (k) => (e) => setForm(p => ({ ...p, [k]:e.target.value }));
  const addExp = async () => {
    if (!form.cat.trim() || !form.amount) return;
    await insExp({ category: form.cat, amount: Number(form.amount) });
    setForm({ cat:'', amount:'' });
    setAdding(false);
  };

  const initSpend = async () => {
    const curYear = new Date().getFullYear();
    const rows = MONTHS_SHORT.map((m, i) => ({ agency_id: agencyUUID, month_label: m, month_order: i + 1, year: curYear, amount: 0 }));
    const { data } = await createClient().from('monthly_spend').insert(rows).select().order('month_order', { ascending: true });
    if (data) { /* real-time will push these in */ }
  };
  const saveSpend = async (id, raw) => {
    const val = raw === '' ? 0 : Number(raw);
    if (isNaN(val)) return;
    await updSpend(id, { amount: val });
  };

  const total     = expenses.reduce((a, e) => a + e.amount, 0);
  const top       = expenses[0] || { category:'—', amount:1 };
  const first     = expTrend[0]?.amount || 1;
  const last      = expTrend[expTrend.length-1]?.amount || 1;
  const burnTrend = Math.round(((last - first) / first) * 100);
  const sixTotal  = expTrend.reduce((a, e) => a + e.amount, 0);

  if (loadExp || loadSpend) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  return (
    <>
      <div className="ig-kpis">
        <Stat label="Monthly operating spend" value={kesC(total)}                               sub="current month"                                                          tone="neutral" delay={0}   />
        <Stat label="Largest category"        value={top.category.split(' ')[0]}               sub={kesC(top.amount)+' · '+Math.round((top.amount/(total||1))*100)+'%'}       tone="neutral" delay={60}  />
        <Stat label="6-mo total spend"        value={kesC(sixTotal)}                           sub="rolling burn"                                                            tone="warn"    delay={120} />
        <Stat label="Burn trend"              value={(burnTrend>=0?'+':'')+burnTrend+'%'}       sub="6-month change"                                                          tone={burnTrend>10?'neg':'neutral'} delay={180} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:24, marginTop:20 }} className="ig-2col">
        <Card title="Spend by category">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={expenses} dataKey="amount" nameKey="category" innerRadius={56} outerRadius={90} paddingAngle={2} stroke="none">
                {expenses.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip {...ttStyle} formatter={(v, n) => [kes(v), n]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Monthly burn"
          action={isManager && expTrend.length === 0 && <button onClick={initSpend} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>Init {new Date().getFullYear()}</button>}>
          {expTrend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={expTrend} margin={{ top:8, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="m" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={fmtY} />
                  <Tooltip {...ttStyle} formatter={(v) => [kes(v), 'Spend']} cursor={{ fill:'rgba(20,33,61,0.04)' }} />
                  <Bar dataKey="amount" fill={C.brand} radius={[5,5,0,0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
              {isManager && (
                <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:6 }}>
                  {expTrend.map((row) => (
                    <div key={row.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <span style={{ fontSize:10.5, color:C.inkFaint }}>{row.m}</span>
                      <input
                        className="ig-finput mono"
                        defaultValue={row.amount || ''}
                        onBlur={(e) => saveSpend(row.id, e.target.value)}
                        style={{ width:74, textAlign:'right', padding:'4px 6px', fontSize:11.5 }}
                        type="number" min="0"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'48px 0' }}>No monthly data — click "Init {new Date().getFullYear()}" to create rows.</div>
          )}
        </Card>
      </div>
      <Card title="Category breakdown" style={{ marginTop:16 }}
        action={isManager && <button onClick={() => setAdding((v) => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
            <Plus size={14} /> Add expenditure
          </button>}>
        {isManager && adding && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'4px 0 14px', borderBottom:'1px solid '+C.line, marginBottom:16 }}>
            <input  className="ig-finput" placeholder="Category *"     value={form.cat}    onChange={set('cat')}    style={{ flex:'1 1 200px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addExp()} />
            <input  className="ig-finput" placeholder="Amount (KES) *" value={form.amount} onChange={set('amount')} style={{ width:160 }} type="number" min="0" />
            <button className="ig-fadd"    onClick={addExp}>Add</button>
            <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        )}
        {expenses.map((e, i) => (
          <div key={e.id} className="ig-taskrow" style={{ display:'flex', alignItems:'center', gap:14, padding:'9px 0', borderBottom: i < expenses.length-1 ? '1px solid '+C.line : 'none' }}>
            <span style={{ width:10, height:10, borderRadius:3, background:PIE[i % PIE.length], flexShrink:0 }} />
            <span style={{ flex:1, fontWeight:500, color:C.ink, fontSize:13.5 }}>{e.category}</span>
            <div className="ig-track" style={{ width:160 }}>
              <div style={{ width:(e.amount/(top.amount||1))*100+'%', height:'100%', background:PIE[i % PIE.length], borderRadius:99 }} />
            </div>
            <span className="mono" style={{ width:120, textAlign:'right', fontWeight:600, color:C.ink, fontSize:13 }}>{kes(e.amount)}</span>
            {isManager && <button className="ig-delrow" onClick={() => delExp(e.id)} title="Remove"><Trash2 size={13} /></button>}
          </div>
        ))}
        {expenses.length === 0 && <div style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'24px 0' }}>No expenditure categories yet.</div>}
      </Card>
    </>
  );
}

function ModelsView({ agencyUUID, isManager }) {
  const { rows: models, loading, dbInsert, dbDelete } = useSimpleTable('revenue_models', agencyUUID);
  const [adding, setAdding] = useState(false);
  const [form,   setForm]   = useState({ name:'', description:'', mtd:'', trend:'', share:'', tracked:true });

  const set      = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const addModel = async () => {
    if (!form.name.trim() || !form.mtd) return;
    await dbInsert({ name:form.name, description:form.description, mtd:Number(form.mtd), trend:Number(form.trend)||0, share:Number(form.share)||0, tracked:form.tracked });
    setForm({ name:'', description:'', mtd:'', trend:'', share:'', tracked:true });
    setAdding(false);
  };

  const total   = models.reduce((a, m) => a + m.mtd, 0);
  const tracked = models.filter(m => m.tracked).length;
  const fastest = models.length ? models.reduce((a, m) => (m.trend > a.trend ? m : a)) : { name:'—', trend:0 };
  const topM    = models.length ? models.reduce((a, m) => (m.mtd > a.mtd ? m : a))    : { share:0, name:'—' };

  if (loading) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  return (
    <>
      <div className="ig-kpis">
        <Stat label="Monthly revenue"  value={kesC(total)}                sub="all streams"                                  tone="brand"   delay={0}   />
        <Stat label="Streams tracked"  value={tracked+' / '+models.length} sub={(models.length-tracked)+' not yet monitored'} tone="warn"    delay={60}  />
        <Stat label="Fastest grower"   value={fastest.name.split(' ')[0]} sub={'+'+fastest.trend+'% MoM'}                    tone="pos"     delay={120} />
        <Stat label="Top stream share" value={topM.share+'%'}             sub={topM.name}                                    tone="neutral" delay={180} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:24, marginTop:20 }} className="ig-2col">
        <Card title="Revenue mix">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={models} dataKey="mtd" nameKey="name" innerRadius={54} outerRadius={90} paddingAngle={2} stroke="none">
                {models.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip {...ttStyle} formatter={(v, n) => [kes(v), n]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Streams — tracking status"
          action={isManager && <button onClick={() => setAdding(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
              <Plus size={14} /> Add model
            </button>}>
          {isManager && adding && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'4px 0 14px', borderBottom:'1px solid '+C.line, marginBottom:14 }}>
              <input  className="ig-finput" placeholder="Model name *"        value={form.name}        onChange={set('name')}        style={{ flex:'1 1 160px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addModel()} />
              <input  className="ig-finput" placeholder="Description"         value={form.description} onChange={set('description')} style={{ flex:'1 1 200px' }} />
              <input  className="ig-finput" placeholder="MTD revenue (KES) *" value={form.mtd}         onChange={set('mtd')}         style={{ width:160 }} type="number" min="0" />
              <input  className="ig-finput" placeholder="MoM trend %"         value={form.trend}       onChange={set('trend')}       style={{ width:120 }} type="number" />
              <input  className="ig-finput" placeholder="Share %"             value={form.share}       onChange={set('share')}       style={{ width:100 }} type="number" min="0" max="100" />
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.inkSoft, cursor:'pointer' }}>
                <input type="checkbox" checked={form.tracked} onChange={set('tracked')} style={{ width:15, height:15, accentColor:C.brand }} />
                Tracked
              </label>
              <button className="ig-fadd"    onClick={addModel}>Add</button>
              <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {models.map((m, i) => (
              <div key={m.id} className="ig-taskrow ig-hover" style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 12px', border:'1px solid '+C.line, borderRadius:12 }}>
                <span style={{ width:9, height:9, borderRadius:99, background:PIE[i % PIE.length], flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, color:C.ink, fontSize:13.5 }}>{m.name}</div>
                  <div style={{ fontSize:12, color:C.inkSoft, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.description}</div>
                </div>
                <Delta v={m.trend} />
                <span className="mono" style={{ width:88, textAlign:'right', fontWeight:600, color:C.ink, fontSize:13 }}>{kesC(m.mtd)}</span>
                <Pill tone={m.tracked ? 'pos' : 'neutral'}>{m.tracked ? 'Tracked' : 'Not tracked'}</Pill>
                {isManager && <button className="ig-delrow" onClick={() => dbDelete(m.id)} title="Remove"><Trash2 size={13} /></button>}
              </div>
            ))}
            {models.length === 0 && <div style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'24px 0' }}>No revenue streams added yet.</div>}
          </div>
        </Card>
      </div>
    </>
  );
}

function RatesView({ agencyUUID, isManager }) {
  const { rows: rateCard,    loading: loadRC,  dbInsert: insRate, dbDelete: delRate }           = useSimpleTable('rate_card',    agencyUUID);
  const { rows: receivables, loading: loadRec, dbInsert: insRec,  dbDelete: delRec, dbUpdate: updRec } = useSimpleTable('receivables',  agencyUUID);

  const [addingRate, setAddingRate] = useState(false);
  const [addingRec,  setAddingRec]  = useState(false);
  const [rateForm,   setRateForm]   = useState({ service:'', unit:'', rate:'' });
  const [recForm,    setRecForm]    = useState({ client:'', service:'', amount:'', due:'', status:'Pending' });

  const setR   = (k) => (e) => setRateForm(p => ({ ...p, [k]:e.target.value }));
  const setRec = (k) => (e) => setRecForm(p => ({ ...p, [k]:e.target.value }));

  const addRate = async () => {
    if (!rateForm.service.trim() || !rateForm.rate) return;
    await insRate({ service:rateForm.service, unit:rateForm.unit, rate:Number(rateForm.rate) });
    setRateForm({ service:'', unit:'', rate:'' });
    setAddingRate(false);
  };
  const addRec = async () => {
    if (!recForm.client.trim() || !recForm.amount) return;
    await insRec({ client:recForm.client, service:recForm.service, amount:Number(recForm.amount), due:recForm.due, status:recForm.status });
    setRecForm({ client:'', service:'', amount:'', due:'', status:'Pending' });
    setAddingRec(false);
  };

  const owed    = receivables.filter(r => r.status !== 'Paid').reduce((a, r) => a + r.amount, 0);
  const overdue = receivables.filter(r => r.status === 'Overdue').reduce((a, r) => a + r.amount, 0);
  const paid    = receivables.filter(r => r.status === 'Paid').reduce((a, r) => a + r.amount, 0);

  if (loadRC || loadRec) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  return (
    <>
      <div className="ig-kpis">
        <Stat label="Total outstanding"    value={kesC(owed)}       sub={receivables.filter(r=>r.status!=='Paid').length+' clients'}              tone="warn"    delay={0}   />
        <Stat label="Overdue"              value={kesC(overdue)}    sub={receivables.filter(r=>r.status==='Overdue').length+' invoice(s) past due'} tone="neg"     delay={60}  />
        <Stat label="Collected this month" value={kesC(paid)}       sub="settled"                                                                  tone="pos"     delay={120} />
        <Stat label="Services on offer"    value={rateCard.length}  sub="published rate card"                                                      tone="neutral" delay={180} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:24, marginTop:20 }} className="ig-2col">
        <Card title="Rate card"
          action={isManager && <button onClick={() => setAddingRate(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}><Plus size={14} /> Add service</button>}>
          {isManager && addingRate && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'4px 0 14px', borderBottom:'1px solid '+C.line, marginBottom:12 }}>
              <input  className="ig-finput" placeholder="Service *"         value={rateForm.service} onChange={setR('service')} style={{ flex:'1 1 150px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addRate()} />
              <input  className="ig-finput" placeholder="Unit (e.g. /day)" value={rateForm.unit}    onChange={setR('unit')}    style={{ flex:'1 1 130px' }} />
              <input  className="ig-finput" placeholder="Rate (KES) *"     value={rateForm.rate}    onChange={setR('rate')}    style={{ width:130 }} type="number" min="0" />
              <button className="ig-fadd"    onClick={addRate}>Add</button>
              <button className="ig-fcancel" onClick={() => setAddingRate(false)}>Cancel</button>
            </div>
          )}
          <table className="ig-table">
            <thead><tr><th>Service</th><th style={{ textAlign:'right' }}>Rate</th>{isManager && <th style={{ width:32 }} />}</tr></thead>
            <tbody>
              {rateCard.map((r) => (
                <tr key={r.id}>
                  <td><div style={{ fontWeight:600, color:C.ink }}>{r.service}</div><div style={{ fontSize:11.5, color:C.inkFaint }}>{r.unit}</div></td>
                  <td className="mono" style={{ textAlign:'right', fontWeight:600, color:C.brand }}>{kes(r.rate)}</td>
                  {isManager && <td style={{ textAlign:'right' }}><button className="ig-delrow" onClick={() => delRate(r.id)} title="Remove"><Trash2 size={13} /></button></td>}
                </tr>
              ))}
              {rateCard.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', color:C.inkFaint, padding:'20px 0' }}>No services added yet.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Receivables — amount owed"
          action={isManager && <button onClick={() => setAddingRec(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}><Plus size={14} /> Add receivable</button>}>
          {isManager && addingRec && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'4px 0 14px', borderBottom:'1px solid '+C.line, marginBottom:12 }}>
              <input  className="ig-finput" placeholder="Client *"      value={recForm.client}  onChange={setRec('client')}  style={{ flex:'1 1 130px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addRec()} />
              <input  className="ig-finput" placeholder="Service"       value={recForm.service} onChange={setRec('service')} style={{ flex:'1 1 130px' }} />
              <input  className="ig-finput" placeholder="Amount (KES)*" value={recForm.amount}  onChange={setRec('amount')}  style={{ width:140 }} type="number" min="0" />
              <input  className="ig-finput" placeholder="Due date"      value={recForm.due}     onChange={setRec('due')}     style={{ width:110 }} />
              <select className="ig-fselect" value={recForm.status} onChange={setRec('status')}>
                {['Pending','Paid','Overdue','Partial'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="ig-fadd"    onClick={addRec}>Add</button>
              <button className="ig-fcancel" onClick={() => setAddingRec(false)}>Cancel</button>
            </div>
          )}
          <table className="ig-table">
            <thead><tr><th>Client</th><th>Service</th><th>Due</th><th style={{ textAlign:'right' }}>Owed</th><th style={{ textAlign:'right' }}>Status</th>{isManager && <th style={{ width:32 }} />}</tr></thead>
            <tbody>
              {receivables.map((r) => (
                <tr key={r.id} style={r.status === 'Overdue' ? { background: C.alert+'0D' } : undefined}>
                  <td style={{ fontWeight:600, color:C.ink }}>{r.client}</td>
                  <td style={{ color:C.inkSoft }}>{r.service}</td>
                  <td className="mono" style={{ color:C.inkSoft, fontSize:12 }}>{r.due}</td>
                  <td className="mono" style={{ textAlign:'right', fontWeight:600, color:C.ink }}>{kes(r.amount)}</td>
                  <td style={{ textAlign:'right' }}>
                    {isManager ? (
                      <select className="ig-fselect" value={r.status} onChange={(e) => updRec(r.id, { status:e.target.value })} style={{ fontSize:11.5, padding:'3px 6px', height:26 }}>
                        {['Pending','Paid','Overdue','Partial'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                    )}
                  </td>
                  {isManager && <td style={{ textAlign:'right' }}><button className="ig-delrow" onClick={() => delRec(r.id)} title="Remove"><Trash2 size={13} /></button></td>}
                </tr>
              ))}
              {receivables.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:C.inkFaint, padding:'20px 0' }}>No receivables recorded.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

const PIPELINE_STAGES = ['Prospect','Proposal','Negotiation','Won','Lost'];
const STAGE_TONE = { Prospect:'neutral', Proposal:'brand', Negotiation:'warn', Won:'pos', Lost:'neg' };

function GrowthView({ agencyUUID, isManager }) {
  const { rows: quarterly,    loading: loadQ,  dbInsert: insQ,      dbDelete: delQ }      = useSimpleTable('growth_quarterly', agencyUUID);
  const { rows: revenueSplit, loading: loadRS, dbInsert: insClient, dbDelete: delClient } = useSimpleTable('growth_clients',   agencyUUID);
  const { rows: pipeline,     loading: loadP,  dbInsert: insDeal,   dbDelete: delDeal, dbUpdate: updDeal } = useSimpleTable('growth_pipeline', agencyUUID);
  const { rows: leversRaw,    loading: loadL,  dbInsert: insLever,  dbDelete: delLever, dbUpdate: updLever } = useSimpleTable('growth_levers', agencyUUID);

  const levers = leversRaw.map(r => ({ id:r.id, k:r.key_name, v:r.value, note:r.note }));

  const [editingLeverId, setEditingLeverId] = useState(null);
  const [leverForm,      setLeverForm]      = useState({ k:'', v:'', note:'' });
  const [addingLever,    setAddingLever]    = useState(false);
  const [addingQ,        setAddingQ]        = useState(false);
  const [qForm,          setQForm]          = useState({ period:'', actual:'', target:'', clients:'' });
  const [addingDeal,     setAddingDeal]     = useState(false);
  const [dealForm,       setDealForm]       = useState({ client:'', value:'', stage:'Prospect', owner:'', probability:'' });
  const [addingClient,   setAddingClient]   = useState(false);
  const [clientForm,     setClientForm]     = useState({ name:'', value:'' });

  const setLF = (k) => (e) => setLeverForm(p => ({ ...p, [k]:e.target.value }));
  const setQF = (k) => (e) => setQForm(p    => ({ ...p, [k]:e.target.value }));
  const setDF = (k) => (e) => setDealForm(p => ({ ...p, [k]:e.target.value }));
  const setCF = (k) => (e) => setClientForm(p => ({ ...p, [k]:e.target.value }));

  const startEditLever = (l) => { setLeverForm({ k:l.k, v:l.v, note:l.note }); setEditingLeverId(l.id); };
  const saveLever = async () => {
    await updLever(editingLeverId, { key_name:leverForm.k, value:leverForm.v, note:leverForm.note });
    setEditingLeverId(null);
  };

  const addQuarter = async () => {
    if (!qForm.period.trim()) return;
    await insQ({ period:qForm.period, actual:Number(qForm.actual)||0, target:Number(qForm.target)||0, clients:Number(qForm.clients)||0 });
    setQForm({ period:'', actual:'', target:'', clients:'' });
    setAddingQ(false);
  };

  const addDeal = async () => {
    if (!dealForm.client.trim()) return;
    await insDeal({ client:dealForm.client, value:Number(dealForm.value)||0, stage:dealForm.stage, owner:dealForm.owner, probability:Number(dealForm.probability)||0 });
    setDealForm({ client:'', value:'', stage:'Prospect', owner:'', probability:'' });
    setAddingDeal(false);
  };
  const moveDeal = async (id, stage) => updDeal(id, { stage });

  const addClient = async () => {
    if (!clientForm.name.trim()) return;
    await insClient({ name:clientForm.name, value:Number(clientForm.value)||0 });
    setClientForm({ name:'', value:'' });
    setAddingClient(false);
  };

  const addLeverRow = async () => {
    if (!leverForm.k.trim()) return;
    await insLever({ key_name:leverForm.k, value:leverForm.v, note:leverForm.note });
    setLeverForm({ k:'', v:'', note:'' });
    setAddingLever(false);
  };

  const latestQ          = quarterly[quarterly.length - 1] || {};
  const latestActual     = latestQ.actual || 0;
  const latestTarget     = latestQ.target || 1;
  const revenueAchieved  = Math.round((latestActual / latestTarget) * 100);
  const totalPipeline    = pipeline.filter(d => d.stage !== 'Lost').reduce((s, d) => s + d.value, 0);
  const wonDeals         = pipeline.filter(d => d.stage === 'Won').length;
  const activeClients    = quarterly.reduce((m, q) => Math.max(m, q.clients), 0);
  const weightedForecast = pipeline.filter(d => d.stage !== 'Won' && d.stage !== 'Lost')
                             .reduce((s, d) => s + (d.value * (d.probability / 100)), 0);
  const totalRevenue     = revenueSplit.reduce((s, a) => s + a.value, 0);
  const maxClient        = Math.max(...revenueSplit.map(a => a.value), 1);

  if (loadQ || loadRS || loadP || loadL) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  return (
    <>
      {/* KPI row */}
      <div className="ig-kpis">
        <Stat label="Latest Quarter Revenue"  value={kesC(latestActual)}      sub={`${revenueAchieved}% of target`}         tone={revenueAchieved>=100?'pos':revenueAchieved>=75?'warn':'neg'} delay={0}   />
        <Stat label="Pipeline Value"           value={kesC(totalPipeline)}     sub={`${pipeline.filter(d=>d.stage!=='Lost'&&d.stage!=='Won').length} active deals`} tone="brand" delay={60}  />
        <Stat label="Weighted Forecast"        value={kesC(weightedForecast)}  sub="probability-adjusted"                    tone="brand"   delay={120} />
        <Stat label="Deals Won"                value={wonDeals}                sub="closed contracts"                        tone="pos"     delay={180} />
        <Stat label="Active Client Contracts"  value={activeClients}           sub="current quarter"                         tone="neutral" delay={240} />
        <Stat label="Combined Agency Revenue"  value={kesC(totalRevenue)}      sub="all clients this period"                 tone="brand"   delay={300} />
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:20 }}>
        <Card title="Revenue vs. Target"
          action={isManager && <button onClick={() => setAddingQ(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600 }}><Plus size={13}/> Add quarter</button>}>
          {isManager && addingQ && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, paddingBottom:14, borderBottom:'1px solid '+C.line, marginBottom:16 }}>
              <input className="ig-finput" placeholder="Period (e.g. Q1 2026) *" value={qForm.period}  onChange={setQF('period')}  style={{ flex:'1 1 130px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addQuarter()} />
              <input className="ig-finput" placeholder="Actual (KES)"            value={qForm.actual}  onChange={setQF('actual')}  style={{ width:120 }} type="number" />
              <input className="ig-finput" placeholder="Target (KES)"            value={qForm.target}  onChange={setQF('target')}  style={{ width:120 }} type="number" />
              <input className="ig-finput" placeholder="Clients"                 value={qForm.clients} onChange={setQF('clients')} style={{ width:80  }} type="number" />
              <button className="ig-fadd"    onClick={addQuarter}>Add</button>
              <button className="ig-fcancel" onClick={() => setAddingQ(false)}>Cancel</button>
            </div>
          )}
          {quarterly.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={quarterly} margin={{ top:4, right:8, left:-8, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="period" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={fmtY} />
                  <Tooltip {...ttStyle} formatter={(v, n) => [kesC(v), n==='actual'?'Actual':'Target']} />
                  <Bar  dataKey="actual" fill={C.brand}    radius={[6,6,0,0]} maxBarSize={40} />
                  <Line dataKey="target" stroke={C.signal} strokeWidth={2.5} dot={{ r:3, fill:C.signal }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:20, marginTop:10, fontSize:12, color:C.inkSoft }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:12, height:12, borderRadius:2, background:C.brand, display:'inline-block' }}/>Actual</span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:14, height:2, background:C.signal, display:'inline-block' }}/>Target</span>
              </div>
            </>
          ) : (
            <div style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'48px 0' }}>No quarterly data yet — click "Add quarter" to begin.</div>
          )}
        </Card>

        <Card title="Client Growth Over Time">
          {quarterly.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={quarterly} margin={{ top:4, right:8, left:-8, bottom:0 }}>
                  <defs>
                    <linearGradient id="clGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.pos} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.pos} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="period" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxis} axisLine={false} tickLine={false} />
                  <Tooltip {...ttStyle} formatter={(v) => [v, 'Clients']} />
                  <Area type="monotone" dataKey="clients" stroke={C.pos} strokeWidth={2.5} fill="url(#clGrad)" dot={{ r:4, fill:C.pos, stroke:'none' }} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ marginTop:10, fontSize:12, color:C.inkSoft, display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ width:14, height:2, background:C.pos, display:'inline-block' }}/>Active clients per quarter
              </div>
            </>
          ) : (
            <div style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'48px 0' }}>Add quarters to see client growth trend.</div>
          )}
        </Card>
      </div>

      {/* Sales Pipeline */}
      <Card title="Sales Pipeline" style={{ marginTop:20 }}
        action={isManager && <button onClick={() => setAddingDeal(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600 }}><Plus size={13}/> Add deal</button>}>

        {isManager && addingDeal && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, paddingBottom:14, borderBottom:'1px solid '+C.line, marginBottom:16 }}>
            <input  className="ig-finput" placeholder="Client / Prospect *" value={dealForm.client}      onChange={setDF('client')}      style={{ flex:'1 1 160px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addDeal()} />
            <input  className="ig-finput" placeholder="Deal value (KES)"    value={dealForm.value}       onChange={setDF('value')}       style={{ width:140 }} type="number" />
            <input  className="ig-finput" placeholder="Owner / Lead"        value={dealForm.owner}       onChange={setDF('owner')}       style={{ width:120 }} />
            <input  className="ig-finput" placeholder="Probability (%)"     value={dealForm.probability} onChange={setDF('probability')} style={{ width:110 }} type="number" min="0" max="100" />
            <select className="ig-fselect" value={dealForm.stage} onChange={setDF('stage')}>
              {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="ig-fadd"    onClick={addDeal}>Add</button>
            <button className="ig-fcancel" onClick={() => setAddingDeal(false)}>Cancel</button>
          </div>
        )}

        {/* Stage summary */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:18 }}>
          {PIPELINE_STAGES.map(s => {
            const cnt = pipeline.filter(d => d.stage === s).length;
            const val = pipeline.filter(d => d.stage === s).reduce((a, d) => a + d.value, 0);
            return (
              <div key={s} style={{ padding:'10px 16px', borderRadius:10, background:C.card, border:'1px solid '+C.line, minWidth:110 }}>
                <div style={{ fontSize:10.5, color:C.inkFaint, textTransform:'uppercase', letterSpacing:'.07em', fontWeight:700 }}>{s}</div>
                <div style={{ fontSize:18, fontWeight:700, color:C.ink, marginTop:2 }}>{cnt}</div>
                <div style={{ fontSize:11.5, color:C.inkSoft, marginTop:1 }}>{kesC(val)}</div>
              </div>
            );
          })}
        </div>

        {/* Deal rows */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          {pipeline.map((deal) => (
            <div key={deal.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 6px', borderBottom:'1px solid '+C.line }}>
              <div style={{ flex:'0 0 170px', fontSize:13.5, fontWeight:600, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deal.client}</div>
              <div className="mono" style={{ flex:'0 0 110px', fontSize:13, color:C.brand, fontWeight:600 }}>{kesC(deal.value)}</div>
              <div style={{ flex:'0 0 110px' }}><Pill tone={STAGE_TONE[deal.stage]||'neutral'}>{deal.stage}</Pill></div>
              <div style={{ flex:'0 0 90px', fontSize:12.5, color:C.inkSoft }}>{deal.owner || '—'}</div>
              <div style={{ flex:'0 0 90px' }}>
                <div style={{ background:C.line, borderRadius:4, height:6, overflow:'hidden' }}>
                  <div style={{ width:deal.probability+'%', height:'100%', background:deal.probability>=75?C.pos:deal.probability>=40?C.signal:C.inkFaint, borderRadius:4, transition:'width .3s' }} />
                </div>
                <div style={{ fontSize:11, color:C.inkFaint, marginTop:2 }}>{deal.probability}%</div>
              </div>
              <div style={{ flex:1 }} />
              {isManager && <>
                <select value={deal.stage} onChange={(e) => moveDeal(deal.id, e.target.value)} className="ig-fselect" style={{ fontSize:11.5, padding:'4px 8px', height:28, width:120 }}>
                  {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="ig-delrow" onClick={() => delDeal(deal.id)} title="Remove">✕</button>
              </>}
            </div>
          ))}
          {pipeline.length === 0 && (
            <div style={{ textAlign:'center', color:C.inkFaint, padding:'32px 0', fontSize:13 }}>No deals in pipeline yet.</div>
          )}
        </div>
      </Card>

      {/* Agency Revenue Breakdown */}
      <Card title="Revenue by Client / Project" style={{ marginTop:20 }}
        action={isManager && <button onClick={() => setAddingClient(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600 }}><Plus size={13}/> Add client</button>}>
        {isManager && addingClient && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, paddingBottom:14, borderBottom:'1px solid '+C.line, marginBottom:16 }}>
            <input className="ig-finput" placeholder="Client / Project name *" value={clientForm.name}  onChange={setCF('name')}  style={{ flex:'1 1 160px' }} autoFocus onKeyDown={(e) => e.key==='Enter' && addClient()} />
            <input className="ig-finput" placeholder="Revenue (KES)"           value={clientForm.value} onChange={setCF('value')} style={{ width:140 }} type="number" />
            <button className="ig-fadd"    onClick={addClient}>Add</button>
            <button className="ig-fcancel" onClick={() => setAddingClient(false)}>Cancel</button>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {revenueSplit.map((cl, i) => {
            const pct  = Math.round((cl.value / totalRevenue) * 100) || 0;
            const barW = Math.round((cl.value / maxClient) * 100);
            return (
              <div key={cl.id} style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:155, fontSize:13, color:C.ink, fontWeight:500, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cl.name}</div>
                <div style={{ flex:1, background:C.line, borderRadius:6, height:8, overflow:'hidden' }}>
                  <div style={{ width:barW+'%', height:'100%', background:PIE[i % PIE.length], borderRadius:6, transition:'width .4s' }} />
                </div>
                <div className="mono" style={{ width:80, textAlign:'right', fontSize:12.5, color:C.brand, fontWeight:600, flexShrink:0 }}>{kesC(cl.value)}</div>
                <div style={{ width:34, textAlign:'right', fontSize:12, color:C.inkFaint, flexShrink:0 }}>{pct}%</div>
                {isManager && <button className="ig-delrow" onClick={() => delClient(cl.id)} title="Remove" style={{ flexShrink:0 }}>✕</button>}
              </div>
            );
          })}
          {revenueSplit.length === 0 && (
            <div style={{ textAlign:'center', color:C.inkFaint, padding:'24px 0', fontSize:13 }}>No clients added yet.</div>
          )}
        </div>
      </Card>

      {/* Growth Levers */}
      <div style={{ marginTop:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 className="display" style={{ fontSize:13, fontWeight:700, color:C.inkSoft, letterSpacing:'.06em', textTransform:'uppercase' }}>Growth Levers</h3>
          {isManager && <button onClick={() => { setLeverForm({ k:'', v:'', note:'' }); setAddingLever(v => !v); }} className="ig-kbtn" style={{ width:'auto', padding:'0 12px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600 }}><Plus size={13}/> Add lever</button>}
        </div>
        {isManager && addingLever && (
          <div className="ig-card" style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            <input className="ig-finput" placeholder="Label *" value={leverForm.k}    onChange={setLF('k')}    style={{ fontSize:12.5 }} autoFocus />
            <input className="ig-finput" placeholder="Value"   value={leverForm.v}    onChange={setLF('v')}    style={{ fontSize:12.5 }} onKeyDown={(e) => e.key==='Enter' && addLeverRow()} />
            <input className="ig-finput" placeholder="Note"    value={leverForm.note} onChange={setLF('note')} style={{ fontSize:12.5 }} />
            <div style={{ display:'flex', gap:6 }}>
              <button className="ig-fadd"    onClick={addLeverRow}               style={{ padding:'5px 14px', fontSize:12 }}>Add</button>
              <button className="ig-fcancel" onClick={() => setAddingLever(false)} style={{ padding:'5px 10px', fontSize:12 }}>Cancel</button>
            </div>
          </div>
        )}
        <div className="ig-kpis">
          {levers.map((l, i) => isManager && editingLeverId === l.id ? (
            <div key={l.id} className="ig-card" style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:8 }}>
              <input className="ig-finput" placeholder="Label" value={leverForm.k}    onChange={setLF('k')}    style={{ fontSize:12.5 }} autoFocus />
              <input className="ig-finput" placeholder="Value" value={leverForm.v}    onChange={setLF('v')}    style={{ fontSize:12.5 }} onKeyDown={(e) => e.key==='Enter' && saveLever()} />
              <input className="ig-finput" placeholder="Note"  value={leverForm.note} onChange={setLF('note')} style={{ fontSize:12.5 }} />
              <div style={{ display:'flex', gap:6 }}>
                <button className="ig-fadd"    onClick={saveLever}                      style={{ padding:'5px 14px', fontSize:12 }}>Save</button>
                <button className="ig-fcancel" onClick={() => setEditingLeverId(null)}  style={{ padding:'5px 10px', fontSize:12 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={l.id} className="ig-card ig-taskrow rise" style={{ padding:'16px 18px', animationDelay:i*60+'ms', position:'relative' }}>
              <div style={{ fontSize:12.5, color:C.inkSoft, fontWeight:500 }}>{l.k}</div>
              <div className="mono display" style={{ fontSize:22, fontWeight:600, color:C.brand, marginTop:6 }}>{l.v}</div>
              <div style={{ fontSize:11.5, color:C.inkFaint, marginTop:4 }}>{l.note}</div>
              {isManager && (
                <div style={{ position:'absolute', top:10, right:10, display:'flex', gap:4 }}>
                  <button className="ig-delrow" onClick={() => startEditLever(l)} title="Edit"><Pencil size={13}/></button>
                  <button className="ig-delrow" onClick={() => delLever(l.id)} title="Delete" style={{ color:C.alert }}><Trash2 size={13}/></button>
                </div>
              )}
            </div>
          ))}
          {levers.length === 0 && !addingLever && (
            <div style={{ color:C.inkFaint, fontSize:13, padding:'24px 0' }}>No growth levers tracked yet.</div>
          )}
        </div>
      </div>
    </>
  );
}

const EMPTY_IDEA = { t:'', problem:'', hypothesis:'', metric:'', next_step:'', owner:'', impact:'Medium' };
const INNOVATION_STAGES = ['Idea','Exploring','Piloting','Scaling','Parked'];

function InnovationView({ agencyUUID, isManager }) {
  const { rows: ideas, loading, dbInsert, dbDelete } = useSimpleTable('innovation_ideas', agencyUUID);
  const [addingStage, setAddingStage] = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [ideaForm,    setIdeaForm]    = useState(EMPTY_IDEA);

  const setF = (k) => (e) => setIdeaForm(p => ({ ...p, [k]:e.target.value }));

  const toggleAdd = (stage) => { setIdeaForm(EMPTY_IDEA); setAddingStage(v => v === stage ? null : stage); };
  const addIdea   = async (stage) => {
    if (!ideaForm.t.trim() || !ideaForm.problem.trim()) return;
    await dbInsert({ stage, title:ideaForm.t, problem:ideaForm.problem, hypothesis:ideaForm.hypothesis, metric:ideaForm.metric, next_step:ideaForm.next_step, owner:ideaForm.owner, impact:ideaForm.impact });
    setIdeaForm(EMPTY_IDEA);
    setAddingStage(null);
  };
  const toggleExpand = (key) => setExpanded(v => v === key ? null : key);

  const stageTone = { Idea:C.inkFaint, Exploring:C.signal, Piloting:C.pos, Scaling:C.brand, Parked:C.inkSoft };

  if (loading) return <div style={{ color:C.inkSoft, fontSize:14, padding:'40px 0' }}>Loading…</div>;

  const Field = ({ label, value }) => value ? (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:C.inkFaint, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:12.5, color:C.inkSoft, lineHeight:1.5 }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(200px,1fr))', gap:14, overflowX:'auto', paddingBottom:4 }}>
      {INNOVATION_STAGES.map((s, si) => {
        const stageIdeas = ideas.filter(idea => idea.stage === s);
        return (
          <div key={s} className="rise" style={{ animationDelay:si*60+'ms' }}>
            {/* column header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ width:8, height:8, borderRadius:99, background:stageTone[s] || C.inkSoft, flexShrink:0 }} />
              <span className="display" style={{ fontWeight:700, fontSize:13.5, color:C.ink }}>{s}</span>
              <span className="mono" style={{ fontSize:11, color:C.inkFaint, marginLeft:'auto' }}>{stageIdeas.length}</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {stageIdeas.map((idea) => {
                const key  = idea.id;
                const open = expanded === key;
                const tone = stageTone[s] || C.inkSoft;
                return (
                  <div key={idea.id} className="ig-card ig-taskrow" style={{ padding:0, borderTop:'3px solid '+tone, overflow:'hidden' }}>
                    <div
                      onClick={() => toggleExpand(key)}
                      style={{ padding:'12px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}
                    >
                      <div style={{ fontWeight:600, color:C.ink, fontSize:13, lineHeight:1.35, flex:1 }}>{idea.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        <Pill tone={idea.impact==='High'?'pos':idea.impact==='Medium'?'warn':'neutral'}>{idea.impact}</Pill>
                        <span style={{ fontSize:13, color:C.inkFaint, lineHeight:1 }}>{open ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {open && (
                      <div style={{ padding:'0 14px 14px', borderTop:'1px solid '+C.line }}>
                        <Field label="Problem being solved" value={idea.problem} />
                        <Field label="Hypothesis"           value={idea.hypothesis} />
                        <Field label="Success metric"       value={idea.metric} />
                        <Field label="Next step"            value={idea.next_step} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                          <span style={{ fontSize:12, color:C.inkFaint, fontWeight:600 }}>{idea.owner || '—'}</span>
                          {isManager && <button className="ig-delrow" onClick={() => dbDelete(idea.id)} title="Remove" style={{ fontSize:11, opacity:1, color:C.alert }}>✕ Remove</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* add form */}
              {isManager && addingStage === s ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8, padding:12, background:C.paper, borderRadius:11, border:'1px dashed '+C.line }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.inkFaint, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>New idea</div>
                  <input className="ig-finput" placeholder="Title *" value={ideaForm.t} onChange={setF('t')} style={{ fontSize:12.5 }} autoFocus />
                  <textarea className="ig-finput" placeholder="What problem does this solve? *" value={ideaForm.problem} onChange={setF('problem')} rows={2} style={{ fontSize:12.5, resize:'vertical', fontFamily:'inherit' }} />
                  <textarea className="ig-finput" placeholder="Hypothesis — We believe that…" value={ideaForm.hypothesis} onChange={setF('hypothesis')} rows={2} style={{ fontSize:12.5, resize:'vertical', fontFamily:'inherit' }} />
                  <input className="ig-finput" placeholder="Success metric — How will we know it worked?" value={ideaForm.metric} onChange={setF('metric')} style={{ fontSize:12.5 }} />
                  <input className="ig-finput" placeholder="Immediate next step" value={ideaForm.next_step} onChange={setF('next_step')} style={{ fontSize:12.5 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <input className="ig-finput" placeholder="Owner" value={ideaForm.owner} onChange={setF('owner')} style={{ fontSize:12.5, flex:1 }} />
                    <select className="ig-fselect" value={ideaForm.impact} onChange={setF('impact')} style={{ fontSize:12.5 }}>
                      {['High','Medium','Low'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  {(!ideaForm.t.trim() || !ideaForm.problem.trim()) && (
                    <div style={{ fontSize:11.5, color:C.signal }}>Title and problem statement are required.</div>
                  )}
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="ig-fadd" onClick={() => addIdea(s)} style={{ flex:1, padding:'6px 0', fontSize:12 }}>Add idea</button>
                    <button className="ig-fcancel" onClick={() => setAddingStage(null)} style={{ padding:'6px 10px', fontSize:12 }}>✕</button>
                  </div>
                </div>
              ) : (
                isManager && <button className="ig-addidea" onClick={() => toggleAdd(s)}><Plus size={14} /> New idea</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Task default data ── */
const DEFAULT_WEEKLY_TASKS = [
  { id:'w1', task:'Q3 financial review',           assignee:'Team lead', day:'Mon', priority:'High',   status:'Done'        },
  { id:'w2', task:'Client onboarding call',         assignee:'Team lead', day:'Tue', priority:'High',   status:'In Progress' },
  { id:'w3', task:'Project status update',          assignee:'All',       day:'Tue', priority:'Medium', status:'Done'        },
  { id:'w4', task:'Budget forecast update',         assignee:'Finance',   day:'Wed', priority:'High',   status:'Not Started' },
  { id:'w5', task:'Team performance review',        assignee:'Team lead', day:'Wed', priority:'Medium', status:'Not Started' },
  { id:'w6', task:'Stakeholder report submission',  assignee:'Comms',     day:'Thu', priority:'High',   status:'Not Started' },
  { id:'w7', task:'Innovation pipeline review',     assignee:'All',       day:'Thu', priority:'Low',    status:'Not Started' },
  { id:'w8', task:'Week retrospective',             assignee:'All',       day:'Fri', priority:'Medium', status:'Not Started' },
  { id:'w9', task:'Next week planning session',     assignee:'Team lead', day:'Fri', priority:'High',   status:'Not Started' },
];

const DEFAULT_DAILY_TASKS = [
  { id:'d1', task:'Team stand-up',                   outcome:'Alignment on priorities for the day',    time:'09:00', priority:'Medium', done:true  },
  { id:'d2', task:'Review morning emails',           outcome:'Urgent items flagged and replied to',    time:'09:30', priority:'Low',    done:true  },
  { id:'d3', task:'Client call — Rift Valley Sacco', outcome:'',                                       time:'10:00', priority:'High',   done:false },
  { id:'d4', task:'Update project tracker',          outcome:'',                                       time:'11:30', priority:'Medium', done:false },
  { id:'d5', task:'Lunch & stakeholder networking',  outcome:'',                                       time:'13:00', priority:'Low',    done:false },
  { id:'d6', task:'Code/work review session',        outcome:'',                                       time:'14:00', priority:'High',   done:false },
  { id:'d7', task:'Respond to stakeholder emails',   outcome:'',                                       time:'15:30', priority:'Medium', done:false },
  { id:'d8', task:'EOD status report',               outcome:'',                                       time:'17:00', priority:'High',   done:false },
];

function WeeklyTasksView({ agencyUUID, members = [], isManager }) {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ task:'', assignee:'', priority:'Medium' });

  const supabase = createClient();

  useEffect(() => {
    if (!agencyUUID) { setLoading(false); return; }
    setLoading(true);
    supabase.from('weekly_tasks')
      .select('*')
      .eq('agency_id', agencyUUID)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('weekly_tasks fetch:', error);
        setTasks(data || []);
        setLoading(false);
      });
  }, [agencyUUID]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (id, current) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, done: !current } : t));
    await supabase.from('weekly_tasks').update({ done: !current }).eq('id', id);
  };

  const remove = async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    await supabase.from('weekly_tasks').delete().eq('id', id);
  };

  const addTask = async () => {
    if (!form.task.trim() || !agencyUUID) return;
    setSaving(true);
    const { data, error } = await supabase.from('weekly_tasks')
      .insert({ agency_id: agencyUUID, task: form.task.trim(), assignee: form.assignee, priority: form.priority, done: false })
      .select().single();
    if (!error && data) setTasks(p => [...p, data]);
    setForm({ task:'', assignee:'', priority:'Medium' });
    setAdding(false);
    setSaving(false);
  };

  const doneCount = tasks.filter(t => t.done).length;
  const pct       = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const pending   = tasks.filter(t => !t.done);
  const completed = tasks.filter(t =>  t.done);

  const WeeklyRow = ({ t }) => (
    <div className="ig-taskrow" style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 10px', borderBottom:'1px solid '+C.line, opacity: t.done ? 0.5 : 1, transition:'opacity .2s' }}>
      {isManager && (
        <button onClick={() => toggle(t.id, t.done)} style={{ width:22, height:22, borderRadius:6, border:t.done?'none':'2px solid '+C.inkFaint, background:t.done?C.pos:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginTop:2, transition:'all .15s' }}>
          {t.done && <Check size={13} color="#fff" />}
        </button>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:500, color:t.done?C.inkFaint:C.ink, textDecoration:t.done?'line-through':'none', lineHeight:1.4 }}>{t.task}</div>
        {t.assignee && <div style={{ fontSize:12, color:C.inkSoft, marginTop:3 }}>{t.assignee}</div>}
      </div>
      <Pill tone={PRIO_TONE[t.priority]||'neutral'}>{t.priority}</Pill>
      {isManager && <button className="ig-delrow" onClick={() => remove(t.id)} title="Remove">✕</button>}
    </div>
  );

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0', color:C.inkFaint, fontSize:13, gap:10 }}>
      <span style={{ width:16, height:16, borderRadius:'50%', border:'2px solid '+C.inkFaint, borderTopColor:C.brand, animation:'ig-spin .7s linear infinite', display:'inline-block' }} />
      Loading…
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* progress + add */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
        <div className="ig-track" style={{ flex:1, margin:0 }}>
          <div style={{ width:pct+'%', height:'100%', background:C.pos, borderRadius:99, transition:'width .4s' }} />
        </div>
        <span className="mono" style={{ fontSize:12, color:C.inkSoft, flexShrink:0, minWidth:32, textAlign:'right' }}>{pct}%</span>
        {isManager && (
          <button onClick={() => setAdding(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 14px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600, flexShrink:0 }}>
            <Plus size={14} /> Add task
          </button>
        )}
      </div>

      {isManager && adding && (
        <div className="ig-card" style={{ padding:'16px 20px', marginBottom:18, display:'flex', flexDirection:'column', gap:12 }}>
          {/* Row 1: task description */}
          <input className="ig-finput" placeholder="Task description…" value={form.task}
            onChange={e => setForm(p => ({ ...p, task: e.target.value }))}
            style={{ width:'100%', background: C.inputBg, color: C.ink, borderColor: C.line, fontSize:13.5, padding:'10px 14px' }}
            onKeyDown={e => e.key === 'Enter' && addTask()} autoFocus />

          {/* Row 2: assignee + priority + actions */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            {/* Assignee select */}
            <div style={{ position:'relative', flex:'1 1 180px', minWidth:160 }}>
              <select
                value={form.assignee}
                onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))}
                style={{
                  width:'100%', appearance:'none', WebkitAppearance:'none',
                  background: C.inputBg, color: C.ink,
                  border:'1px solid '+C.line, borderRadius:8,
                  padding:'9px 34px 9px 12px', fontSize:13, fontFamily:'inherit',
                  cursor:'pointer', outline:'none', colorScheme: C.inputBg === '#FFFFFF' ? 'light' : 'dark',
                  transition:'border-color .15s',
                }}>
                <option value="">Assign to…</option>
                {members.map(m => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
              </select>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:C.inkSoft, fontSize:11 }}>▾</span>
            </div>

            {/* Priority select */}
            <div style={{ position:'relative', flex:'0 0 130px' }}>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                style={{
                  width:'100%', appearance:'none', WebkitAppearance:'none',
                  background: C.inputBg, color: C.ink,
                  border:'1px solid '+C.line, borderRadius:8,
                  padding:'9px 34px 9px 12px', fontSize:13, fontFamily:'inherit',
                  cursor:'pointer', outline:'none', colorScheme: C.inputBg === '#FFFFFF' ? 'light' : 'dark',
                  transition:'border-color .15s',
                }}>
                {['High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
              </select>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:C.inkSoft, fontSize:11 }}>▾</span>
            </div>

            <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
              <button className="ig-fadd" onClick={addTask} disabled={saving} style={{ padding:'9px 20px' }}>{saving ? 'Saving…' : 'Add task'}</button>
              <button className="ig-fcancel" onClick={() => setAdding(false)} style={{ padding:'9px 14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="ig-2col">
        <div className="ig-card rise" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid '+C.line }}>
            <h3 className="display" style={{ fontSize:14, fontWeight:700, color:C.ink, margin:0 }}>Pending</h3>
            <span style={{ fontSize:12, color:C.inkFaint, fontWeight:600 }}>{pending.length} left</span>
          </div>
          {pending.length === 0
            ? <p style={{ color:C.inkSoft, fontSize:13, textAlign:'center', padding:'32px 20px' }}>All done this week!</p>
            : <div style={{ padding:'0 10px' }}>{pending.map(t => <WeeklyRow key={t.id} t={t} />)}</div>
          }
        </div>
        <div className="ig-card rise" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid '+C.line }}>
            <h3 className="display" style={{ fontSize:14, fontWeight:700, color:C.ink, margin:0 }}>Completed</h3>
            <span style={{ fontSize:12, color:C.pos, fontWeight:600 }}>{doneCount} done</span>
          </div>
          {completed.length === 0
            ? <p style={{ color:C.inkSoft, fontSize:13, textAlign:'center', padding:'32px 20px' }}>Nothing completed yet.</p>
            : <div style={{ padding:'0 10px' }}>{completed.map(t => <WeeklyRow key={t.id} t={t} />)}</div>
          }
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function firstName(name) {
  if (!name) return 'there';
  return name.split(' ')[0];
}

const PRIO_TONE = { High:'neg', Medium:'warn', Low:'neutral' };

function DailyTaskRow({ t, onToggle, onRemove }) {
  return (
    <div className="ig-taskrow" style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 10px', borderBottom:'1px solid '+C.line, transition:'opacity .2s' }}>
      <button onClick={() => onToggle(t.id)} style={{ width:22, height:22, borderRadius:6, border:t.done?'none':'2px solid '+C.inkFaint, background:t.done?C.pos:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginTop:2, transition:'all .15s' }}>
        {t.done && <Check size={13} color="#fff" />}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:500, color:t.done?C.inkFaint:C.ink, textDecoration:t.done?'line-through':'none', lineHeight:1.4 }}>{t.task}</div>
        {t.done && t.outcome && (
          <div style={{ fontSize:12.5, color:C.pos, marginTop:4, lineHeight:1.4, fontStyle:'italic' }}>↳ {t.outcome}</div>
        )}
        {!t.done && t.outcome && (
          <div style={{ fontSize:12, color:C.inkFaint, marginTop:3, lineHeight:1.4 }}>Expected: {t.outcome}</div>
        )}
      </div>
      <Pill tone={PRIO_TONE[t.priority]||'neutral'}>{t.priority}</Pill>
      <button className="ig-delrow" onClick={() => onRemove(t.id)} title="Remove">✕</button>
    </div>
  );
}

function DailyTasksView({ tasks, loading, onAdd, onToggle, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [form,   setForm]   = useState({ task:'', outcome:'', priority:'Medium' });

  const set     = (k) => (e) => setForm((p) => ({ ...p, [k]:e.target.value }));
  const addTask = () => {
    if (!form.task.trim()) return;
    onAdd({ ...form });
    setForm({ task:'', outcome:'', priority:'Medium' });
    setAdding(false);
  };

  const done      = tasks.filter((t) => t.done).length;
  const pct       = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const pending   = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) =>  t.done);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0', color:C.inkFaint, fontSize:13, gap:10 }}>
      <span style={{ width:16, height:16, borderRadius:'50%', border:'2px solid '+C.inkFaint, borderTopColor:C.brand, animation:'ig-spin .7s linear infinite', display:'inline-block' }} />
      Loading tasks…
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* progress + add */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
        <div className="ig-track" style={{ flex:1, margin:0 }}>
          <div style={{ width:pct+'%', height:'100%', background:C.pos, borderRadius:99, transition:'width .4s' }} />
        </div>
        <span className="mono" style={{ fontSize:12, color:C.inkSoft, flexShrink:0, minWidth:32, textAlign:'right' }}>{pct}%</span>
        <button onClick={() => setAdding(v => !v)} className="ig-kbtn" style={{ width:'auto', padding:'0 14px', gap:6, background:C.brand, color:'#fff', border:'none', fontFamily:'inherit', fontSize:12.5, fontWeight:600, flexShrink:0 }}>
          <Plus size={14} /> Add task
        </button>
      </div>

      {adding && (
        <div className="ig-card" style={{ padding:16, marginBottom:18, display:'flex', flexWrap:'wrap', gap:8 }}>
          <input  className="ig-finput"  placeholder="Task…" value={form.task} onChange={set('task')} style={{ flex:'1 1 180px', minWidth:0 }} autoFocus />
          <input  className="ig-finput"  placeholder="Expected outcome…" value={form.outcome} onChange={set('outcome')} style={{ flex:'1 1 180px', minWidth:0 }} onKeyDown={(e) => e.key==='Enter' && addTask()} />
          <select className="ig-fselect" value={form.priority} onChange={set('priority')}>
            {['High','Medium','Low'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="ig-fadd"    onClick={addTask}>Add</button>
          <button className="ig-fcancel" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}

      {tasks.length === 0 && !adding && (
        <div style={{ textAlign:'center', color:C.inkFaint, padding:'48px 0', fontSize:13.5 }}>No tasks yet — add one above.</div>
      )}

      {/* two-column layout */}
      {tasks.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="ig-2col">
          <div className="ig-card rise" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid '+C.line }}>
              <h3 className="display" style={{ fontSize:14, fontWeight:700, color:C.ink, margin:0 }}>Pending</h3>
              <span style={{ fontSize:12, color:C.inkFaint, fontWeight:600 }}>{pending.length} left</span>
            </div>
            {pending.length === 0
              ? <p style={{ color:C.inkSoft, fontSize:13, textAlign:'center', padding:'32px 20px' }}>All done for today!</p>
              : <div style={{ padding:'0 10px' }}>{pending.map(t => <DailyTaskRow key={t.id} t={t} onToggle={onToggle} onRemove={onRemove} />)}</div>
            }
          </div>
          <div className="ig-card rise" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid '+C.line }}>
              <h3 className="display" style={{ fontSize:14, fontWeight:700, color:C.ink, margin:0 }}>Completed</h3>
              <span style={{ fontSize:12, color:C.pos, fontWeight:600 }}>{done} done</span>
            </div>
            {completed.length === 0
              ? <p style={{ color:C.inkSoft, fontSize:13, textAlign:'center', padding:'32px 20px' }}>Nothing completed yet.</p>
              : <div style={{ padding:'0 10px' }}>{completed.map(t => <DailyTaskRow key={t.id} t={t} onToggle={onToggle} onRemove={onRemove} />)}</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Members management view (agency_head / admin only) ── */
function MembersView({ agencyId, isAdmin }) {
  const supabase = createClient();
  const [members,      setMembers]      = useState([]);
  const [agencies,     setAgencies]     = useState([]);
  const [filterAgency, setFilterAgency] = useState('all');
  const [loading,      setLoading]      = useState(true);

  const load = async () => {
    setLoading(true);

    if (isAdmin) {
      const [{ data: profs }, { data: agList }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, role, approved, created_at, agency_id')
          .order('created_at', { ascending: true }),
        supabase
          .from('agencies')
          .select('id, name, slug')
          .order('name'),
      ]);
      setMembers(profs || []);
      setAgencies(agList || []);
      setLoading(false);
      return;
    }

    // Agency head sees only their agency's members
    const { data: agency } = await supabase
      .from('agencies').select('id').eq('slug', agencyId).single();
    if (!agency) { setLoading(false); return; }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, approved, created_at, agency_id')
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: true });
    setMembers(profs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve    = async (id) => {
    await supabase.from('profiles').update({ approved: true }).eq('id', id);
    setMembers(p => p.map(m => m.id === id ? { ...m, approved: true } : m));
  };
  const revoke     = async (id) => {
    await supabase.from('profiles').update({ approved: false }).eq('id', id);
    setMembers(p => p.map(m => m.id === id ? { ...m, approved: false } : m));
  };
  const changeRole = async (id, newRole) => {
    if (newRole === 'agency_head') {
      // Find the target member's agency so we can demote the current head
      const target = members.find(m => m.id === id);
      if (target?.agency_id) {
        const currentHead = members.find(
          m => m.agency_id === target.agency_id && m.role === 'agency_head' && m.id !== id
        );
        if (currentHead) {
          await supabase.from('profiles').update({ role: 'member' }).eq('id', currentHead.id);
        }
      }
      await supabase.from('profiles').update({ role: 'agency_head' }).eq('id', id);
      setMembers(p => p.map(m => {
        if (m.id === id) return { ...m, role: 'agency_head' };
        if (target?.agency_id && m.agency_id === target.agency_id && m.role === 'agency_head') return { ...m, role: 'member' };
        return m;
      }));
    } else {
      await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      setMembers(p => p.map(m => m.id === id ? { ...m, role: newRole } : m));
    }
  };

  const agencyName = (id) => agencies.find(a => a.id === id)?.name || '—';

  const displayed = isAdmin && filterAgency !== 'all'
    ? members.filter(m => m.agency_id === filterAgency)
    : members;

  const pending = displayed.filter(m => !m.approved);
  const active  = displayed.filter(m => m.approved);

  const roleColor = (role) =>
    role === 'agency_head' ? C.signal : role === 'admin' ? C.alert : C.brand;
  const roleLabel = (role) =>
    role === 'agency_head' ? 'Agency Head' : role === 'admin' ? 'Admin' : 'Member';

  const Row = ({ m }) => (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid '+C.line }}>
      <div style={{
        width:38, height:38, borderRadius:10, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:15, fontWeight:700,
        background: m.approved ? 'rgba(22,163,107,.10)' : 'rgba(245,166,35,.10)',
        color: m.approved ? C.pos : C.signal,
      }}>
        {(m.full_name || m.email || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {m.full_name || '—'}
        </div>
        <div style={{ fontSize:12, color:C.inkSoft, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {m.email}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', color: roleColor(m.role) }}>
            {roleLabel(m.role)}
          </span>
          {isAdmin && m.agency_id && (
            <span style={{ fontSize:11, color:C.inkFaint }}>· {agencyName(m.agency_id)}</span>
          )}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {!m.approved && (
          <button onClick={() => approve(m.id)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:8, border:'none', background:'rgba(22,163,107,.12)', color:C.pos, fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <UserCheck size={13} /> Approve
          </button>
        )}
        {isAdmin && m.approved && m.role === 'member' && (
          <button onClick={() => changeRole(m.id, 'agency_head')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:8, border:'none', background:'rgba(245,166,35,.10)', color:C.signal, fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <ShieldCheck size={13} /> Make head
          </button>
        )}
        {isAdmin && m.approved && m.role === 'agency_head' && (
          <button onClick={() => changeRole(m.id, 'member')}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:8, border:'none', background:'rgba(48,108,236,.08)', color:C.brand, fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <UserX size={13} /> Make member
          </button>
        )}
        {m.approved && (
          <button onClick={() => revoke(m.id)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:8, border:'none', background:'rgba(224,72,90,.08)', color:C.alert, fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <ShieldOff size={13} /> Revoke
          </button>
        )}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign:'center', padding:'60px 0', color:C.inkFaint }}>Loading members…</div>
  );

  return (
    <>
      {/* KPIs */}
      <div className="ig-kpis">
        {[
          { label:'Total signed up',  value:displayed.length,  color:C.ink    },
          { label:'Active',           value:active.length,     color:C.pos    },
          { label:'Pending approval', value:pending.length,    color:C.signal },
          { label:'Agency heads',     value:displayed.filter(m=>m.role==='agency_head').length, color:C.signal },
        ].map((k, i) => (
          <div key={k.label} className="ig-card rise" style={{ padding:'16px 18px', animationDelay:i*60+'ms' }}>
            <div style={{ fontSize:11.5, textTransform:'uppercase', letterSpacing:'.06em', color:C.inkFaint, fontWeight:600 }}>{k.label}</div>
            <div className="mono" style={{ fontSize:26, fontWeight:700, color:k.color, marginTop:6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Agency filter (admin only) */}
      {isAdmin && agencies.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:20 }}>
          {[{ id:'all', name:'All agencies' }, ...agencies].map(a => (
            <button
              key={a.id}
              onClick={() => setFilterAgency(a.id)}
              style={{
                padding:'6px 14px', borderRadius:20, fontSize:12.5, fontWeight:600,
                fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
                border: filterAgency === a.id ? 'none' : '1px solid '+C.line,
                background: filterAgency === a.id ? C.brand : C.card,
                color: filterAgency === a.id ? '#fff' : C.inkSoft,
              }}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Members table */}
      <Card title={filterAgency === 'all' ? 'All members' : (agencies.find(a=>a.id===filterAgency)?.name || 'Members')} style={{ marginTop:16 }}>
        {displayed.length === 0
          ? <p style={{ color:C.inkFaint, fontSize:13, textAlign:'center', padding:'32px 0' }}>No members in this agency yet.</p>
          : displayed.map(m => <Row key={m.id} m={m} />)
        }
      </Card>
    </>
  );
}

/* ── Admin: all-agencies overview ── */
const ALL_AGENCIES = [
  { slug:'itek',      name:'iTek',                 logo:'/ITEK.png',               logoScale:1.8 },
  { slug:'i3x',       name:'i3x Africa',            logo:'/I3xAfrica.png'           },
  { slug:'i3studios', name:'i3 Studios',             logo:'/I3Studios.png',          logoScale:1.8 },
  { slug:'assets',    name:'Productions & Assets',  logo:'/logo3.png'               },
  { slug:'i3kingdom', name:'i3 Kingdom Hub',        logo:'/i3KingdomHubTeam.png'    },
  { slug:'i3plus',    name:'i3+',                   logo:'/5 (2).png',              logoScale:1.8 },
];

function AllAgenciesView({ currentAgencyId, onSwitch }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18 }}>
      {ALL_AGENCIES.map((ag, i) => {
        const isCurrent = ag.slug === currentAgencyId?.toLowerCase();
        return (
          <div
            key={ag.slug}
            className="ig-card rise"
            style={{
              padding:24, animationDelay:i*60+'ms',
              border: isCurrent ? `2px solid ${C.brand}` : `1px solid ${C.line}`,
              position:'relative', overflow:'hidden',
            }}
          >
            {isCurrent && (
              <div style={{
                position:'absolute', top:12, right:12,
                fontSize:10.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase',
                background: C.brand, color:'#fff', borderRadius:6, padding:'3px 8px',
              }}>Current</div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
              <div style={{
                width:56, height:56, borderRadius:12, overflow:'hidden', flexShrink:0,
                background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <img src={ag.logo} alt={ag.name}
                  loading="lazy" style={{ width:'100%', height:'100%', objectFit:'contain', transform: ag.logoScale ? `scale(${ag.logoScale})` : 'none', transformOrigin:'center' }}
                  onError={e => { e.target.style.display='none'; }}
                />
              </div>
              <div>
                <div className="display" style={{ fontWeight:800, fontSize:17, color:C.ink, lineHeight:1.1 }}>{ag.name}</div>
                <div style={{ fontSize:12, color:C.inkFaint, marginTop:3, fontFamily:"'JetBrains Mono',monospace" }}>impact360.africa/{ag.slug}</div>
              </div>
            </div>
            <button
              onClick={() => onSwitch(ag.slug)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                width:'100%', padding:'10px 0', borderRadius:10, border:'none',
                background: isCurrent ? 'rgba(48,108,236,.10)' : C.brand,
                color: isCurrent ? C.brand : '#fff',
                fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer',
                transition:'opacity .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity='.85'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}
            >
              <ExternalLink size={14} />
              {isCurrent ? 'You are here' : 'Open dashboard'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TasksView({ weeklyTasks, userName, agencyId, agencyUUID, isManager, userId }) {
  const [tab,         setTab]         = useState('daily');
  const [tasks,       setTasks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [members,     setMembers]     = useState([]);
  const [viewingId,   setViewingId]   = useState(userId);
  const [viewingName, setViewingName] = useState(userName);

  const supabase = createClient();

  // Sync viewingId when userId resolves (profile loads after first render)
  useEffect(() => {
    if (userId && !viewingId) {
      setViewingId(userId);
      setViewingName(userName);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load agency members list
  useEffect(() => {
    if (!agencyUUID) return;
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('agency_id', agencyUUID)
      .then(({ data, error }) => {
        if (error) { console.error('TasksView members fetch error:', error); return; }
        if (data) setMembers(data);
      });
  }, [agencyUUID]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks whenever the viewed user changes
  useEffect(() => {
    if (!viewingId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', viewingId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setTasks(data || []);
        setLoading(false);
      });
  }, [viewingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAdd = async (form) => {
    const tempId  = 'tmp_' + Date.now();
    const tempRow = { ...form, id: tempId, user_id: viewingId, agency_id: agencyId, done: false, created_at: new Date().toISOString() };
    setTasks(p => [tempRow, ...p]);   // show immediately

    if (!viewingId) return;
    // Exclude 'done' from the payload — let the DB DEFAULT false handle it
    // This avoids PostgREST schema cache issues when the column was just added
    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({
        task:     form.task,
        outcome:  form.outcome  || '',
        priority: form.priority || 'Medium',
        user_id:  viewingId,
      })
      .select('id, task, outcome, priority, user_id, created_at')
      .single();
    if (!error && data) {
      setTasks(p => p.map(t => t.id === tempId ? { ...data, done: false } : t));
    }
  };

  const onToggle = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const isDone = !task.done;
    setTasks(p => p.map(t => t.id === id ? { ...t, done: isDone } : t));
    await supabase.from('daily_tasks').update({ done: isDone }).eq('id', id);
  };

  const onRemove = async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    await supabase.from('daily_tasks').delete().eq('id', id);
  };

  const isViewingOwn   = viewingId === userId;
  const displayName    = isViewingOwn ? userName : viewingName;
  const today          = new Date().toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const dailyDone      = tasks.filter(t => t.done).length;
  const dailyRemaining = tasks.filter(t => !t.done).length;
  const dailyHigh      = tasks.filter(t => !t.done && t.priority === 'High').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Welcome header — only on Today tab */}
      {tab === 'daily' && <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:12, color:C.inkFaint, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:10 }}>{today}</div>
        <h2 className="display" style={{
          fontSize:38, fontWeight:900, letterSpacing:'-.02em', margin:'0 0 12px', lineHeight:1.1,
          background:'linear-gradient(135deg,#FFFFFF 0%,#7EB3FF 60%,#306CEC 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
        }}>
          {isViewingOwn ? `${greeting()}, ${firstName(displayName)}` : `${firstName(displayName)}'s Tasks`}
        </h2>
        <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
          <span style={{ fontSize:14, color:C.inkSoft }}>
            {isViewingOwn ? 'You have' : `${firstName(displayName)} has`}{' '}
            <strong style={{ color:C.ink }}>{dailyRemaining}</strong> task{dailyRemaining !== 1 ? 's' : ''}{' '}
            {isViewingOwn ? 'left today' : 'pending'}
          </span>
          {dailyDone > 0 && <>
            <span style={{ width:4, height:4, borderRadius:'50%', background:C.inkFaint, display:'inline-block' }} />
            <span style={{ fontSize:14, color:C.pos, fontWeight:600 }}>{dailyDone} completed</span>
          </>}
          {dailyHigh > 0 && <>
            <span style={{ width:4, height:4, borderRadius:'50%', background:C.inkFaint, display:'inline-block' }} />
            <span style={{ fontSize:14, color:C.alert, fontWeight:600 }}>{dailyHigh} high priority</span>
          </>}
        </div>
      </div>}

      {/* Toggle row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:6, background:'rgba(48,108,236,0.10)', borderRadius:12, padding:5 }}>
          {[{ id:'daily', label:'Today' }, { id:'weekly', label:'Weekly' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding:'8px 28px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'inherit',
                fontSize:13.5, fontWeight:600, transition:'all .15s',
                background: tab === t.id ? C.brand : 'transparent',
                color:      tab === t.id ? '#fff'  : C.sidebarSoft,
                boxShadow:  tab === t.id ? '0 4px 14px rgba(48,108,236,0.40)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Member picker — agency head / admin only, Today tab only */}
        {isManager && tab === 'daily' && members.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12.5, color:C.inkSoft, fontWeight:500 }}>Viewing:</span>
            <select
              value={viewingId}
              onChange={(e) => {
                const m = members.find(m => m.id === e.target.value);
                setViewingId(e.target.value);
                setViewingName(m?.full_name || '');
              }}
              className="ig-fselect"
              style={{ fontSize:13, height:34 }}
            >
              <option value={userId}>My Tasks</option>
              {members.filter(m => m.id !== userId).map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'daily'
        ? <DailyTasksView tasks={tasks} loading={loading} onAdd={onAdd} onToggle={onToggle} onRemove={onRemove} />
        : <WeeklyTasksView agencyUUID={agencyUUID} members={members} isManager={isManager} />
      }
    </div>
  );
}

/* ── Nav config ── */
const NAV = [
  { id:'tasks', label:'Tasks', icon:ClipboardList },
  { id:'goals',      label:'Goals per project',    icon:Target },
  {
    group:'fin', label:'Financial tracking', icon:Wallet,
    children:[
      { id:'fin-revenue', label:'Revenue vs. goal', icon:Banknote },
      { id:'fin-loss',   label:'Where the loss originated', icon:TrendingDown },
      { id:'fin-exp',    label:'Expenditure',               icon:Receipt },
      { id:'fin-models', label:'Revenue models',            icon:Coins },
      { id:'fin-rates',  label:'Rate cards',                icon:CreditCard },
    ],
  },
  { id:'growth',     label:'Growth models',  icon:TrendingUp },
  { id:'innovation', label:'Innovation box', icon:Lightbulb },
];

const AGENCY_LOGOS = {
  itek:       '/ITEK.png',
  i3x:        '/I3xAfrica.png',
  i3studios:  '/I3Studios.png',
  assets:     '/logo3.png',
  i3kingdom:  '/i3KingdomHubTeam.png',
  i3plus:     '/5 (2).png',
};

const META = {
  tasks:         { title:'Tasks', sub:'' },
  goals:       { title:'Goals per project',          sub:'Track delivery against the target for every active programme.' },
  'fin-revenue':{ crumb:'Financial tracking', title:'Revenue vs. goal', sub:'Monthly revenue goals alongside realised income across the financial year.' },
  'fin-loss':  { crumb:'Financial tracking', title:'Where the loss originated',sub:'Attribution of revenue leakage by source, year to date.' },
  'fin-exp':   { crumb:'Financial tracking', title:'Expenditure',              sub:'Operating spend by category and monthly burn.' },
  'fin-models':{ crumb:'Financial tracking', title:'Revenue models',           sub:'Active income streams and which ones are being tracked.' },
  'fin-rates': { crumb:'Financial tracking', title:'Rate cards',               sub:'Services offered, published rates, and amounts owed.' },
  growth:      { title:'Growth models',  sub:'Pipeline, revenue vs target, client growth, and the key levers driving your numbers.' },
  innovation:  { title:'Innovation box', sub:'Pipeline of ideas from spark to scale.' },
  members:       { title:'Team members',    sub:'Approve new members, manage access, and send invitations to your agency.' },
  'all-agencies':{ title:'All agencies',   sub:'Jump to any agency dashboard.' },
};

/* ── Logo SVG ── */
function ImpactLogo() {
  const sq = (x, y, fill, k) => <rect key={k} x={x} y={y} width="7" height="7" rx="2" fill={fill} />;
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none">
      {sq(0,0,C.brandBright,'a')} {sq(9.5,0,'#ffffff44','b')} {sq(19,0,'#ffffff22','c')}
      {sq(0,9.5,'#ffffff22','d')} {sq(9.5,9.5,C.brand,'e')} {sq(19,9.5,C.brandBright,'f')}
      {sq(0,19,C.brandBright,'g')} {sq(9.5,19,C.signal,'h')} {sq(19,19,C.brand,'i')}
    </svg>
  );
}

/* ── Sidebar ── */
function Sidebar({ active, setActive, openGroups, toggleGroup, collapsed, agencyName, logoSrc, logoScale, router,
                   darkMode, setDarkMode, customPages, addingPage, setAddingPage, newPageName, setNewPageName,
                   addCustomPage, navItems, isAdmin }) {
  const isChildActive = (item) => item.children?.some((c) => c.id === active);
  return (
    <aside style={{ width:collapsed?0:288, background: darkMode ? 'rgba(0,0,0,0.85)' : C.sidebar, backdropFilter: darkMode ? 'blur(20px)' : 'none', WebkitBackdropFilter: darkMode ? 'blur(20px)' : 'none', borderRight: darkMode ? '1px solid rgba(48,108,236,0.20)' : 'none', flexShrink:0, overflow:'hidden', transition:'width .25s', display:'flex', flexDirection:'column', boxShadow: darkMode ? '4px 0 32px rgba(0,0,0,0.60)' : 'none' }}>
      <div style={{ padding:'28px 24px 20px', display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
        {logoSrc
          ? <div style={{ width:44, height:44, borderRadius:10, background:'rgba(255,255,255,0.08)', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={logoSrc} alt={agencyName} loading="eager" fetchPriority="low" style={{ width:'100%', height:'100%', objectFit:'contain', transform: logoScale && logoScale !== 1 ? `scale(${logoScale})` : 'none', transformOrigin:'center' }} />
            </div>
          : <ImpactLogo />
        }
        <div style={{ minWidth:0 }}>
          <div className="display" style={{ color:'#fff', fontWeight:800, fontSize:17, letterSpacing:'-.01em', lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agencyName}</div>
          <div style={{ color:C.sidebarSoft, fontSize:11.5, marginTop:4, letterSpacing:'.04em' }}>IMPACT360 OPS</div>
        </div>
      </div>

      <nav style={{ flex:1, padding:'8px 16px', overflowY:'auto' }}>
        {(navItems || NAV).map((item) => {
          if (item.group) {
            const open        = openGroups[item.group] || false;
            const childActive = isChildActive(item);
            return (
              <div key={item.group} style={{ marginTop:4 }}>
                <button className="ig-nav" onClick={() => toggleGroup(item.group)}
                  style={{ color:childActive && !open ? '#fff' : C.sidebarSoft }}>
                  <item.icon size={17} />
                  <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
                  {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <div style={{ maxHeight:open ? 400 : 0, overflow:'hidden', transition:'max-height .3s' }}>
                  {item.children.map((c) => (
                    <button key={c.id} className={'ig-nav ig-sub'+(active===c.id?' active':'')} onClick={() => setActive(c.id)}>
                      <c.icon size={15} /><span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <button key={item.id} className={'ig-nav'+(active===item.id?' active':'')} onClick={() => setActive(item.id)} style={{ marginTop:4 }}>
              <item.icon size={17} /><span>{item.label}</span>
            </button>
          );
        })}
        {customPages.length > 0 && (
          <div style={{ marginTop:12, borderTop:'1px solid '+C.sidebarLine, paddingTop:12 }}>
            {customPages.map(pg => (
              <button key={pg.id} className={'ig-nav'+(active===pg.id?' active':'')} onClick={() => setActive(pg.id)} style={{ marginTop:4 }}>
                <FileText size={17} /><span>{pg.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <div style={{ padding:'16px 18px 20px', borderTop:'1px solid '+C.sidebarLine, flexShrink:0, display:'flex', flexDirection:'column', gap:6 }}>
        {!collapsed && (addingPage ? (
          <div style={{ display:'flex', gap:5, marginBottom:4 }}>
            <input
              autoFocus
              value={newPageName}
              onChange={e => setNewPageName(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter') addCustomPage(); if(e.key==='Escape'){ setAddingPage(false); setNewPageName(''); } }}
              placeholder="Page name…"
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, padding:'6px 10px', color:'#fff', fontSize:12.5, fontFamily:'inherit', outline:'none' }}
            />
            <button onClick={addCustomPage} style={{ background:C.brand, border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:12, padding:'6px 10px', fontFamily:'inherit', fontWeight:600 }}>Add</button>
            <button onClick={() => { setAddingPage(false); setNewPageName(''); }} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:8, color:C.sidebarSoft, cursor:'pointer', fontSize:13, padding:'6px 9px' }}>✕</button>
          </div>
        ) : (
          <button className="ig-nav" onClick={() => setAddingPage(true)} style={{ color:C.sidebarSoft }}>
            <FilePlus size={17} /><span>Add page</span>
          </button>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'8px 14px' }}>
          {darkMode ? <Moon size={15} color={C.sidebarSoft} /> : <Sun size={15} color={C.sidebarSoft} />}
          {!collapsed && <span style={{ flex:1, fontSize:13, color:C.sidebarSoft, fontWeight:500 }}>Dark mode</span>}
          <button
            onClick={() => setDarkMode(d => !d)}
            style={{ width:36, height:20, borderRadius:99, border:'none', cursor:'pointer', background:darkMode ? C.brand : 'rgba(255,255,255,0.15)', position:'relative', flexShrink:0, transition:'background .2s', padding:0 }}
          >
            <span style={{ position:'absolute', top:2, left:darkMode?18:2, width:16, height:16, borderRadius:99, background:'#fff', transition:'left .2s', display:'block' }} />
          </button>
        </div>
        <button className="ig-nav" onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push('/login');
          router.refresh();
        }} style={{ color:C.sidebarSoft, width:'100%' }}>
          <LogOut size={17} /><span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

/* ── Dark-mode CSS overrides ── */
const DARK_CSS = `
  .ig-dark{background:linear-gradient(135deg,#000000 0%,#010408 50%,#000000 100%) !important;}
  .ig-dark .ig-card{
    background:rgba(255,255,255,0.04) !important;
    border-color:rgba(48,108,236,0.25) !important;
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
    box-shadow:0 8px 32px rgba(0,0,0,0.60),inset 0 1px 0 rgba(91,155,255,0.10) !important;
  }
  .ig-dark .ig-card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(91,155,255,0.35),transparent);
    border-radius:16px 16px 0 0;pointer-events:none;
  }
  .ig-dark .ig-card{position:relative;}
  .ig-dark .ig-hover:hover{
    transform:translateY(-4px) !important;
    box-shadow:0 20px 48px rgba(0,0,0,0.70),0 0 0 1px rgba(48,108,236,0.40),inset 0 1px 0 rgba(91,155,255,0.15) !important;
    border-color:rgba(48,108,236,0.55) !important;
  }
  .ig-dark .ig-kbtn{background:rgba(255,255,255,0.05) !important;border-color:rgba(48,108,236,0.30) !important;color:#7EB3FF !important;}
  .ig-dark .ig-kbtn:hover{color:#fff !important;border-color:rgba(48,108,236,.70) !important;background:rgba(48,108,236,0.25) !important;}
  .ig-dark .ig-search{background:rgba(255,255,255,0.04) !important;border-color:rgba(48,108,236,0.30) !important;backdrop-filter:blur(8px);}
  .ig-dark .ig-search input{color:#E2EEFF !important;}
  .ig-dark .ig-search input::placeholder{color:#3D5A8A !important;}
  .ig-dark .ig-table th{color:#3D5A8A !important;border-color:rgba(48,108,236,0.15) !important;}
  .ig-dark .ig-table td{border-color:rgba(48,108,236,0.12) !important;color:#B8D4FF !important;}
  .ig-dark .ig-table tbody tr:hover{background:rgba(48,108,236,0.08) !important;}
  .ig-dark .ig-finput{background:#0d1b38 !important;border-color:rgba(48,108,236,0.35) !important;color:#E2EEFF !important;color-scheme:dark;}
  .ig-dark .ig-finput:focus{border-color:#5B9BFF !important;box-shadow:0 0 0 3px rgba(48,108,236,0.20) !important;}
  .ig-dark .ig-fselect{background:#0d1b38 !important;border-color:rgba(48,108,236,0.35) !important;color:#E2EEFF !important;color-scheme:dark;}
  .ig-dark .ig-fcancel{color:#7EB3FF !important;border-color:rgba(48,108,236,0.25) !important;}
  .ig-dark .ig-addidea{border-color:rgba(48,108,236,0.25) !important;color:#3D5A8A !important;}
  .ig-dark .ig-addidea:hover{color:#5B9BFF !important;border-color:rgba(48,108,236,0.60) !important;background:rgba(48,108,236,0.08) !important;}
  .ig-dark .ig-addtask{border-color:rgba(48,108,236,0.25) !important;color:#3D5A8A !important;}
  .ig-dark .ig-addtask:hover{color:#5B9BFF !important;border-color:rgba(48,108,236,0.60) !important;background:rgba(48,108,236,0.08) !important;}
  .ig-dark .ig-track{background:rgba(48,108,236,0.15) !important;}
  .ig-dark .ig-nav{color:#3D5A8A !important;}
  .ig-dark .ig-nav:hover{background:rgba(48,108,236,0.12) !important;color:#7EB3FF !important;}
  .ig-dark .ig-nav.active{background:linear-gradient(135deg,#1E4FB8,#306CEC) !important;color:#fff !important;box-shadow:0 4px 20px rgba(48,108,236,0.50) !important;}
  .ig-dark .ig-pill{box-shadow:0 2px 8px rgba(0,0,0,0.40);}
  .ig-dark .ig-kpis .ig-card{
    background:rgba(255,255,255,0.04) !important;
    border-top:1px solid rgba(91,155,255,0.20) !important;
  }
`;

/* ── Global CSS ── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  .ig-root *{box-sizing:border-box;}
  .ig-root{font-family:'Plus Jakarta Sans',sans-serif;color:#14213D;-webkit-font-smoothing:antialiased;}
  .display{font-family:'Schibsted Grotesk',sans-serif;}
  .mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;}
  .ig-card{background:#FFFFFF;border:1px solid rgba(20,33,61,0.10);border-radius:16px;box-shadow:0 2px 12px rgba(20,33,61,0.06),0 1px 3px rgba(20,33,61,0.04);}
  .ig-hover{transition:transform .18s,box-shadow .18s,border-color .18s;cursor:default;}
  .ig-hover:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(20,33,61,.13),0 4px 12px rgba(48,108,236,.10);border-color:rgba(48,108,236,.40);}
  .ig-pill{font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap;letter-spacing:.01em;}
  .ig-track{height:7px;background:rgba(20,33,61,.08);border-radius:99px;overflow:hidden;}
  .ig-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;}
  .ig-nav{display:flex;align-items:center;gap:13px;width:100%;padding:11px 14px;border:none;background:transparent;color:#8FA0C4;font-family:inherit;font-size:14px;font-weight:500;border-radius:12px;cursor:pointer;transition:.15s;}
  .ig-nav:hover{background:rgba(255,255,255,.06);color:#fff;}
  .ig-nav.active{background:linear-gradient(135deg,#1E4FB8,#306CEC);color:#fff;font-weight:600;box-shadow:0 4px 16px rgba(48,108,236,.50);}
  .ig-sub{padding-left:38px;font-size:13.5px;}
  .ig-sub.active{background:rgba(91,155,255,.18);color:#fff;box-shadow:none;}
  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  .rise{animation:rise .35s ease both;}
  .ig-table{width:100%;border-collapse:collapse;font-size:13px;}
  .ig-table th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#93A0B8;font-weight:600;padding:0 10px 10px;border-bottom:1px solid rgba(20,33,61,0.10);}
  .ig-table td{padding:11px 10px;border-bottom:1px solid rgba(20,33,61,0.10);vertical-align:middle;}
  .ig-table tbody tr:last-child td{border-bottom:none;}
  .ig-table tbody tr{transition:background .15s;}
  .ig-table tbody tr:hover{background:rgba(48,108,236,.04);}
  .ig-kbtn{width:38px;height:38px;border-radius:11px;border:1px solid rgba(20,33,61,0.10);background:#FFFFFF;display:flex;align-items:center;justify-content:center;color:#5B6B86;cursor:pointer;transition:.15s;}
  .ig-kbtn:hover{color:#306CEC;border-color:rgba(48,108,236,.4);}
  .ig-search{display:flex;align-items:center;gap:9px;background:#FFFFFF;border:1px solid rgba(20,33,61,0.10);border-radius:11px;padding:0 13px;height:38px;color:#93A0B8;font-size:13px;min-width:230px;}
  .ig-search input{border:none;background:transparent;outline:none;font-family:inherit;font-size:13px;color:#14213D;width:100%;}
  .ig-addidea{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1px dashed rgba(20,33,61,0.10);background:transparent;border-radius:11px;color:#93A0B8;font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:.15s;width:100%;}
  .ig-addidea:hover{color:#306CEC;border-color:#306CEC66;background:#306CEC0A;}
  .ig-addtask{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1px dashed rgba(20,33,61,0.10);background:transparent;border-radius:11px;color:#93A0B8;font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:.15s;width:100%;margin-top:12px;}
  .ig-addtask:hover{color:#306CEC;border-color:#306CEC66;background:#306CEC0A;}
  .ig-finput{border:1px solid rgba(20,33,61,0.12);border-radius:8px;padding:8px 11px;font-family:inherit;font-size:13px;color:#14213D;outline:none;background:#fff;transition:border-color .15s;}
  .ig-finput:focus{border-color:#306CEC;box-shadow:0 0 0 3px rgba(48,108,236,.12);}
  .ig-fselect{border:1px solid rgba(20,33,61,0.12);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;color:#14213D;outline:none;background:#fff;cursor:pointer;transition:border-color .15s;appearance:none;-webkit-appearance:none;}
  .ig-fselect:focus{border-color:#306CEC;}
  .ig-fadd{padding:8px 18px;background:#306CEC;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;white-space:nowrap;}
  .ig-fadd:hover{background:#1E4FB8;}
  .ig-fcancel{padding:8px 12px;background:transparent;color:#93A0B8;border:1px solid rgba(20,33,61,0.10);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;transition:.15s;white-space:nowrap;}
  .ig-fcancel:hover{color:#E0485A;border-color:rgba(224,72,90,.4);}
  .ig-delrow{background:none;border:none;cursor:pointer;color:#93A0B8;padding:3px 6px;border-radius:6px;font-size:13px;opacity:0;transition:opacity .15s,color .15s;flex-shrink:0;}
  tr:hover .ig-delrow,.ig-taskrow:hover .ig-delrow{opacity:1;}
  .ig-delrow:hover{color:#E0485A;}
  tr:hover .ig-rowactions{opacity:1 !important;}
  .rise{animation:rise .5s cubic-bezier(.2,.7,.3,1) both;}
  @keyframes rise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
  @media(max-width:880px){.ig-2col{grid-template-columns:1fr !important;}}
`;

/* ── Main component ── */
export default function AgencyDashboardPage({ agencyId, agencyData, userProfile }) {
  const router   = useRouter();
  const [active,      setActive]     = useState('tasks');
  const [openGroups,  setOpenGroups] = useState({ fin:true, tasks:false });
  const [collapsed,   setCollapsed]  = useState(false);
  const [darkMode,    setDarkMode]   = useState(true);
  const [customPages, setCustomPages]= useState([]);
  const [addingPage,  setAddingPage] = useState(false);
  const [newPageName, setNewPageName]= useState('');
  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]:!prev[key] }));

  Object.assign(C, darkMode ? DARK_C : LIGHT_C);

  const isAdmin   = userProfile?.role === 'admin';
  const isManager = isAdmin || userProfile?.role === 'agency_head';
  const navItems = [
    ...NAV,
    ...(isManager ? [{ id:'members',      label:'Team members', icon:Users2     }] : []),
    ...(isAdmin   ? [{ id:'all-agencies', label:'All agencies', icon:LayoutGrid }] : []),
  ];

  function addCustomPage() {
    if (!newPageName.trim()) return;
    const id = 'custom-' + Date.now();
    setCustomPages(p => [...p, { id, label: newPageName.trim() }]);
    setActive(id);
    setNewPageName('');
    setAddingPage(false);
  }

  const d       = agencyData || {};
  const logoSrc   = AGENCY_LOGOS[agencyId?.toLowerCase()] || null;
  const logoScale = ALL_AGENCIES.find(a => a.slug === agencyId?.toLowerCase())?.logoScale || 1;
  const _customMeta = customPages.find(p => p.id === active);
  const meta = META[active] || (_customMeta ? { title: _customMeta.label, sub: 'Custom page.' } : { title: '', sub: '' });
  const ytdActual = (d.monthly || []).filter((m) => m.actual != null).reduce((a, m) => a + m.actual, 0);

  function renderView() {
    switch (active) {
      case 'tasks': return <TasksView weeklyTasks={d.weeklyTasks} userName={userProfile?.full_name} agencyId={agencyId} agencyUUID={userProfile?.agency_id} isManager={isManager} userId={userProfile?.id} />;
      case 'goals':      return <GoalsView      agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'fin-revenue': return <RevenueView agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'fin-loss':   return <LossView        agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'fin-exp':    return <ExpenditureView  agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'fin-models': return <ModelsView       agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'fin-rates':  return <RatesView        agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'growth':     return <GrowthView       agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'innovation': return <InnovationView   agencyUUID={userProfile?.agency_id} isManager={isManager} />;
      case 'members':       return <MembersView agencyId={agencyId} isAdmin={isAdmin} />;
      case 'all-agencies':  return <AllAgenciesView currentAgencyId={agencyId} onSwitch={(slug) => router.push(`/demo/agencies/${slug}`)} />;
      default: {
        const pg = customPages.find(p => p.id === active);
        if (pg) return (
          <div style={{ background:C.card, border:'1px solid '+C.line, borderRadius:16, padding:'48px 32px', textAlign:'center', color:C.inkSoft }}>
            <FileText size={40} style={{ opacity:.25, marginBottom:16 }} />
            <div style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>{pg.label}</div>
            <div style={{ fontSize:14 }}>This is a custom page. Start adding your content here.</div>
          </div>
        );
        return null;
      }
    }
  }

  return (
    <div className={'ig-root'+(darkMode?' ig-dark':'')} style={{ display:'flex', height:'100vh', minHeight:640, background: darkMode ? 'linear-gradient(135deg,#000000 0%,#010408 50%,#000000 100%)' : C.paper, overflow:'hidden' }}>
      <style>{CSS + (darkMode ? DARK_CSS : '')}</style>

      <Sidebar
        active={active} setActive={setActive}
        openGroups={openGroups} toggleGroup={toggleGroup}
        collapsed={collapsed}
        agencyName={d.name || agencyId || 'Agency'}
        logoSrc={logoSrc}
        logoScale={logoScale}
        router={router}
        darkMode={darkMode} setDarkMode={setDarkMode}
        customPages={customPages}
        addingPage={addingPage} setAddingPage={setAddingPage}
        newPageName={newPageName} setNewPageName={setNewPageName}
        addCustomPage={addCustomPage}
        navItems={navItems}
        isAdmin={isAdmin}
      />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

        {/* dark-mode ambient glow */}
        {darkMode && <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(48,108,236,0.12) 0%,transparent 65%)', top:-200, right:-100, pointerEvents:'none', zIndex:0 }} />}

        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 48px', borderBottom:'1px solid '+C.line, background: darkMode ? 'rgba(2,4,10,0.80)' : C.paper+'EE', backdropFilter:'blur(12px)', flexShrink:0, position:'relative', zIndex:1 }}>
          <button className="ig-kbtn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar"><PanelLeft size={17} /></button>
          <div style={{ flex:1 }}>
            {meta.crumb && <div style={{ fontSize:11.5, color:C.inkFaint, fontWeight:600, letterSpacing:'.03em' }}>{meta.crumb}</div>}
            <h1 className="display" style={{ fontSize:24, fontWeight:800, color:C.ink, margin:0, letterSpacing:'-.01em',
              ...(darkMode ? { background:'linear-gradient(135deg,#FFFFFF,#7EB3FF)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' } : {})
            }}>{meta.title}</h1>
          </div>
          <div className="ig-search"><Search size={15} /><input placeholder="Search projects, clients…" /></div>
          <button className="ig-kbtn" style={{ position:'relative' }}>
            <Bell size={17} />
            <span style={{ position:'absolute', top:9, right:10, width:7, height:7, borderRadius:99, background:'#E0485A', border:'2px solid '+(darkMode?'#02040A':'#F4F6FB') }} />
          </button>
          <button className="ig-kbtn" style={{ width:'auto', padding:'0 14px', gap:7, color:'#fff', background:'linear-gradient(135deg,#1E4FB8,#306CEC)', border:'none', fontFamily:'inherit', fontSize:13, fontWeight:600, boxShadow:'0 4px 14px rgba(48,108,236,0.40)' }}>
            <Plus size={16} /> New
          </button>
        </header>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'36px 48px 64px', position:'relative', zIndex:1,
          backgroundImage: darkMode
            ? 'linear-gradient(rgba(48,108,236,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(48,108,236,0.04) 1px,transparent 1px)'
            : 'linear-gradient('+C.line+' 1px,transparent 1px),linear-gradient(90deg,'+C.line+' 1px,transparent 1px)',
          backgroundSize:'32px 32px' }}>
          <p style={{ color:C.inkSoft, fontSize:14, margin:'0 0 28px', maxWidth:700 }}>{meta.sub}</p>
          <div key={active}>{renderView()}</div>
        </div>
      </main>
    </div>
  );
}
