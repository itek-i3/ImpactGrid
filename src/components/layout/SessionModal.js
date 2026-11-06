'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle, Users, Plus, X, RotateCcw, History, Trash2, Check, UserPlus } from 'lucide-react';
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

// ── Shared teammate checklist — used both when starting a session and when
// inviting more people into one already running ──────────────────────────
function MemberPicker({ candidates, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
      {candidates.map((m) => {
        const isSelected = selected.some((p) => p.id === m.id);
        const name = m.full_name || m.email || 'Team member';
        return (
          <button key={m.id} onClick={() => onToggle(m)} style={memberRow(isSelected)}>
            {m.avatar_url ? (
              <img src={m.avatar_url} alt={name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(48,108,236,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#7EB3FF' }}>
                {initials(m.full_name, m.email)}
              </div>
            )}
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {isSelected && <Check size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
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
  onAcceptInvite, onDeclineInvite, onWithdrawRequest,
}) {
  // ── Requested: waiting on the starter to approve ──
  if (session?.status === 'requested') {
    const starter = session.groupMembers?.[0];
    const starterName = starter?.full_name || starter?.email || 'the session starter';
    return (
      <div style={{ ...sectionBox, border: '1px solid rgba(245,158,11,0.3)' }}>
        <div style={sectionLabel}>Your Session</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
          Waiting for <strong style={{ color: 'var(--color-text-primary)' }}>{starterName}</strong> to approve your request to join
          {session.taskDescription && <> — &ldquo;{session.taskDescription}&rdquo;</>}.
        </div>
        <button onClick={onWithdrawRequest} style={{ ...ghostBtn, width: '100%', padding: '8px 0', fontSize: 12, marginTop: 12 }}>
          <X size={12} /> Withdraw request
        </button>
      </div>
    );
  }

  // ── Invited: not joined until accepted ──
  if (session?.status === 'invited') {
    const inviter = session.groupMembers?.[0];
    const inviterName = inviter?.full_name || inviter?.email || 'A teammate';
    return (
      <div style={{ ...sectionBox, border: '1px solid rgba(48,108,236,0.3)' }}>
        <div style={sectionLabel}>Your Session</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>{inviterName}</strong> invited you to a focus session
          {session.taskDescription && <> — &ldquo;{session.taskDescription}&rdquo;</>}.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button onClick={onAcceptInvite} style={{ ...primaryBtn, flex: 1, padding: '8px 0', fontSize: 12 }}>Accept</button>
          <button onClick={onDeclineInvite} style={{ ...ghostBtn, flex: 1, padding: '8px 0', fontSize: 12 }}>Decline</button>
        </div>
      </div>
    );
  }

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
    // Clamped: snoozing past the original duration would otherwise push
    // timeLeft above durationSeconds and swing progress negative.
    const progress = Math.max(0, Math.min(1, 1 - timeLeft / session.durationSeconds));
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
            {(() => {
              const members = session.groupMembers || [];
              // Only a member whose own row has actually flipped to a
              // "joined" status counts as "with me" — an 'invited' row means
              // they haven't accepted yet, so they're listed separately and
              // never folded into "With ...".
              const joined  = members.filter((m) => ['active', 'paused', 'expired', 'logging'].includes(m.status));
              const pending = members.filter((m) => !joined.includes(m));
              return (
                <>
                  {joined.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} /> With {joined.map((m) => m.full_name || m.email || 'teammate').join(', ')}
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} /> Invited, waiting to accept: {pending.map((m) => m.full_name || m.email || 'teammate').join(', ')}
                    </div>
                  )}
                </>
              );
            })()}
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

// ── Pending join requests on a session I started ────────────────────────────
function PendingJoinRequests({ requests, onRespond }) {
  if (!requests?.length) return null;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {requests.length} request{requests.length > 1 ? 's' : ''} to join your session
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {requests.map((r) => {
          const name = r.profiles?.full_name || r.profiles?.email || 'Someone';
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.profiles?.avatar_url ? (
                <img src={r.profiles.avatar_url} alt={name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(48,108,236,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#7EB3FF' }}>
                  {initials(r.profiles?.full_name, r.profiles?.email)}
                </div>
              )}
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <button onClick={() => onRespond(r, true)} title="Approve" style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'rgba(74,222,128,0.18)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Check size={13} />
              </button>
              <button onClick={() => onRespond(r, false)} title="Decline" style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.14)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Team Sessions list ───────────────────────────────────────────────────────
const STATUS_COLOR = { active: '#4ade80', paused: '#f59e0b', requested: '#a78bfa', expired: '#f87171', logging: '#f87171' };
const STATUS_LABEL = { active: 'Live', paused: 'Paused', requested: 'Requested', expired: "Time's up", logging: "Time's up" };

// Buckets team rows into standalone "solo" cards and one entry per
// group_id — rows sharing a group_id render as one clustered card with a
// full roster instead of each getting its own disconnected card.
function clusterTeamSessions(rows) {
  const byGroup = new Map();
  const solo = [];
  for (const r of rows) {
    if (r.group_id) {
      if (!byGroup.has(r.group_id)) byGroup.set(r.group_id, []);
      byGroup.get(r.group_id).push(r);
    } else {
      solo.push(r);
    }
  }
  return [
    ...solo.map((row) => ({ type: 'solo', row })),
    ...[...byGroup.entries()].map(([groupId, members]) => ({ type: 'group', groupId, members })),
  ];
}

function SoloSessionCard({ row: s, now, canRequestJoin, onRequestJoin }) {
  const profile   = s.profiles || {};
  const name      = profile.full_name || profile.email || 'Team member';
  const remaining = (new Date(s.end_time).getTime() - now) / 1000;
  const isPaused  = s.status === 'paused';
  const isExpired = s.status === 'expired' || s.status === 'logging';
  const dotColor  = STATUS_COLOR[s.status] || '#4ade80';

  return (
    <div style={{
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
            {STATUS_LABEL[s.status] || 'Live'}
          </span>
        </div>
        {!isExpired && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(remaining)}
          </span>
        )}
      </div>

      {canRequestJoin && (
        <button onClick={onRequestJoin} style={{ marginLeft: 2, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#7EB3FF', background: 'rgba(48,108,236,0.12)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer' }}>
          Request to join
        </button>
      )}
    </div>
  );
}

function GroupSessionCard({ members, now, canRequestJoin, onRequestJoin }) {
  const task = members.find((m) => m.task_description)?.task_description;
  // Collapsed header shows the "best" status present across the group.
  const priority = ['active', 'paused', 'requested', 'expired', 'logging'];
  const headline = priority.find((p) => members.some((m) => m.status === p)) || 'active';

  return (
    <div style={{ padding: '10px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Stacked avatars */}
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {members.slice(0, 4).map((m, i) => {
            const p = m.profiles || {};
            const name = p.full_name || p.email || 'Team member';
            return p.avatar_url ? (
              <img key={m.id} src={p.avatar_url} alt={name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-bg-secondary)', marginLeft: i === 0 ? 0 : -10 }} />
            ) : (
              <div key={m.id} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(48,108,236,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7EB3FF', border: '2px solid var(--color-bg-secondary)', marginLeft: i === 0 ? 0 : -10 }}>
                {initials(p.full_name, p.email)}
              </div>
            );
          })}
          {members.length > 4 && (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', border: '2px solid var(--color-bg-secondary)', marginLeft: -10 }}>
              +{members.length - 4}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{members.length} in a group session</div>
          {task && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{task}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[headline], textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>{STATUS_LABEL[headline]}</span>
      </div>

      {/* Roster — one line per member, their own status */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {members.map((m) => {
          const p = m.profiles || {};
          const name = p.full_name || p.email || 'Team member';
          const remaining = (new Date(m.end_time).getTime() - now) / 1000;
          const showTime = m.status === 'active' || m.status === 'paused';
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[m.status], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: STATUS_COLOR[m.status] }}>
                {showTime ? fmt(remaining) : STATUS_LABEL[m.status]}
              </span>
            </div>
          );
        })}
      </div>

      {canRequestJoin && (
        <button onClick={onRequestJoin} style={{ marginTop: 8, width: '100%', fontSize: 11, fontWeight: 700, color: '#7EB3FF', background: 'rgba(48,108,236,0.12)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 7, padding: '6px 0', cursor: 'pointer' }}>
          Request to join
        </button>
      )}
    </div>
  );
}

function TeamSessionsList({
  teamSessions,
  canInvite, addingToRunningSession, inviteCandidates, selectedParticipants, onToggleParticipant,
  showInvitePicker, onToggleInvitePicker, onSendInvite, invitingInProgress,
  viewerHasSession, onRequestJoin,
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const rows = (teamSessions || []).filter((s) => s.status !== 'completed');
  const liveCount = rows.filter((s) => s.status !== 'requested').length;
  const clusters = clusterTeamSessions(rows);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Users size={12} style={{ color: 'var(--color-text-muted)' }} />
        <span style={sectionLabel}>
          Team Sessions
        </span>
        {liveCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', borderRadius: 99, padding: '1px 7px' }}>
            {liveCount} online
          </span>
        )}
        {canInvite && (
          <button
            onClick={onToggleInvitePicker}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#7EB3FF', background: 'rgba(48,108,236,0.12)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 7, padding: '4px 9px', cursor: 'pointer' }}
          >
            <UserPlus size={11} /> Invite to session
          </button>
        )}
      </div>

      {showInvitePicker && canInvite && (
        <div style={{ marginBottom: 14, padding: 11, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            {addingToRunningSession
              ? "They'll get a notification and join with the time already remaining."
              : "They'll get a notification to join a new session with you."}
          </div>
          <MemberPicker candidates={inviteCandidates} selected={selectedParticipants} onToggle={onToggleParticipant} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={onToggleInvitePicker} style={{ ...ghostBtn, flex: 1, padding: '7px 0', fontSize: 12 }}>Cancel</button>
            <button
              onClick={onSendInvite}
              disabled={selectedParticipants.length === 0 || invitingInProgress}
              style={{ ...primaryBtn, flex: 2, padding: '7px 0', fontSize: 12, opacity: selectedParticipants.length === 0 || invitingInProgress ? 0.6 : 1 }}
            >
              <UserPlus size={12} /> {invitingInProgress ? 'Inviting…' : `Invite${selectedParticipants.length ? ` (${selectedParticipants.length})` : ''}`}
            </button>
          </div>
        </div>
      )}

      {clusters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No team members are in a session right now
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clusters.map((c) => c.type === 'solo' ? (
            <SoloSessionCard
              key={c.row.id} row={c.row} now={now}
              canRequestJoin={!viewerHasSession && ['active', 'paused'].includes(c.row.status)}
              onRequestJoin={() => onRequestJoin(c.row.id)}
            />
          ) : (
            <GroupSessionCard
              key={c.groupId} members={c.members} now={now}
              canRequestJoin={!viewerHasSession && c.members.some((m) => ['active', 'paused'].includes(m.status))}
              onRequestJoin={() => {
                const target = c.members.find((m) => ['active', 'paused'].includes(m.status));
                if (target) onRequestJoin(target.id);
              }}
            />
          ))}
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
    pendingRequests,
    history,
    startSession,
    inviteToSession,
    acceptInvite,
    requestToJoinSession,
    respondToJoinRequest,
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

  const { workspace, userProfile } = useWorkspaceStore();
  const workspaceId = workspace?.id;
  const myUserId = userProfile?.id;

  const [taskDesc,       setTaskDesc]       = useState('');
  const [selectedPreset, setSelectedPreset] = useState(25 * 60);
  const [showCustom,     setShowCustom]     = useState(false);
  const [customMinutes,  setCustomMinutes]  = useState('');
  const [logNote,        setLogNote]        = useState('');
  const [timeLeft,       setTimeLeft]       = useState(0);
  const [members,              setMembers]              = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [showInvitePicker,     setShowInvitePicker]     = useState(false);
  const [invitingInProgress,   setInvitingInProgress]   = useState(false);
  const intervalRef = useRef(null);

  const inviteCandidates = members.filter((m) => m.id !== myUserId);
  // "Add team session" next to the Team Sessions header is always available
  // — not just once you already have a session running — so it's where
  // people actually look for it. It routes to one of two things depending on
  // state: add to the session you already have going, or start a new one
  // with the people you pick. The one case it hides for is a session stuck
  // in expired/logging — resolve that first via the Your Session panel.
  const hasUnresolvedSession = session && session.status !== 'active' && session.status !== 'paused';
  const notYetInGroup = session?.groupMembers
    ? inviteCandidates.filter((c) => !session.groupMembers.some((g) => g.id === c.id))
    : inviteCandidates;
  const canShowAddTeamSession = !hasUnresolvedSession && notYetInGroup.length > 0;
  const addingToRunningSession = !!(session?.dbId && (session.status === 'active' || session.status === 'paused'));
  const toggleParticipant = (m) => setSelectedParticipants((prev) =>
    prev.some((p) => p.id === m.id) ? prev.filter((p) => p.id !== m.id) : [...prev, m]);

  // Closing/reopening the picker always starts from an empty pick.
  const toggleInvitePicker = () => { setShowInvitePicker((v) => !v); setSelectedParticipants([]); };
  const handleSendInvite = async () => {
    if (!selectedParticipants.length) return;
    setInvitingInProgress(true);
    try {
      if (addingToRunningSession) {
        await inviteToSession(selectedParticipants);
      } else {
        const dur = showCustom ? Math.max(1, parseInt(customMinutes) || 25) * 60 : selectedPreset;
        await startSession(dur, taskDesc.trim(), workspaceId, selectedParticipants);
      }
      setSelectedParticipants([]);
      setShowInvitePicker(false);
    } finally {
      setInvitingInProgress(false);
    }
  };

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

  // Refresh team sessions + history the instant the modal opens. Ongoing
  // freshness — including while this modal is closed — comes from the
  // persistent poll in SessionProvider.
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    fetchTeamSessions(workspaceId);
    fetchHistory(workspaceId);
    fetch(`/os/api/workspaces/${workspaceId}/chat-members`)
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => { if (j?.data) setMembers(j.data); })
      .catch(() => {});
  }, [isOpen, workspaceId, fetchTeamSessions, fetchHistory]);

  const handleStart = () => {
    // No participants here deliberately — inviting while starting now goes
    // exclusively through "Add team session" (handleSendInvite) below. This
    // button used to double as the group-start action when the invite picker
    // lived in this form; now that it's been moved out, passing
    // selectedParticipants here would let a selection left over from opening
    // (and abandoning) that other picker silently turn a plain solo start
    // into a group session the user never asked for.
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
          onAcceptInvite={acceptInvite}
          onDeclineInvite={cancelSession}
          onWithdrawRequest={cancelSession}
        />

        {/* Requests pending on a session I started */}
        <PendingJoinRequests
          requests={pendingRequests}
          onRespond={(request, accept) => respondToJoinRequest(request, accept, workspaceId)}
        />

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* Team Sessions */}
        <TeamSessionsList
          teamSessions={teamSessions}
          canInvite={canShowAddTeamSession}
          addingToRunningSession={addingToRunningSession}
          inviteCandidates={notYetInGroup}
          selectedParticipants={selectedParticipants}
          onToggleParticipant={toggleParticipant}
          showInvitePicker={showInvitePicker}
          onToggleInvitePicker={toggleInvitePicker}
          onSendInvite={handleSendInvite}
          invitingInProgress={invitingInProgress}
          viewerHasSession={!!session}
          onRequestJoin={(id) => requestToJoinSession(id)}
        />

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

const memberRow = (selected) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
  border: '1px solid', borderColor: selected ? '#306CEC' : 'var(--color-border)',
  background: selected ? 'rgba(48,108,236,0.12)' : 'var(--color-bg-secondary)',
  cursor: 'pointer', textAlign: 'left', width: '100%',
});

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
