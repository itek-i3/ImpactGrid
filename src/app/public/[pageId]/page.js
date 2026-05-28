'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import BlockEditor from '@/components/editor/BlockEditor';
import DatabaseContainer from '@/components/database/DatabaseContainer';
import { ToastProvider } from '@/components/ui/Toast';
import { Lock, FileWarning, Globe } from 'lucide-react';
import styles from '@/styles/layout.module.css';

function PublicPageContent() {
  const params = useParams();
  const pageId = params?.pageId;

  const { pages, initDemoWorkspace } = useWorkspaceStore();
  const { initBlocks } = useEditorStore();
  const [loading, setLoading] = useState(true);

  // Initialize workspace if not loaded (e.g. direct entry via URL link)
  useEffect(() => {
    if (pages.length === 0) {
      initDemoWorkspace();
    }
    setLoading(false);
  }, [pages, initDemoWorkspace]);

  // Find page details
  const page = pages.find((p) => p.id === pageId);

  // Initialize blocks when page is resolved
  useEffect(() => {
    if (page && !page.isDatabase) {
      initBlocks(page.id);
    }
  }, [page?.id, page?.isDatabase, initBlocks]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--color-bg-primary)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Loading live page...
      </div>
    );
  }

  // 1. Page not found
  if (!page) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--color-bg-primary)',
          gap: 'var(--space-4)',
          color: 'var(--color-text-muted)',
          padding: 'var(--space-6)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
        >
          <FileWarning size={28} />
        </div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          Page Not Found
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: '400px', textAlign: 'center' }}>
          The page you are looking for does not exist or has been permanently removed from this workspace.
        </p>
      </div>
    );
  }

  // 2. Private page
  if (!page.isPublished) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--color-bg-primary)',
          gap: 'var(--space-4)',
          color: 'var(--color-text-muted)',
          padding: 'var(--space-6)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={24} />
        </div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          This page is private
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: '420px', textAlign: 'center', lineHeight: 1.5 }}>
          The owner of this workspace has not published this page to the web. If you think this is a mistake, contact the workspace administrator.
        </p>
      </div>
    );
  }

  // 3. Render Published Page (Read-Only)
  return (
    <div
      style={{
        background: 'var(--color-bg-primary)',
        minHeight: '100dvh',
        color: 'var(--color-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Small live header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: '600' }}>
          <Globe size={14} style={{ color: '#10b981' }} />
          <span>LIVE NOTION SITE</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          ImpactNotion Workspace
        </div>
      </div>

      {/* Main content wrapper */}
      <div
        style={{
          flex: 1,
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
          padding: 'var(--space-12) var(--space-6) var(--space-16) var(--space-6)',
        }}
      >
        {/* Emoji and Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          <span style={{ fontSize: '3rem', lineHeight: '1' }}>
            {page.icon || '📄'}
          </span>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--color-text-primary)',
              margin: '0',
            }}
          >
            {page.title || 'Untitled'}
          </h1>
        </div>

        {/* Dynamic renderer */}
        {page.isDatabase ? (
          <DatabaseContainer pageId={page.id} readOnly={true} />
        ) : (
          <BlockEditor pageId={page.id} readOnly={true} />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        Published with ⚡ <strong>ImpactNotion</strong>
      </div>
    </div>
  );
}

export default function PublicPage() {
  return (
    <ToastProvider>
      <PublicPageContent />
    </ToastProvider>
  );
}
