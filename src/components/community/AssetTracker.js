'use client';

import { useState } from 'react';
import { Package2, DollarSign, BarChart3, Plus, Calendar, Landmark } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import { useToast } from '@/components/ui/Toast';
import styles from '@/styles/community.module.css';

export default function AssetTracker({ readOnly = false }) {
  const { rows, properties, updateCell } = useDatabaseStore();
  const toast = useToast();

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logSource, setLogSource] = useState('M-Pesa');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDesc, setLogDesc] = useState('');

  // Local state for income sub-table (Recent Income Logs)
  const [recentLogs, setRecentLogs] = useState([
    {
      id: '1',
      assetName: 'Toyota Hiace (Member Van)',
      amount: 450,
      source: 'M-Pesa',
      date: '2026-05-24',
      description: 'Weekend retreat transport hire',
    },
    {
      id: '2',
      assetName: 'Sony FX3 Cinema Camera',
      amount: 150,
      source: 'Bank Transfer',
      date: '2026-05-22',
      description: 'Studio equipment daily rental',
    },
    {
      id: '3',
      assetName: 'Community Studio Space',
      amount: 800,
      source: 'Cash',
      date: '2026-05-20',
      description: 'Weekly co-working space booking',
    },
  ]);

  // Helper to get cell value by property name
  const getVal = (row, propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? row.cells[prop.id] : null;
  };

  // Helper to get property ID by name
  const getPropId = (propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? prop.id : null;
  };

  // Stats
  const totalAssets = rows.length;
  const totalPurchaseValue = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Purchase Value') || 0),
    0
  );
  const totalCurrentValue = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Current Value') || 0),
    0
  );
  const totalIncome = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Total Income') || 0),
    0
  );

  // Handle Form Submission
  const handleLogSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!selectedAssetId || !logAmount) {
      toast.error('Invalid Inputs', 'Please select an asset and enter an amount.');
      return;
    }

    const row = rows.find((r) => r.id === selectedAssetId);
    if (!row) return;

    const assetName = getVal(row, 'Name') || 'Unnamed Asset';
    const currentIncomePropId = getPropId('Total Income');

    if (!currentIncomePropId) {
      toast.error('Schema Error', 'Could not locate "Total Income" property.');
      return;
    }

    const currentIncome = Number(getVal(row, 'Total Income') || 0);
    const addition = Number(logAmount);
    const newIncome = currentIncome + addition;

    // Update Zustand Store cell!
    updateCell(selectedAssetId, currentIncomePropId, newIncome);

    // Append to local sub-table logs
    const newLog = {
      id: crypto.randomUUID(),
      assetName,
      amount: addition,
      source: logSource,
      date: logDate,
      description: logDesc || 'Asset Rental / Operations',
    };

    setRecentLogs((prev) => [newLog, ...prev]);
    toast.success(
      'Income Logged',
      `Added $${addition} to total income for ${assetName}.`
    );

    // Reset Form
    setLogAmount('');
    setLogDesc('');
  };

  return (
    <div className={styles.dashboard}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Assets</span>
            <span className={styles.kpiValue}>{totalAssets}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
            <Package2 size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Portfolio Value</span>
            <span className={styles.kpiValue}>
              ${totalCurrentValue.toLocaleString()}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconInfo}`}>
            <Landmark size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Generated Income</span>
            <span className={styles.kpiValue}>
              ${totalIncome.toLocaleString()}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
            <DollarSign size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Asset ROI</span>
            <span className={styles.kpiValue}>
              {totalPurchaseValue > 0
                ? ((totalIncome / totalPurchaseValue) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconWarning}`}>
            <BarChart3 size={24} />
          </div>
        </div>
      </div>

      <div className={styles.assetsLayout} style={{ gridTemplateColumns: readOnly ? '1fr' : undefined }}>
        {/* Assets List with utilization bars */}
        <div className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Asset Portfolio Breakdown</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Utilization and ROI performance per asset
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rows.map((asset) => {
              const purchase = Number(getVal(asset, 'Purchase Value') || 1);
              const income = Number(getVal(asset, 'Total Income') || 0);
              const roiPercent = Math.min(((income / purchase) * 100), 100);
              const status = getVal(asset, 'Status') || 'Available';

              return (
                <div key={asset.id} className={styles.assetRow}>
                  <div className={styles.assetMeta}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {getVal(asset, 'Name')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Type: {getVal(asset, 'Type')} &bull; Value: $
                        {Number(getVal(asset, 'Current Value') || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          background:
                            status === 'Available'
                              ? 'rgba(52, 211, 153, 0.15)'
                              : status === 'In Use'
                              ? 'rgba(96, 165, 250, 0.15)'
                              : 'rgba(251, 191, 36, 0.15)',
                          color:
                            status === 'Available'
                              ? '#34d399'
                              : status === 'In Use'
                              ? '#60a5fa'
                              : '#fbbf24',
                          fontWeight: 'bold',
                        }}
                      >
                        {status}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>
                        ROI: {((income / purchase) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Progress ROI bar */}
                  <div className={styles.progressContainer}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${roiPercent}%`,
                        background:
                          roiPercent >= 75
                            ? '#34d399'
                            : roiPercent >= 25
                            ? 'var(--color-accent-primary)'
                            : '#fbbf24',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Income Form */}
        {!readOnly && (
          <div className={styles.dashboardSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Log Asset Income</span>
            </div>
            <form onSubmit={handleLogSubmit} className={styles.loggerForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Select Asset</label>
                <select
                  className={styles.formSelect}
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Asset --</option>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getVal(r, 'Name') || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Amount (USD)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder="e.g. 250"
                  value={logAmount}
                  onChange={(e) => setLogAmount(e.target.value)}
                  required
                  min="1"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Payment Source</label>
                <select
                  className={styles.formSelect}
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value)}
                >
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Studio hire by Youth Group"
                  value={logDesc}
                  onChange={(e) => setLogDesc(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.formBtn}>
                <Plus size={16} />
                Add Income Log
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sub-table: Income logging logs */}
      <div className={styles.dashboardSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Recent Income Logs</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Real-time audit log of asset transactions
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Date</th>
                <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Asset</th>
                <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Description</th>
                <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Source</th>
                <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} style={{ color: 'var(--color-text-muted)' }} />
                    {log.date}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{log.assetName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{log.description}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        background: 'var(--color-bg-active)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {log.source}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#34d399', fontWeight: 'bold' }}>
                    +${log.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
