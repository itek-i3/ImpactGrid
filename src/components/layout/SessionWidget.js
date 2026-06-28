'use client';

import { useState, useEffect, useRef } from 'react';
import { Pause, Play, Timer, CheckCircle, X } from 'lucide-react';
import { useSessionStore } from '@/lib/store/useSessionStore';

function fmt(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function SessionWidget() {
  const { session, pauseSession, resumeSession, expireSession, openSessionModal } = useSessionStore();
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!session || session.status !== 'active') {
      if (session?.status === 'paused' && session.endTime && session.pausedAt) {
        setTimeLeft(Math.max(0, (session.endTime - session.pausedAt) / 1000));
      }
      return;
    }

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
  }, [session?.status, session?.endTime, session?.pausedAt, expireSession]);

  if (!session || session.status === 'completed') return null;

  const isActive  = session.status === 'active';
  const isPaused  = session.status === 'paused';
  const isExpired = session.status === 'expired' || session.status === 'logging';

  const dotColor   = isExpired ? '#f87171' : isPaused ? '#f59e0b' : '#4ade80';
  const borderColor = isExpired ? 'rgba(239,68,68,0.35)' : isPaused ? 'rgba(245,158,11,0.35)' : 'rgba(48,108,236,0.40)';
  const progress   = isExpired ? 1 : Math.min(1, 1 - timeLeft / (session.durationSeconds || 1));
  const circ       = 2 * Math.PI * 16;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(2,9,18,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 40,
        padding: '5px 10px 5px 6px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={openSessionModal}
    >
      {/* Mini circular progress */}
      <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
        <svg width={32} height={32} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle cx={16} cy={16} r={16} fill="none" stroke="rgba(48,108,236,0.10)" strokeWidth={3} />
          <circle
            cx={16} cy={16} r={16} fill="none"
            stroke={isExpired ? '#f87171' : isPaused ? '#f59e0b' : '#306CEC'}
            strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className={isActive ? 'animate-pulse' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
        </div>
      </div>

      {/* Time */}
      <span style={{
        fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
        color: isExpired ? '#f87171' : isPaused ? '#f59e0b' : '#fff',
        minWidth: 40,
      }}>
        {isExpired ? "Time's up" : fmt(timeLeft)}
      </span>

      {/* Task label */}
      {session.taskDescription && (
        <span style={{
          fontSize: 11, color: 'var(--color-text-muted)',
          maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {session.taskDescription}
        </span>
      )}

      {/* Pause / Resume button */}
      {(isActive || isPaused) && (
        <button
          onClick={(e) => { e.stopPropagation(); isPaused ? resumeSession() : pauseSession(); }}
          style={{
            width: 26, height: 26, borderRadius: '50%', border: 'none',
            background: isPaused ? 'rgba(245,158,11,0.15)' : 'rgba(48,108,236,0.15)',
            color: isPaused ? '#f59e0b' : '#7EB3FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {isPaused ? <Play size={12} /> : <Pause size={12} />}
        </button>
      )}
    </div>
  );
}
