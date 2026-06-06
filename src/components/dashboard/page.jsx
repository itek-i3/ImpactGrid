// src/app/dashboard/page.jsx
import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardPage() {
  // This is the actual data object the Sidebar is waiting for
  const agencyData = {
    financialTracking: {
      monthlyGoals: { goalRevenue: 5000, actualRevenue: 4200 },
      lossAnalysis: "Delayed client approval",
      expenditure: 1500,
      revenueModels: ["SaaS", "Consulting"]
    },
    growthModels: ["Market Penetration"],
    innovationBox: "AI-driven community matchmaking"
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* YOU MUST PASS data={agencyData} HERE */}
      <Sidebar data={agencyData} /> 
      
      <main style={{ padding: '40px' }}>
        <h1 style={{ fontFamily: 'League Spartan', fontSize: '60pt' }}>DASHBOARD</h1>
      </main>
    </div>
  );
}