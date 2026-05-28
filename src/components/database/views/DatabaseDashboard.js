'use client';

import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import AgencyDashboard from '@/components/community/AgencyDashboard';
import AssetTracker from '@/components/community/AssetTracker';
import EventManager from '@/components/community/EventManager';
import MemberDirectory from '@/components/community/MemberDirectory';
import WhatsAppGroups from '@/components/community/WhatsAppGroups';

/**
 * DatabaseDashboard — router view that mounts the appropriate community
 * dashboard component based on the database type.
 */
export default function DatabaseDashboard({ readOnly = false }) {
  const database = useDatabaseStore((state) => state.database);

  if (!database) return null;

  switch (database.type) {
    case 'agencies':
      return <AgencyDashboard readOnly={readOnly} />;
    case 'assets':
      return <AssetTracker readOnly={readOnly} />;
    case 'events':
      return <EventManager readOnly={readOnly} />;
    case 'members':
      return <MemberDirectory readOnly={readOnly} />;
    case 'whatsapp':
      return <WhatsAppGroups readOnly={readOnly} />;
    default:
      return (
        <div
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
            Database Dashboard
          </h3>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Welcome to the dashboard for {database.name}. Use the tabs above to switch to Table, Board, Calendar, or List views to customize and edit your data.
          </p>
        </div>
      );
  }
}
