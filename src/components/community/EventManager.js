'use client';

import { CalendarDays, MapPin, DollarSign, Users, Award, AlertCircle } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/community.module.css';

export default function EventManager() {
  const { rows, properties } = useDatabaseStore();

  // Helper to get cell value by property name
  const getVal = (row, propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? row.cells[prop.id] : null;
  };

  // Stats Calculations
  const totalEvents = rows.length;
  const totalExpectedAttendance = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Expected Attendance') || 0),
    0
  );
  
  const totalBudget = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Budget') || 0),
    0
  );

  const totalSpent = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Actual Spend') || 0),
    0
  );

  // Filter out completed and cancelled events to show upcoming list
  const upcomingEvents = rows
    .filter(
      (r) =>
        getVal(r, 'Status') === 'Upcoming' ||
        getVal(r, 'Status') === 'Live' ||
        getVal(r, 'Status') === 'Planning'
    )
    .sort((a, b) => new Date(getVal(a, 'Date')) - new Date(getVal(b, 'Date')));

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' };
      case 'Upcoming':
        return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' };
      case 'Live':
        return { background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' };
      case 'Planning':
        return { background: 'var(--color-bg-active)', color: 'var(--color-text-secondary)' };
      default:
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* KPI Stats */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Events</span>
            <span className={styles.kpiValue}>{totalEvents}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
            <CalendarDays size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Expected Reach</span>
            <span className={styles.kpiValue}>{totalExpectedAttendance}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconInfo}`}>
            <Users size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Cumulative Budget</span>
            <span className={styles.kpiValue}>
              ${totalBudget.toLocaleString()}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
            <DollarSign size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Expenditures</span>
            <span className={styles.kpiValue}>
              ${totalSpent.toLocaleString()}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconWarning}`}>
            <Award size={24} />
          </div>
        </div>
      </div>

      <div className={styles.assetsLayout}>
        {/* Budget vs Actual spend list */}
        <div className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Budget vs Actual Spend</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Expenditure analysis per event
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {rows.map((event) => {
              const budget = Number(getVal(event, 'Budget') || 1);
              const spend = Number(getVal(event, 'Actual Spend') || 0);
              const percent = Math.min((spend / budget) * 100, 100);
              const isOver = spend > budget;

              return (
                <div key={event.id} className={styles.assetRow}>
                  <div className={styles.assetMeta}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {getVal(event, 'Name')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Status:{' '}
                        <span style={{ color: getStatusColor(getVal(event, 'Status')).color }}>
                          {getVal(event, 'Status')}
                        </span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: isOver ? '#ef4444' : 'inherit' }}>
                        Spent: ${spend.toLocaleString()} / ${budget.toLocaleString()}
                      </span>
                      {isOver && (
                        <span style={{ fontSize: '10px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertCircle size={10} /> Over Budget
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.progressContainer}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${percent}%`,
                        background: isOver ? '#ef4444' : '#10b981',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events list */}
        <div className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Upcoming & Active ({upcomingEvents.length})</span>
          </div>
          <div className={styles.onboardingList}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => {
                const colors = getStatusColor(getVal(event, 'Status'));
                return (
                  <div key={event.id} className={styles.onboardingRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.agencyName}>{getVal(event, 'Name')}</span>
                      <span className={styles.eventStatusBadge} style={colors}>
                        {getVal(event, 'Status')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarDays size={12} /> {getVal(event, 'Date') || 'No Date set'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} /> {getVal(event, 'Location') || 'TBD'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> Target Attendance: {getVal(event, 'Expected Attendance') || 0} members
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                No upcoming events scheduled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
