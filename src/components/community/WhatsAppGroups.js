'use client';

import { Users, Link, Copy, ArrowUpRight, MessageSquareCode } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import { useToast } from '@/components/ui/Toast';
import styles from '@/styles/community.module.css';

export default function WhatsAppGroups({ readOnly = false }) {
  const { rows, properties, updateCell } = useDatabaseStore();
  const toast = useToast();

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

  // Stats Calculations
  const totalGroups = rows.length;
  const totalMembers = rows.reduce(
    (sum, r) => sum + Number(getVal(r, 'Member Count') || 0),
    0
  );
  const avgGroupSize = totalGroups > 0 ? (totalMembers / totalGroups).toFixed(0) : 0;

  // Counter Actions (+ / -)
  const handleCounterChange = (row, addition) => {
    if (readOnly) return;
    const propId = getPropId('Member Count');
    if (!propId) return;

    const currentVal = Number(getVal(row, 'Member Count') || 0);
    const newVal = Math.max(0, currentVal + addition);

    // Update in-store Zustand cell
    updateCell(row.id, propId, newVal);

    toast.info(
      'Member Count Updated',
      `Updated member count for ${getVal(row, 'Group Name')} to ${newVal}.`
    );
  };

  // Copy invite link
  const handleCopyLink = (row) => {
    const link = getVal(row, 'Invite Link');
    if (!link) {
      toast.error('No Link', 'This group has no invite link.');
      return;
    }

    navigator.clipboard.writeText(link);
    toast.success('Link Copied', 'WhatsApp invite link copied to clipboard.');
  };

  return (
    <div className={styles.dashboard}>
      {/* KPI Stats */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`} style={{ borderTopColor: '#25d366' }}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Groups</span>
            <span className={styles.kpiValue}>{totalGroups}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`} style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25d366' }}>
            <MessageSquareCode size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Combined Membership</span>
            <span className={styles.kpiValue}>{totalMembers}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`} style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25d366' }}>
            <Users size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Avg Group Size</span>
            <span className={styles.kpiValue}>{avgGroupSize}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconInfo}`}>
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* WhatsApp Groups Grid */}
      <div className={styles.whatsappGrid}>
        {rows.map((group) => {
          const groupName = getVal(group, 'Group Name') || 'Unnamed Group';
          const purpose = getVal(group, 'Purpose') || 'No purpose listed.';
          const count = Number(getVal(group, 'Member Count') || 0);
          const invite = getVal(group, 'Invite Link') || '';
          const status = getVal(group, 'Status') || 'Active';
          const admin = getVal(group, 'Admin') || 'N/A';

          return (
            <div key={group.id} className={styles.whatsappCard} style={{ borderTopColor: status === 'Active' ? '#25d366' : '#8b8fa3' }}>
              <div className={styles.whatsappHeader}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className={styles.whatsappTitle}>{groupName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Admin: {admin} &bull; Status: {status}
                  </span>
                </div>
              </div>

              <div className={styles.whatsappPurpose}>{purpose}</div>

              {/* Interactive Counter Block */}
              <div className={styles.whatsappCounter}>
                <span>Members in group:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={styles.whatsappCountValue}>{count}</span>
                  {!readOnly && (
                    <div className={styles.counterBtns}>
                      <button
                        className={styles.counterBtn}
                        onClick={() => handleCounterChange(group, -1)}
                        title="Decrease member count"
                      >
                        -
                      </button>
                      <button
                        className={styles.counterBtn}
                        onClick={() => handleCounterChange(group, 1)}
                        title="Increase member count"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Invite Actions */}
              <div className={styles.whatsappActions}>
                <button
                  className={`${styles.whatsappBtn} ${styles.btnCopy}`}
                  onClick={() => handleCopyLink(group)}
                >
                  <Copy size={13} />
                  Copy Link
                </button>
                <a
                  href={invite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.whatsappBtn} ${styles.btnJoin}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Link size={13} />
                  Join Group
                  <ArrowUpRight size={10} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
