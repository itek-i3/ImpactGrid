'use client';

import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreHorizontal,
  Trash2,
  Crown,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Avatar from '@/components/ui/Avatar';
import styles from '@/styles/layout.module.css';

const ROLES = ['owner', 'admin', 'editor', 'viewer'];

const ROLE_COLORS = {
  owner: '#a78bfa',
  admin: '#60a5fa',
  editor: '#34d399',
  viewer: '#8b8fa3',
};

const DEMO_MEMBERS = [
  { id: '1', name: 'Erick Omondi', email: 'erick@impact360.org', role: 'owner', avatar: null, joinedAt: '2023-01-15' },
  { id: '2', name: 'Faith Mutua', email: 'faith@gmail.com', role: 'admin', avatar: null, joinedAt: '2024-03-10' },
  { id: '3', name: 'John Doe', email: 'john.doe@gmail.com', role: 'editor', avatar: null, joinedAt: '2025-05-01' },
  { id: '4', name: 'Grace Wanjiku', email: 'grace@outlook.com', role: 'editor', avatar: null, joinedAt: '2025-02-18' },
  { id: '5', name: 'Paul Kiprop', email: 'paul@gmail.com', role: 'viewer', avatar: null, joinedAt: '2024-06-01' },
];

/**
 * Members management page — list, invite, and manage workspace members.
 */
export default function MembersPage() {
  const { workspace } = useWorkspaceStore();
  const [members] = useState(DEMO_MEMBERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: 'var(--space-8) var(--space-6)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <Users size={24} />
            Members
          </h1>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--space-1)',
          }}>
            Manage who has access to {workspace?.name || 'this workspace'}.
          </p>
        </div>

        <button
          onClick={() => setShowInvite(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            background: 'var(--color-accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'opacity var(--transition-fast)',
          }}
        >
          <UserPlus size={14} />
          Invite
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
          animation: 'fadeInDown 0.15s ease forwards',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)',
          }}>
            <h3 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text-primary)',
            }}>
              Invite a member
            </h3>
            <button
              onClick={() => setShowInvite(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={() => {
                setInviteEmail('');
                setShowInvite(false);
              }}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                background: 'var(--color-accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Member List */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {members.map((member, idx) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom:
                idx < members.length - 1
                  ? '1px solid var(--color-border-subtle)'
                  : 'none',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--color-bg-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            {/* Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                background: `${ROLE_COLORS[member.role]}33`,
                color: ROLE_COLORS[member.role],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'var(--font-semibold)',
                fontSize: 'var(--text-sm)',
                flexShrink: 0,
              }}
            >
              {member.name.charAt(0)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                {member.name}
                {member.role === 'owner' && (
                  <Crown size={12} style={{ color: '#fbbf24' }} />
                )}
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}>
                {member.email}
              </div>
            </div>

            {/* Role Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-medium)',
                background: `${ROLE_COLORS[member.role]}22`,
                color: ROLE_COLORS[member.role],
                textTransform: 'capitalize',
              }}
            >
              {member.role}
            </span>

            {/* Joined Date */}
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}>
              Joined {new Date(member.joinedAt).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        padding: 'var(--space-3) 0',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-muted)',
      }}>
        {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
      </div>
    </div>
  );
}
