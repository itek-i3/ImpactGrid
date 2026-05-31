'use client';

import { useEffect } from 'react';
import {
  FileText,
  Database,
  Plus,
  Clock,
  Users,
  Calendar,
  BarChart3,
  MessageSquare,
  Building2,
  Wallet,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useRouter } from 'next/navigation';
import styles from '@/styles/layout.module.css';

const QUICK_ACTIONS = [
  { icon: FileText, label: 'New Document', type: 'page', emoji: '📄' },
  { icon: Database, label: 'New Database', type: 'database', emoji: '📊' },
];

const COMMUNITY_TEMPLATES = [
  { icon: Building2, label: 'Agencies', dbType: 'agencies', emoji: '🏢', desc: 'Track agency partners & performance' },
  { icon: Wallet, label: 'Assets', dbType: 'assets', emoji: '💰', desc: 'Manage community assets & income' },
  { icon: Calendar, label: 'Events', dbType: 'events', emoji: '📅', desc: 'Plan events, budgets & attendance' },
  { icon: Users, label: 'Members', dbType: 'members', emoji: '👥', desc: 'Directory of community members' },
  { icon: MessageSquare, label: 'WhatsApp Groups', dbType: 'whatsapp', emoji: '💬', desc: 'Manage group links & admins' },
];

/**
 * Workspace Home — landing page when a workspace is selected.
 * Shows quick actions, recent pages, and community template shortcuts.
 */
export default function WorkspaceHomePage({ params }) {
  const {
    workspace,
    pages,
    addPage,
    setCurrentPage,
  } = useWorkspaceStore();
  const router = useRouter();

  // Get recent pages (non-archived, sorted by update time)
  const recentPages = [...pages]
    .filter((p) => !p.isArchived)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6);

  const handleCreatePage = async (type, dbType = null) => {
    const template = dbType
      ? COMMUNITY_TEMPLATES.find((t) => t.dbType === dbType)
      : null;

    const newId = await addPage({
      title: template?.label || '',
      icon: template?.emoji || '📄',
      parentId: null,
      isDatabase: type === 'database',
      databaseType: dbType || (type === 'database' ? 'tasks' : undefined),
    });

    if (newId && workspace) {
      router.push(`/${workspace.id}/${newId}`);
    }
  };

  const handleOpenPage = (page) => {
    setCurrentPage(page);
    if (workspace) {
      router.push(`/${workspace.id}/${page.id}`);
    }
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: 'var(--space-8) var(--space-6)',
    }}>
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
        }}>
          {workspace?.icon || '🚀'} {workspace?.name || 'Workspace'}
        </h1>
        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--color-text-tertiary)',
        }}>
          Welcome back! Create, organize, and manage your community operations.
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-3)',
        }}>
          Quick Actions
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleCreatePage(action.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-accent-primary-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-accent-primary)',
              }}>
                <action.icon size={18} />
              </div>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Pages */}
      {recentPages.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-3)',
          }}>
            <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Recent Pages
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            {recentPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleOpenPage(page)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                }}
              >
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>
                  {page.icon || '📄'}
                </span>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {page.title || 'Untitled'}
                </span>
                {page.isDatabase && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                  }}>
                    Database
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Community Templates */}
      <div>
        <h2 style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-3)',
        }}>
          Community Templates
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {COMMUNITY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.dbType}
              onClick={() => handleCreatePage('database', tpl.dbType)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                color: 'var(--color-text-primary)',
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{tpl.emoji}</span>
              <div>
                <div style={{
                  fontWeight: 'var(--font-medium)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: '2px',
                }}>
                  {tpl.label}
                </div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  {tpl.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
