'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle, Users, Plus, X, RotateCcw, History, Trash2 } from 'lucide-react';
import { useSessionStore } from '@/lib/store/useSessionStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Modal from '@/components/ui/Modal';

const PRESETS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '60 min', seconds: 60 * 60 },
];

const SNOOZE_OPTIONS = [
  { label: '+5 min',  seconds: 5  * 60 },
  { label: '+10 min', seconds: 10 * 60 },
  { label: '+15 min', seconds: 15 * 60 },
];

function fmt(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function initials(name, email) {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
}

// ── Your Session panel ───────────────────────────────────────────────────────
function MySessionPanel({
  session, timeLeft,
  taskDesc, setTaskDesc,
  selectedPreset, setSelectedPreset,
  showCustom, setShowCustom,
  customMinutes, setCustomMinutes,
  logNote, setLogNote,
  onStart, onPause, onResume, onBeginLog, onSnooze, onComplete, onDiscard,
}) {
  // ── No session: start form ──
  if (!session) {
    return (
      <div style={sectionBox}>
        <div style={sectionLabel}>Your Session</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onStart()}
            placeholder="What will you work on?"
            style={inputStyle}
          />
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 600 }}>Duration</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESETS.map((p) => (
                <button key={p.seconds} onClick={() => { setSelectedPreset(p.seconds); setShowCustom(false); }} style={presetBtn(!showCustom && selectedPreset === p.seconds)}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setShowCustom((v) => !v)} style={presetBtn(showCustom)}>Custom</button>
            </div>
            {showCustom && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="number" min={1} max={480}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="90"
                  style={{ ...inputStyle, width: 70 }}
                  autoFocus
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>minutes</span>
              </div>
            )}
          </div>
          <button onClick={onStart} style={primaryBtn}>
            <Play size={14} /> Start Session
          </button>
        </div>
      </div>
    );
  }

  // ── Active / Paused ──
  if (session.status === 'active' || session.status === 'paused') {
    const isPaused = session.status === 'paused';
    const progress = Math.min(1, 1 - timeLeft / session.durationSeconds);
    const circ     = 2 * Math.PI * 54;
    return (
      <div style={sectionBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={sectionLabel}>Your Session</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: isPaused ? '#f59e0b' : '#4ade80', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span className={isPaused ? '' : 'animate-pulse'} style={{ width: 6, height: 6, borderRadius: '50%', background: isPaused ? '#f59e0b' : '#4ade80', display: 'inline-block' }} />
            {isPaused ? 'Paused' : 'Live'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Mini circular timer */}
          <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
            <svg width={112} height={112} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx={56} cy={56} r={54} fill="none" stroke="rgba(48,108,236,0.10)" strokeWidth={5} />
              <circle cx={56} cy={56} r={54} fill="none"
                stroke={isPaused ? '#f59e0b' : '#306CEC'} strokeWidth={5} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', color: isPaused ? '#f59e0b' : '#fff' }}>
              {fmt(timeLeft)}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {session.taskDescription && (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                &ldquo;{session.taskDescription}&rdquo;
              </div>
            )}
            {session.snoozeCount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Snoozed {session.snoozeCount}×</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button onClick={isPaused ? onResume : onPause} style={{ ...ghostBtn, flex: 1, padding: '7px 0', fontSize: 12 }}>
                {isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
              </button>
              <button onClick={onBeginLog} style={{ ...dangerBtn, flex: 1, padding: '7px 0', fontSize: 12 }}>
                <CheckCircle size={12} /> End
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Expired: time's up ──
  if (session.status === 'expired') {
    return (
      <div style={{ ...sectionBox, border: '1px solid rgba(239,68,68,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={sectionLabel}>Your Session</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '.06em' }}>⏰ Time&rsquo;s Up</span>
        </div>
        {session.taskDescription && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 10 }}>&ldquo;{session.taskDescription}&rdquo;</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Snooze for…</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {SNOOZE_OPTIONS.map((s) => (
            <button key={s.seconds} onClick={() => onSnooze(s.seconds)} style={{ ...snoozeBtn, flex: 1 }}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onBeginLog} style={{ ...primaryBtn, flex: 2, padding: '8px 0', fontSize: 12 }}>
            <CheckCircle size={12} /> Log what I did
          </button>
          <button onClick={onDiscard} style={{ ...ghostBtn, flex: 1, padding: '8px 0', fontSize: 12 }}>
            <X size={12} /> Discard
          </button>
        </div>
      </div>
    );
  }

  // ── Logging: completion note ──
  if (session.status === 'logging') {
    return (
      <div style={{ ...sectionBox, border: '1px solid rgba(74,222,128,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>
            {fmtDuration(session.durationSeconds)} done{session.snoozeCount > 0 ? ` · snoozed ${session.snoozeCount}×` : ''}
          </span>
        </div>
        <textarea
          value={logNote}
          onChange={(e) => setLogNote(e.target.value)}
          placeholder="What did you accomplish? (optional)"
          rows={3}
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onComplete('')} style={{ ...ghostBtn, flex: 1, padding: '8px 0', fontSize: 12 }}>Skip</button>
          <button onClick={() => onComplete(logNote)} style={{ ...primaryBtn, flex: 2, padding: '8px 0', fontSize: 12 }}>
            <CheckCircle size={12} /> Save & Complete
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Team Sessions list ───────────────────────────────────────────────────────
function TeamSessionsList({ teamSessions }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const active = (teamSessions || []).filter((s) => s.status !== 'completed');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Users size={12} style={{ color: 'var(--color-text-muted)' }} />
        <span style={sectionLabel}>
          Team Sessions
        </span>
        {active.length > 0 && (
          <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', borderRadius: 99, padding: '1px 7px' }}>
            {active.length} online
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No team members are in a session right now
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map((s) => {
            const profile    = s.profiles || {};
            const name       = profile.full_name || profile.email || 'Team member';
            const remaining  = (new Date(s.end_time).getTime() - now) / 1000;
            const isPaused   = s.status === 'paused';
            const isExpired  = s.status === 'expired' || s.status === 'logging';
            const dotColor   = isExpired ? '#f87171' : isPaused ? '#f59e0b' : '#4ade80';

            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
              }}>
                {/* Avatar */}
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(48,108,236,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#7EB3FF' }}>
                    {initials(profile.full_name, profile.email)}
                  </div>
                )}

                {/* Name + task */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  {s.task_description && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {s.task_description}
                    </div>
                  )}
                </div>

                {/* Status + time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={!isPaused && !isExpired ? 'animate-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: dotColor, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {isExpired ? "Time's up" : isPaused ? 'Paused' : 'Live'}
                    </span>
                  </div>
                  {!isExpired && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(remaining)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function SessionModal({ isOpen, onClose }) {
  const {
    session,
    teamSessions,
    history,
    startSession,
    pauseSession,
    resumeSession,
    expireSession,
    snoozeSession,
    beginLogging,
    completeSession,
    cancelSession,
    fetchTeamSessions,
    fetchHistory,
    clearHistory,
  } = useSessionStore();

  const { workspace } = useWorkspaceStore();
  const workspaceId = workspace?.id;

  const [taskDesc,       setTaskDesc]       = useState('');
  const [selectedPreset, setSelectedPreset] = useState(25 * 60);
  const [showCustom,     setShowCustom]     = useState(false);
  const [customMinutes,  setCustomMinutes]  = useState('');
  const [logNote,        setLogNote]        = useState('');
  const [timeLeft,       setTimeLeft]       = useState(0);
  const intervalRef = useRef(null);
  const pollRef     = useRef(null);

  // Countdown timer
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!session || session.status !== 'active') return;

    const tick = () => {
      const remaining = (session.endTime - Date.now()) / 1000;
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setTimeLeft(0);
        expireSession();
      } else {
        setTimeLeft(remaining);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => clearInterval(intervalRef.current);
  }, [session?.status, session?.endTime, expireSession]);

  // Sync display time when paused
  useEffect(() => {
    if (session?.status === 'paused' && session.endTime && session.pausedAt) {
      setTimeLeft((session.endTime - session.pausedAt) / 1000);
    }
  }, [session?.status, session?.pausedAt]);

  // Poll team sessions and fetch history while modal is open
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    fetchTeamSessions(workspaceId);
    fetchHistory(workspaceId);
    pollRef.current = setInterval(() => fetchTeamSessions(workspaceId), 20_000);
    return () => clearInterval(pollRef.current);
  }, [isOpen, workspaceId, fetchTeamSessions, fetchHistory]);

  const handleStart = () => {
    const dur = showCustom ? Math.max(1, parseInt(customMinutes) || 25) * 60 : selectedPreset;
    startSession(dur, taskDesc.trim(), workspaceId);
    setLogNote('');
  };

  const handleComplete = (note) => {
    completeSession(note);
    setLogNote('');
    setTaskDesc('');
  };

  const handleDiscard = () => {
    cancelSession();
    setTaskDesc('');
    setLogNote('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sessions" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Your Session */}
        <MySessionPanel
          session={session}
          timeLeft={timeLeft}
          taskDesc={taskDesc}       setTaskDesc={setTaskDesc}
          selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset}
          showCustom={showCustom}   setShowCustom={setShowCustom}
          customMinutes={customMinutes} setCustomMinutes={setCustomMinutes}
          logNote={logNote}         setLogNote={setLogNote}
          onStart={handleStart}
          onPause={pauseSession}
          onResume={resumeSession}
          onBeginLog={beginLogging}
          onSnooze={snoozeSession}
          onComplete={handleComplete}
          onDiscard={handleDiscard}
        />

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* Team Sessions */}
        <TeamSessionsList teamSessions={teamSessions} />

        {/* History */}
        {history.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span style={sectionLabel}>My History</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', borderRadius: 99, padding: '1px 7px' }}>
                    {history.length}
                  </span>
                </div>
                <button
                  onClick={() => clearHistory(workspaceId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontWeight: 500 }}
                >
                  <Trash2 size={11} /> Clear
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {history.map((s) => {
                  const mins = Math.round((s.duration_seconds || 0) / 60);
                  const date = s.completed_at ? new Date(s.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                      <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.task_description || 'Focus session'}
                        </div>
                        {s.completion_note && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {s.completion_note}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>{mins}m</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────

const sectionBox = {
  padding: '14px 16px',
  background: 'rgba(48,108,236,0.05)',
  border: '1px solid rgba(48,108,236,0.18)',
  borderRadius: 12,
};

const sectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: 0,
  display: 'inline-block',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

const presetBtn = (active) => ({
  flex: 1, padding: '7px 0', borderRadius: 7, border: '1px solid',
  borderColor: active ? '#306CEC' : 'var(--color-border)',
  background:  active ? 'rgba(48,108,236,0.15)' : 'var(--color-bg-secondary)',
  color:       active ? '#7EB3FF' : 'var(--color-text-secondary)',
  cursor: 'pointer', fontSize: 12, fontWeight: 600,
});

const primaryBtn = {
  padding: '10px 0', borderRadius: 9, border: 'none',
  background: '#306CEC', color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  width: '100%',
};

const ghostBtn = {
  padding: '9px 0', borderRadius: 9,
  border: '1px solid rgba(48,108,236,0.3)',
  background: 'rgba(48,108,236,0.08)',
  color: '#7EB3FF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
};

const dangerBtn = {
  padding: '9px 0', borderRadius: 9,
  border: '1px solid rgba(239,68,68,0.25)',
  background: 'rgba(239,68,68,0.09)',
  color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
};

const snoozeBtn = {
  padding: '7px 0', borderRadius: 7,
  border: '1px solid rgba(245,158,11,0.3)',
  background: 'rgba(245,158,11,0.08)',
  color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
