'use client';

import { useState, useEffect } from 'react';
import { Building2, Users2, DollarSign, Award, CheckCircle } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import styles from '@/styles/community.module.css';

const PIE_COLORS = ['#fbbf24', '#34d399', '#ef4444']; // Onboarding, Active, Inactive

export default function AgencyDashboard() {
  const { rows, properties } = useDatabaseStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to get cell value by property name
  const getVal = (row, propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? row.cells[prop.id] : null;
  };

  // ── Stats Calculations ──
  const totalAgencies = rows.length;
  const activeAgencies = rows.filter((r) => getVal(r, 'Status') === 'Active').length;
  const onboardingAgencies = rows.filter((r) => getVal(r, 'Status') === 'Onboarding').length;
  
  const totalRevenue = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Revenue Generated') || 0),
    0
  );

  // Performance calculation
  const performanceScores = rows
    .map((r) => getVal(r, 'Performance Score'))
    .filter(Boolean);
  
  const scoreWeights = { Excellent: 4, Good: 3, Average: 2, Poor: 1 };
  const totalWeight = performanceScores.reduce((sum, score) => sum + (scoreWeights[score] || 0), 0);
  const avgScoreVal = performanceScores.length ? (totalWeight / performanceScores.length).toFixed(1) : 0;
  
  let avgScoreLabel = 'N/A';
  if (avgScoreVal >= 3.5) avgScoreLabel = 'Excellent';
  else if (avgScoreVal >= 2.5) avgScoreLabel = 'Good';
  else if (avgScoreVal >= 1.5) avgScoreLabel = 'Average';
  else if (avgScoreVal > 0) avgScoreLabel = 'Poor';

  // ── Chart Data ──
  const revenueChartData = rows.map((r) => ({
    name: getVal(r, 'Name') || 'Unnamed',
    revenue: Number(getVal(r, 'Revenue Generated') || 0),
  })).sort((a, b) => b.revenue - a.revenue);

  const statusCount = rows.reduce(
    (acc, r) => {
      const status = getVal(r, 'Status') || 'Inactive';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { Onboarding: 0, Active: 0, Inactive: 0 }
  );

  const statusChartData = [
    { name: 'Onboarding', value: statusCount.Onboarding },
    { name: 'Active', value: statusCount.Active },
    { name: 'Inactive', value: statusCount.Inactive },
  ].filter((d) => d.value > 0);

  const onboardingList = rows.filter((r) => getVal(r, 'Status') === 'Onboarding');

  return (
    <div className={styles.dashboard}>
      {/* KPI Section */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Agencies</span>
            <span className={styles.kpiValue}>{totalAgencies}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
            <Building2 size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Active Partners</span>
            <span className={styles.kpiValue}>{activeAgencies}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
            <Users2 size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Revenue</span>
            <span className={styles.kpiValue}>
              ${totalRevenue.toLocaleString()}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconInfo}`}>
            <DollarSign size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Avg Performance</span>
            <span className={styles.kpiValue}>{avgScoreLabel}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconWarning}`}>
            <Award size={24} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        {/* Revenue chart */}
        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Revenue Generation per Agency</span>
          <div className={styles.chartContainer}>
            {mounted && revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ left: -10, right: 10, bottom: 5, top: 10 }}>
                  <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--color-accent-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                No revenue data available
              </div>
            )}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Partnership Status Distribution</span>
          <div className={styles.chartContainer}>
            {mounted && statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => {
                      const colorIndex = ['Onboarding', 'Active', 'Inactive'].indexOf(entry.name);
                      return <Cell key={`cell-${index}`} fill={PIE_COLORS[colorIndex >= 0 ? colorIndex : 0]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <Legend formatter={(value) => <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                No status data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding checklist */}
      <div className={styles.dashboardSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            Onboarding Agencies ({onboardingAgencies})
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Follow up with contacts to finalize agreements
          </span>
        </div>
        <div className={styles.onboardingList}>
          {onboardingList.length > 0 ? (
            onboardingList.map((agency) => (
              <div key={agency.id} className={styles.onboardingRow}>
                <div className={styles.agencyInfo}>
                  <span className={styles.agencyName}>
                    {getVal(agency, 'Name') || 'Unnamed Agency'}
                  </span>
                  <span className={styles.agencyContact}>
                    Contact: {getVal(agency, 'Contact Person') || 'N/A'} &bull;{' '}
                    {getVal(agency, 'Email') || 'No Email'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-bg-active)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Pending Review
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: 'var(--space-6)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <CheckCircle size={16} style={{ color: '#34d399' }} />
              All agencies fully onboarded and active!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
