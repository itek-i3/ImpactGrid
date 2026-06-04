'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users2,
  DollarSign,
  Award,
  CheckCircle,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Target,
  TrendingUp,
  Lightbulb,
  Landmark,
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useRouter } from 'next/navigation';
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
  const { rows, properties, updateCell } = useDatabaseStore();
  const { workspace, pages } = useWorkspaceStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);

  // Local state for form fields to prevent focus loss & cursor jumps during typing
  const [localGoals, setLocalGoals] = useState('');
  const [localGoalRev, setLocalGoalRev] = useState(0);
  const [localActualRev, setLocalActualRev] = useState(0);
  const [localExpenditure, setLocalExpenditure] = useState(0);
  const [localRevenueModel, setLocalRevenueModel] = useState('');
  const [localLossOrigin, setLocalLossOrigin] = useState('');
  const [localGrowthModels, setLocalGrowthModels] = useState('');
  const [localInnovationBox, setLocalInnovationBox] = useState('');
  const [localRateCard, setLocalRateCard] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to get cell value by property name
  const getVal = (row, propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? row.cells[prop.id] : null;
  };

  const selectedAgency = rows.find((r) => r.id === selectedAgencyId);

  // Sync selected agency cells into local state
  useEffect(() => {
    if (selectedAgency) {
      setLocalGoals(getVal(selectedAgency, 'Goals') || '');
      setLocalGoalRev(Number(getVal(selectedAgency, 'Goal Revenue/Month') || 0));
      setLocalActualRev(Number(getVal(selectedAgency, 'Actual Revenue/Month') || 0));
      setLocalExpenditure(Number(getVal(selectedAgency, 'Expenditure') || 0));
      setLocalRevenueModel(getVal(selectedAgency, 'Revenue Model') || '');
      setLocalLossOrigin(getVal(selectedAgency, 'Loss Origin') || '');
      setLocalGrowthModels(getVal(selectedAgency, 'Growth Models') || '');
      setLocalInnovationBox(getVal(selectedAgency, 'Innovation Box') || '');

      let rc = [];
      try {
        const rcStr = getVal(selectedAgency, 'Rate Card');
        if (rcStr) {
          rc = JSON.parse(rcStr);
        }
      } catch (e) {
        console.error('Failed to parse rate card:', e);
      }
      setLocalRateCard(rc);
    }
  }, [selectedAgencyId, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to update a cell in the Zustand store
  const handleUpdateStoreField = (fieldName, value) => {
    if (!selectedAgencyId) return;
    const prop = properties.find((p) => p.name === fieldName);
    if (prop) {
      updateCell(selectedAgencyId, prop.id, value);
    }
  };

  // Sync rate card to store
  const handleUpdateRateCard = (newRateCard) => {
    setLocalRateCard(newRateCard);
    handleUpdateStoreField('Rate Card', JSON.stringify(newRateCard));
  };

  // Rate card modification helpers
  const addRateCardItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      service: 'New Service',
      rate: 0,
      quantity: 0,
      total: 0,
      owed: 0,
    };
    const updated = [...localRateCard, newItem];
    handleUpdateRateCard(updated);
  };

  const updateRateCardItem = (itemId, key, val) => {
    const updated = localRateCard.map((item) => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [key]: val };
        if (key === 'rate' || key === 'quantity') {
          const rateVal = key === 'rate' ? Number(val) : Number(item.rate);
          const qtyVal = key === 'quantity' ? Number(val) : Number(item.quantity);
          updatedItem.total = Number((rateVal * qtyVal).toFixed(2));
        }
        return updatedItem;
      }
      return item;
    });
    handleUpdateRateCard(updated);
  };

  const deleteRateCardItem = (itemId) => {
    const updated = localRateCard.filter((item) => item.id !== itemId);
    handleUpdateRateCard(updated);
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
  const revenueChartData = rows
    .map((r) => ({
      name: getVal(r, 'Name') || 'Unnamed',
      revenue: Number(getVal(r, 'Revenue Generated') || 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

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

  // Drawer math calculations
  const netMargin = localActualRev - localExpenditure;
  const isLoss = localGoalRev > localActualRev;
  const deficitValue = isLoss ? localGoalRev - localActualRev : 0;

  return (
    <div className={styles.dashboardSplit}>
      <div className={styles.dashboardLeft}>
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
                    <BarChart
                      data={revenueChartData}
                      margin={{ left: -10, right: 10, bottom: 5, top: 10 }}
                    >
                      <XAxis
                        dataKey="name"
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="var(--color-accent-primary)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--color-text-muted)',
                    }}
                  >
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
                          const colorIndex = ['Onboarding', 'Active', 'Inactive'].indexOf(
                            entry.name
                          );
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={PIE_COLORS[colorIndex >= 0 ? colorIndex : 0]}
                            />
                          );
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
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    No status data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TOIG HQ Agency Cards Directory */}
          <div className={styles.dashboardSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                TOIG HQ Agencies Directory ({totalAgencies})
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Click on any agency card to enter its workspace and view tasks, finances, or custom documents
              </span>
            </div>
            <div className={styles.agencyGrid}>
              {rows.map((agency) => {
                const name = getVal(agency, 'Name') || 'Unnamed Agency';
                const status = getVal(agency, 'Status') || 'Inactive';
                const contact = getVal(agency, 'Contact Person') || 'N/A';
                const revenue = Number(getVal(agency, 'Revenue Generated') || 0);
                const projects = Number(getVal(agency, 'Total Projects') || 0);

                let icon = '🏢';
                if (name === 'Itek') icon = '💻';
                else if (name === 'I360') icon = '🚀';
                else if (name === 'I3x Africa') icon = '🌍';
                else if (name === 'I3 studio') icon = '🎨';
                else if (name === 'i3+') icon = '✨';
                else if (name === 'I3 launchpad') icon = '🔥';

                let statusColor = '#ef4444';
                if (status === 'Active') statusColor = '#34d399';
                if (status === 'Onboarding') statusColor = '#fbbf24';

                const toigHqPage = pages.find((p) => p.title === 'The TOIG HQ');
                const agencyPage = pages.find(
                  (p) => p.title === name && p.parentId === toigHqPage?.id
                );

                return (
                  <div
                    key={agency.id}
                    className={styles.agencyCard}
                    onClick={() => {
                      if (agencyPage && workspace) {
                        router.push(`/${workspace.id}/${agencyPage.id}`);
                      }
                    }}
                  >
                    <div className={styles.agencyCardHeader}>
                      <span className={styles.agencyCardIcon}>{icon}</span>
                      <span
                        className={styles.selectBadge}
                        style={{
                          background: statusColor + '22',
                          color: statusColor,
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {status}
                      </span>
                    </div>
                    <div className={styles.agencyCardName}>{name}</div>
                    <div className={styles.agencyCardMeta}>
                      <div className={styles.agencyCardMetaItem}>
                        <span className={styles.agencyCardMetaLabel}>Lead:</span>
                        <span className={styles.agencyCardMetaVal}>{contact}</span>
                      </div>
                      <div className={styles.agencyCardMetaItem}>
                        <span className={styles.agencyCardMetaLabel}>Projects:</span>
                        <span className={styles.agencyCardMetaVal}>{projects}</span>
                      </div>
                      <div className={styles.agencyCardMetaItem}>
                        <span className={styles.agencyCardMetaLabel}>Monthly Rev:</span>
                        <span className={styles.agencyCardMetaVal}>${revenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <button className={styles.agencyCardButton}>
                      Enter Workspace
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Onboarding checklist */}
          <div className={styles.dashboardSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                Onboarding Queue ({onboardingAgencies})
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Agencies currently setting up profiles
              </span>
            </div>
            <div className={styles.onboardingList}>
              {onboardingList.length > 0 ? (
                onboardingList.map((agency) => (
                  <div
                    key={agency.id}
                    className={`${styles.onboardingRow} ${styles.dashboardRowInteractive}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedAgencyId(agency.id)}
                  >
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
                        Pending Checklist
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
      </div>

      {/* Side Profile Drawer */}
      {selectedAgency && (
        <div className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <div>
              <h3 className={styles.drawerHeaderTitle}>
                {getVal(selectedAgency, 'Name') || 'Agency Profile'}
              </h3>
              <span className={styles.drawerHeaderSubtitle}>
                {getVal(selectedAgency, 'Contact Person') || 'No Contact'} &bull;{' '}
                {getVal(selectedAgency, 'Email') || 'No Email'}
              </span>
            </div>
            <button className={styles.drawerCloseBtn} onClick={() => setSelectedAgencyId(null)}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.drawerContent}>
            {/* 1. Goals per Project */}
            <div className={styles.drawerSection}>
              <span className={styles.drawerSectionTitle}>
                <Target size={12} style={{ marginRight: '6px', display: 'inline' }} />
                Goals per Project
              </span>
              <div className={styles.drawerInputGroup}>
                <label className={styles.drawerLabel}>Key Deliverables & Objectives</label>
                <textarea
                  className={styles.drawerTextarea}
                  placeholder="Describe target milestones, campaigns, and goals for this agency..."
                  value={localGoals}
                  onChange={(e) => setLocalGoals(e.target.value)}
                  onBlur={() => handleUpdateStoreField('Goals', localGoals)}
                />
              </div>
            </div>

            {/* 2. Financial Tracking */}
            <div className={styles.drawerSection}>
              <span className={styles.drawerSectionTitle}>
                <Landmark size={12} style={{ marginRight: '6px', display: 'inline' }} />
                Financial Tracking
              </span>

              {/* Input grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <div className={styles.drawerInputGroup}>
                  <label className={styles.drawerLabel}>Goal Rev / Month ($)</label>
                  <input
                    type="number"
                    className={styles.drawerInput}
                    value={localGoalRev}
                    onChange={(e) => setLocalGoalRev(Number(e.target.value))}
                    onBlur={() => handleUpdateStoreField('Goal Revenue/Month', localGoalRev)}
                  />
                </div>
                <div className={styles.drawerInputGroup}>
                  <label className={styles.drawerLabel}>Actual Rev / Month ($)</label>
                  <input
                    type="number"
                    className={styles.drawerInput}
                    value={localActualRev}
                    onChange={(e) => setLocalActualRev(Number(e.target.value))}
                    onBlur={() => {
                      handleUpdateStoreField('Actual Revenue/Month', localActualRev);
                      // Sync to 'Revenue Generated' as well
                      handleUpdateStoreField('Revenue Generated', localActualRev);
                    }}
                  />
                </div>
                <div className={styles.drawerInputGroup}>
                  <label className={styles.drawerLabel}>Expenditure / Month ($)</label>
                  <input
                    type="number"
                    className={styles.drawerInput}
                    value={localExpenditure}
                    onChange={(e) => setLocalExpenditure(Number(e.target.value))}
                    onBlur={() => handleUpdateStoreField('Expenditure', localExpenditure)}
                  />
                </div>
                <div className={styles.drawerInputGroup}>
                  <label className={styles.drawerLabel}>Revenue Model</label>
                  <input
                    type="text"
                    className={styles.drawerInput}
                    placeholder="e.g. Retainer, Project basis"
                    value={localRevenueModel}
                    onChange={(e) => setLocalRevenueModel(e.target.value)}
                    onBlur={() => handleUpdateStoreField('Revenue Model', localRevenueModel)}
                  />
                </div>
              </div>

              {/* Calculated Widget Grid */}
              <div className={styles.financeWidgetGrid} style={{ marginBottom: 'var(--space-3)' }}>
                <div className={styles.financeWidgetCard}>
                  <span className={styles.financeWidgetLabel}>Net Margin</span>
                  <span
                    className={`${styles.financeWidgetValue} ${
                      netMargin >= 0
                        ? styles.financeWidgetValuePositive
                        : styles.financeWidgetValueNegative
                    }`}
                  >
                    ${netMargin.toLocaleString()}
                  </span>
                </div>
                <div className={styles.financeWidgetCard}>
                  <span className={styles.financeWidgetLabel}>Goal Deficit</span>
                  <span
                    className={`${styles.financeWidgetValue} ${
                      deficitValue > 0 ? styles.financeWidgetValueNegative : ''
                    }`}
                  >
                    ${deficitValue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Loss origin alert and textarea */}
              {isLoss && (
                <div className={styles.lossAnalysisBox}>
                  <span className={styles.lossAnalysisTitle}>
                    <AlertCircle size={12} style={{ marginRight: '4px', display: 'inline' }} />
                    Deficit Detected — Origin of Loss
                  </span>
                  <textarea
                    className={styles.drawerTextarea}
                    style={{ minHeight: '60px', marginTop: 'var(--space-2)' }}
                    placeholder="Explain what caused the deficit this month (e.g. churned accounts, delayed payments)..."
                    value={localLossOrigin}
                    onChange={(e) => setLocalLossOrigin(e.target.value)}
                    onBlur={() => handleUpdateStoreField('Loss Origin', localLossOrigin)}
                  />
                </div>
              )}
            </div>

            {/* 3. Rate Cards */}
            <div className={styles.drawerSection}>
              <span className={styles.drawerSectionTitle}>
                <DollarSign size={12} style={{ marginRight: '6px', display: 'inline' }} />
                Rate Card & Services
              </span>
              <div className={styles.rateCardTableContainer}>
                <table className={styles.rateCardTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Service</th>
                      <th style={{ width: '15%' }}>Rate</th>
                      <th style={{ width: '15%' }}>Qty</th>
                      <th style={{ width: '15%' }}>Owed</th>
                      <th style={{ width: '10%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {localRateCard.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="text"
                            className={styles.rateCardInput}
                            value={item.service}
                            onChange={(e) =>
                              updateRateCardItem(item.id, 'service', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className={styles.rateCardInput}
                            value={item.rate}
                            onChange={(e) =>
                              updateRateCardItem(item.id, 'rate', Number(e.target.value))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className={styles.rateCardInput}
                            value={item.quantity}
                            onChange={(e) =>
                              updateRateCardItem(item.id, 'quantity', Number(e.target.value))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className={styles.rateCardInput}
                            value={item.owed}
                            onChange={(e) =>
                              updateRateCardItem(item.id, 'owed', Number(e.target.value))
                            }
                          />
                        </td>
                        <td>
                          <button
                            className={styles.rateCardDeleteBtn}
                            onClick={() => deleteRateCardItem(item.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className={styles.rateCardAddBtn} onClick={addRateCardItem}>
                  <Plus size={12} /> Add Rate Item
                </button>
              </div>
            </div>

            {/* 4. Growth Models */}
            <div className={styles.drawerSection}>
              <span className={styles.drawerSectionTitle}>
                <TrendingUp size={12} style={{ marginRight: '6px', display: 'inline' }} />
                Growth Models
              </span>
              <div className={styles.drawerInputGroup}>
                <label className={styles.drawerLabel}>Expansion Plans & Partnerships</label>
                <textarea
                  className={styles.drawerTextarea}
                  placeholder="Outline scale strategies, partnership opportunities, and expansion channels..."
                  value={localGrowthModels}
                  onChange={(e) => setLocalGrowthModels(e.target.value)}
                  onBlur={() => handleUpdateStoreField('Growth Models', localGrowthModels)}
                />
              </div>
            </div>

            {/* 5. Innovation Box */}
            <div className={styles.drawerSection}>
              <span className={styles.drawerSectionTitle}>
                <Lightbulb size={12} style={{ marginRight: '6px', display: 'inline' }} />
                Innovation Box
              </span>
              <div className={styles.drawerInputGroup}>
                <label className={styles.drawerLabel}>Experimental Ideas & R&D</label>
                <textarea
                  className={styles.drawerTextarea}
                  placeholder="Draft cutting-edge concepts, pilot tests, or service expansion ideas..."
                  value={localInnovationBox}
                  onChange={(e) => setLocalInnovationBox(e.target.value)}
                  onBlur={() => handleUpdateStoreField('Innovation Box', localInnovationBox)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
