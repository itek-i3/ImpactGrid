'use client';

import { useState } from 'react';
import {
  Settings,
  Palette,
  Globe,
  Shield,
  Bell,
  Download,
  Trash2,
  Sun,
  Moon,
  Check,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import styles from '@/styles/layout.module.css';

const ICONS = ['🚀', '🏠', '💼', '🎯', '⭐', '🌍', '🔥', '💡', '🏆', '❤️', '📊', '🎓'];

/**
 * Workspace Settings — manage workspace name, icon, theme, and danger zone.
 */
export default function SettingsPage() {
  const { workspace, setWorkspace, theme, toggleTheme } = useWorkspaceStore();
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (workspace) {
      setWorkspace({ ...workspace, name: workspaceName });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: 'var(--space-8) var(--space-6)',
    }}>
      <h1 style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}>
        <Settings size={24} />
        Settings
      </h1>
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-tertiary)',
        marginBottom: 'var(--space-8)',
      }}>
        Manage your workspace settings and preferences.
      </p>

      {/* Workspace Info */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-4)',
        }}>
          Workspace
        </h2>

        <div style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          {/* Name */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
            }}>
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Icon */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
            }}>
              Icon
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => {
                    if (workspace) setWorkspace({ ...workspace, icon });
                  }}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    background: workspace?.icon === icon
                      ? 'var(--color-accent-primary-subtle)'
                      : 'none',
                    border: workspace?.icon === icon
                      ? '2px solid var(--color-accent-primary)'
                      : '1px solid var(--color-border)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
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
            {saved ? <Check size={14} /> : null}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <Palette size={14} />
          Appearance
        </h2>
        <div style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--color-text-primary)',
              }}>
                Theme
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}>
                Currently using {theme} mode.
              </div>
            </div>
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: '#ef4444',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <Shield size={14} />
          Danger Zone
        </h2>
        <div style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid #ef444444',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--color-text-primary)',
              }}>
                Delete Workspace
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}>
                This action is irreversible. All pages and data will be lost.
              </div>
            </div>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                background: '#ef444422',
                color: '#ef4444',
                border: '1px solid #ef444444',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
