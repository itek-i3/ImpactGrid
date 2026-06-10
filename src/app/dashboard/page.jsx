import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardPage() {
  // This is your live data source
  const agencyData = {
    goalRevenue: 5000,
    actualRevenue: 4200,
    lossSource: "Delayed client approval",
    expenditure: 1500,
    financialTracking: {
      monthlyGoals: { goalRevenue: 5000, actualRevenue: 4200 },
      lossAnalysis: "Delayed client approval",
      expenditure: 1500,
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0A0A0A', color: '#FAFAFA' }}>
      {/* Pass the data as a prop to the Sidebar */}
      <Sidebar data={agencyData} />
      
      <main style={mainStyle}>
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Actual Revenue</h2>
          <p style={cardValueStyle}>${agencyData.actualRevenue.toLocaleString()}</p>
        </div>
        {/* You can add more cards here referencing agencyData.goalRevenue, etc. */}
      </main>
    </div>
  );
}

const mainStyle = { flex: 1, padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' };
const cardStyle = { background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' };
const cardHeaderStyle = { fontSize: '0.9rem', color: '#888', margin: 0 };
const cardValueStyle = { fontSize: '1.8rem', fontWeight: 'bold', marginTop: '10px' };
