
import styles from './Sidebar.module.css';

export default function Sidebar({ data }) {
  // Keep your safety check! It prevents crashes.
  if (!data) return <aside className={styles.sidebar}>Loading data...</aside>;

  return (
    <aside className={styles.sidebar}>
      <h5 className={styles.header}>FINANCIAL TRACKING</h5>
      <div className={styles.bodyText}>
        
        <p>Goal Revenue: {data.financialTracking?.monthlyGoals?.goalRevenue || 'N/A'}</p>
        <p>Actual Revenue: {data.financialTracking?.monthlyGoals?.actualRevenue || 'N/A'}</p>
        <p>Loss Source: {data.financialTracking?.lossAnalysis || 'None'}</p>
        <p>Expenditure: {data.financialTracking?.expenditure || '0'}</p>
      </div>
    </aside>
  );
}