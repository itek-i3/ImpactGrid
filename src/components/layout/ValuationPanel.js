'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useToast } from '@/components/ui/Toast';
import { 
  Building2, TrendingUp, Wallet, ArrowRight, Lock, Save, RefreshCw, 
  HelpCircle, Info, DollarSign, Percent, Sliders, Database, AlertCircle, CheckSquare, Square
} from 'lucide-react';

const money = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));

// Simple parser for financial figures
function parseFinancialNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const clean = v.toString().replace(/[^\d.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
}

export default function ValuationPanel() {
  const { workspace, activeAgencyId, agencies, userProfile, isDemo, setCurrentView } = useWorkspaceStore();
  const isMobile = useIsMobile();
  const toast = useToast();
  
  const agencyId = workspace?.agency_id || activeAgencyId || null;
  const isAcr = isDemo || !!agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr');
  const canAccess = isDemo || (isAcr && ['manager', 'superadmin'].includes(userProfile?.role));

  const [businesses, setBusinesses] = useState([]);
  const [selectedBizId, setSelectedBizId] = useState('');
  const [loading, setLoading] = useState(true);
  const [financeLogs, setFinanceLogs] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Period filter: '30d' | '90d' | '12m' | 'all'
  const [period, setPeriod] = useState('all');

  // Valuation inputs state (can be overridden/saved)
  const [manualSalary, setManualSalary] = useState('');
  const [manualPerks, setManualPerks] = useState('');
  const [manualOneOffs, setManualOneOffs] = useState('');
  const [manualDepreciation, setManualDepreciation] = useState('');
  const [manualInterest, setManualInterest] = useState('');
  
  const [sdeMultiple, setSdeMultiple] = useState('2.0');
  const [revenueMultiple, setRevenueMultiple] = useState('1.0');
  
  const [dcfGrowth, setDcfGrowth] = useState('5');
  const [dcfDiscount, setDcfDiscount] = useState('25');
  const [dcfYears, setDcfYears] = useState('5');
  
  const [assets, setAssets] = useState('');
  const [liabilities, setLiabilities] = useState('');

  // Auto-detected add-backs selection state: { [logId_itemId]: boolean }
  const [enabledAddBacks, setEnabledAddBacks] = useState({});

  const activeBiz = useMemo(() => businesses.find(b => b.id === selectedBizId), [businesses, selectedBizId]);

  // Load businesses
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isDemo) {
        let list = [];
        try {
          const raw = localStorage.getItem(`demo-biz-${agencyId || 'x'}`);
          list = raw ? JSON.parse(raw) : [
            { id: 'demo-biz-1', name: 'Elite Car Wash', sector: 'Services', domain: 'Car Wash' },
            { id: 'demo-biz-2', name: 'Star Laundromat', sector: 'Services', domain: 'Laundromat' }
          ];
        } catch (_) {}
        if (!cancelled) {
          setBusinesses(list);
          if (list.length > 0) setSelectedBizId(list[0].id);
          setLoading(false);
        }
        return;
      }
      if (!agencyId) {
        if (!cancelled) {
          setBusinesses([]);
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await createClient()
          .from('businesses')
          .select('*')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: true });
        if (!cancelled) {
          setBusinesses(data || []);
          if (data && data.length > 0) setSelectedBizId(data[0].id);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [agencyId, isDemo]);

  // Load finance logs + evaluations
  useEffect(() => {
    if (!selectedBizId) return;
    let cancelled = false;
    async function loadData() {
      setLoadingLogs(true);
      if (isDemo) {
        // Fetch demo finance logs
        const demoKey = `demo-finance-${agencyId || 'x'}-${selectedBizId}`;
        const raw = localStorage.getItem(demoKey);
        let logs = [];
        if (raw) {
          logs = JSON.parse(raw);
        } else {
          // Generate mock logs for testing
          const now = new Date();
          logs = Array.from({ length: 60 }).map((_, i) => {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
            const rev = Math.round((isWeekend ? 15000 : 8000) + Math.random() * 4000);
            
            // Add some SDE items occasionally
            const expenseItems = [];
            let totalExp = 0;
            if (i % 7 === 0) {
              expenseItems.push({ what: "Owner Salary Draw", amount: 25000 });
              totalExp += 25000;
            }
            if (i % 15 === 0) {
              expenseItems.push({ what: "Equipment depreciation entry", amount: 12000 });
              totalExp += 12000;
            }
            if (i % 10 === 0) {
              expenseItems.push({ what: "One-off business permit renewal", amount: 15000 });
              totalExp += 15000;
            }
            
            // Normal expense
            const rent = i % 30 === 0 ? 30000 : 0;
            if (rent > 0) {
              expenseItems.push({ what: "Rent Payment", amount: rent });
              totalExp += rent;
            }
            const supplies = Math.round(2000 + Math.random() * 2000);
            expenseItems.push({ what: "Utility / Supplies", amount: supplies });
            totalExp += supplies;

            return {
              id: `mock-fin-log-${i}`,
              entry_date: date,
              revenue: rev,
              expenses: totalExp,
              expense_items: expenseItems,
              note: `Seed entry for day ${i}`
            };
          });
        }
        
        // Fetch demo evaluations
        let evals = [];
        try {
          const rawEvals = localStorage.getItem(`ig-${agencyId || 'guest'}-acq-evaluations`);
          evals = rawEvals ? JSON.parse(rawEvals) : [];
        } catch (_) {}

        if (!cancelled) {
          setFinanceLogs(logs);
          setEvaluations(evals);
          setLoadingLogs(false);
        }
        return;
      }

      // Live Supabase fetches
      try {
        const sb = createClient();
        const [logsRes, evalsRes] = await Promise.all([
          sb.from('daily_finance')
            .select('*')
            .eq('business_id', selectedBizId)
            .order('entry_date', { ascending: false }),
          sb.from('acquisition_evaluations')
            .select('id, data')
            .eq('agency_id', agencyId)
        ]);

        if (!cancelled) {
          setFinanceLogs(logsRes.data || []);
          setEvaluations((evalsRes.data || []).map(r => ({ ...(r.data || {}), id: r.id })));
          setLoadingLogs(false);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
        setLoadingLogs(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [selectedBizId, agencyId, isDemo]);

  // Find matching evaluation and load saved valuation values
  const matchingEval = useMemo(() => {
    if (!activeBiz) return null;
    return evaluations.find(e => e.businessName?.toLowerCase() === activeBiz.name?.toLowerCase());
  }, [evaluations, activeBiz]);

  // Load valuation settings when matching evaluation or business changes
  useEffect(() => {
    if (matchingEval && matchingEval.valuation) {
      const v = matchingEval.valuation;
      setManualSalary(v.ownerSalary || '');
      setManualPerks(v.ownerPerks || '');
      setManualOneOffs(v.oneOffs || '');
      setManualDepreciation(v.depreciation || '');
      setManualInterest(v.interest || '');
      setSdeMultiple(v.multiple != null ? String(v.multiple) : '2.0');
      setRevenueMultiple(v.revenueMultiple != null ? String(v.revenueMultiple) : '1.0');
      setDcfGrowth(v.dcfGrowth != null ? String(v.dcfGrowth) : '5');
      setDcfDiscount(v.dcfDiscount != null ? String(v.dcfDiscount) : '25');
      setDcfYears(v.dcfYears != null ? String(v.dcfYears) : '5');
      setAssets(v.assets || '');
      setLiabilities(v.liabilities || '');
    } else {
      // Defaults
      setManualSalary('');
      setManualPerks('');
      setManualOneOffs('');
      setManualDepreciation('');
      setManualInterest('');
      
      // If we have an evaluation score, set suggested multiple
      const score = matchingEval?.total ?? 0;
      const suggested = Math.round((1.5 + (Math.max(0, Math.min(100, score)) / 100) * 1.5) * 10) / 10;
      setSdeMultiple(String(suggested));
      setRevenueMultiple('1.0');
      setDcfGrowth('5');
      setDcfDiscount('25');
      setDcfYears('5');
      setAssets('');
      setLiabilities('');
    }
    
    // Reset enabled checkboxes
    setEnabledAddBacks({});
  }, [matchingEval, selectedBizId]);

  // Filter logs by period
  const filteredLogs = useMemo(() => {
    if (!financeLogs.length) return [];
    if (period === 'all') return financeLogs;
    
    const cutoff = new Date();
    if (period === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (period === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (period === '12m') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return financeLogs.filter(log => log.entry_date >= cutoffStr);
  }, [financeLogs, period]);

  // Compute stats and scan add-backs
  const stats = useMemo(() => {
    if (!filteredLogs.length) return {
      totalRevenue: 0, totalExpenses: 0, totalNetProfit: 0,
      months: 0, annualizedFactor: 1, runRateRevenue: 0, runRateNet: 0,
      detectedItems: []
    };

    let totalRevenue = 0;
    let totalExpenses = 0;
    let minDateStr = filteredLogs[0].entry_date;
    let maxDateStr = filteredLogs[0].entry_date;

    const detectedItems = [];

    filteredLogs.forEach(log => {
      totalRevenue += num(log.revenue);
      totalExpenses += num(log.expenses);
      if (log.entry_date < minDateStr) minDateStr = log.entry_date;
      if (log.entry_date > maxDateStr) maxDateStr = log.entry_date;

      // Scan expense items for add-backs
      const items = log.expense_items || [];
      items.forEach((item, index) => {
        const desc = (item.what || '').toLowerCase();
        const cat = (log.expense_category || '').toLowerCase();
        const amt = num(item.amount);
        if (amt <= 0) return;

        let detectedType = null;
        let matchReason = '';

        if (desc.includes('owner') || desc.includes('director') || desc.includes('founder') || desc.includes('ceo') || desc.includes('cfo') || desc.includes('dividend') || cat === 'salaries') {
          detectedType = 'salary';
          matchReason = `Match in Salaries or description contains owner/director/dividend`;
        } else if (desc.includes('perk') || desc.includes('personal') || desc.includes('benefit') || desc.includes('club') || desc.includes('golf') || desc.includes('entertainment')) {
          detectedType = 'perk';
          matchReason = `Description contains perk/personal/benefit/club/entertainment`;
        } else if (desc.includes('one-off') || desc.includes('setup') || desc.includes('renovation') || desc.includes('repair') || desc.includes('legal') || desc.includes('fine') || desc.includes('penalty')) {
          detectedType = 'oneoff';
          matchReason = `Description contains one-off/setup/renovation/repair/legal/fine`;
        } else if (desc.includes('deprec') || desc.includes('amort')) {
          detectedType = 'depreciation';
          matchReason = `Description contains depreciation/amortization`;
        } else if (desc.includes('interest') || desc.includes('loan') || desc.includes('debt') || desc.includes('finance charge')) {
          detectedType = 'interest';
          matchReason = `Description contains interest/loan/debt/finance charge`;
        }

        if (detectedType) {
          detectedItems.push({
            logId: log.id,
            itemId: `${log.id}_${index}`,
            date: log.entry_date,
            type: detectedType,
            what: item.what || 'Unspecified item',
            amount: amt,
            reason: matchReason
          });
        }
      });
    });

    const totalNetProfit = totalRevenue - totalExpenses;
    
    // Calculate date span in months
    const minD = new Date(minDateStr);
    const maxD = new Date(maxDateStr);
    const diffTime = Math.abs(maxD - minD);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.round((diffDays / 30.4) * 10) / 10);
    
    const annualizedFactor = 12 / months;
    const runRateRevenue = totalRevenue * annualizedFactor;
    const runRateNet = totalNetProfit * annualizedFactor;

    return {
      totalRevenue, totalExpenses, totalNetProfit,
      months, annualizedFactor, runRateRevenue, runRateNet,
      detectedItems
    };
  }, [filteredLogs]);

  // SDE calculations incorporating checkboxes and overrides
  const valuationResult = useMemo(() => {
    // 1. Calculate active add-backs from checkboxes
    const addBackSum = { salary: 0, perk: 0, oneoff: 0, depreciation: 0, interest: 0 };
    stats.detectedItems.forEach(item => {
      const isEnabled = enabledAddBacks[item.itemId] !== false; // Checked by default
      if (isEnabled) {
        addBackSum[item.type] += item.amount;
      }
    });

    // Annualize the detected add-backs
    const annualizedSalaryAddBack = addBackSum.salary * stats.annualizedFactor;
    const annualizedPerksAddBack = addBackSum.perk * stats.annualizedFactor;
    const annualizedOneOffsAddBack = addBackSum.oneoff * stats.annualizedFactor;
    const annualizedDepreciationAddBack = addBackSum.depreciation * stats.annualizedFactor;
    const annualizedInterestAddBack = addBackSum.interest * stats.annualizedFactor;

    // 2. Add manual overrides
    const finalSalary = parseFinancialNumber(manualSalary) ?? annualizedSalaryAddBack;
    const finalPerks = parseFinancialNumber(manualPerks) ?? annualizedPerksAddBack;
    const finalOneOffs = parseFinancialNumber(manualOneOffs) ?? annualizedOneOffsAddBack;
    const finalDepreciation = parseFinancialNumber(manualDepreciation) ?? annualizedDepreciationAddBack;
    const finalInterest = parseFinancialNumber(manualInterest) ?? annualizedInterestAddBack;

    const sde = stats.runRateNet + finalSalary + finalPerks + finalOneOffs + finalDepreciation + finalInterest;
    
    // ── Earnings Multiple ──
    const multipleVal = num(sdeMultiple);
    const earningsWorth = sde > 0 ? Math.round(sde * multipleVal) : 0;

    // ── Revenue Multiple ──
    const revMultVal = num(revenueMultiple);
    const revenueWorth = stats.runRateRevenue > 0 ? Math.round(stats.runRateRevenue * revMultVal) : 0;

    // ── Discounted Cash Flow ──
    const g = num(dcfGrowth) / 100;
    const r = num(dcfDiscount) / 100;
    const yrs = Math.max(1, Math.min(10, Math.round(num(dcfYears) || 5)));
    let dcfWorth = 0;
    if (sde > 0 && r > 0) {
      let pv = 0;
      for (let t = 1; t <= yrs; t++) {
        const cft = sde * Math.pow(1 + g, t - 1);
        pv += cft / Math.pow(1 + r, t);
      }
      const finalCF = sde * Math.pow(1 + g, yrs - 1);
      pv += (finalCF * multipleVal) / Math.pow(1 + r, yrs);
      dcfWorth = Math.round(pv);
    }

    // ── Net Asset Approach ──
    const assetVal = parseFinancialNumber(assets) ?? 0;
    const liabilityVal = parseFinancialNumber(liabilities) ?? 0;
    const netAssetWorth = Math.max(0, assetVal - liabilityVal);

    // ── Reconciliation ──
    const methods = [
      { key: 'earnings', label: 'Earnings Multiple (SDE)', value: earningsWorth },
      { key: 'revenue', label: 'Revenue Multiple', value: revenueWorth },
      { key: 'dcf', label: 'Discounted Cash Flow (DCF)', value: dcfWorth },
      { key: 'asset', label: 'Net Assets Value', value: netAssetWorth }
    ];

    const vals = methods.map(m => m.value).filter(x => x > 0);
    const rangeLow = vals.length ? Math.min(...vals) : 0;
    const rangeHigh = vals.length ? Math.max(...vals) : 0;

    // Recommended valuation: SDE first, then DCF, then Revenue, floored by net asset worth
    let recommended = earningsWorth || dcfWorth || revenueWorth || netAssetWorth;
    if (recommended > 0 && netAssetWorth > 0) {
      recommended = Math.max(recommended, netAssetWorth);
    }

    const lowMult = Math.max(1.0, Math.round((multipleVal - 0.5) * 10) / 10);
    const offerLow = Math.round(sde * lowMult);
    const offerHigh = recommended;

    const monthlyProfit = stats.totalNetProfit / Math.max(1, stats.months);
    const paybackMonths = recommended > 0 && monthlyProfit > 0 ? Math.round((recommended / monthlyProfit) * 10) / 10 : 0;

    return {
      annualizedSalaryAddBack,
      annualizedPerksAddBack,
      annualizedOneOffsAddBack,
      annualizedDepreciationAddBack,
      annualizedInterestAddBack,
      finalSalary, finalPerks, finalOneOffs, finalDepreciation, finalInterest,
      sde,
      earningsWorth,
      revenueWorth,
      dcfWorth,
      netAssetWorth,
      methods,
      rangeLow,
      rangeHigh,
      recommended,
      offerLow,
      offerHigh,
      paybackMonths
    };
  }, [stats, enabledAddBacks, manualSalary, manualPerks, manualOneOffs, manualDepreciation, manualInterest, sdeMultiple, revenueMultiple, dcfGrowth, dcfDiscount, dcfYears, assets, liabilities]);

  // Toggle checklist checkbox
  const toggleItem = (itemId) => {
    setEnabledAddBacks(prev => ({
      ...prev,
      [itemId]: prev[itemId] === false ? true : false
    }));
  };

  // Save valuation data
  const handleSave = async () => {
    if (!activeBiz) return;
    setSaving(true);
    
    const valuationData = {
      netProfit: String(stats.runRateNet),
      ownerSalary: String(valuationResult.finalSalary),
      ownerPerks: String(valuationResult.finalPerks),
      oneOffs: String(valuationResult.finalOneOffs),
      depreciation: String(valuationResult.finalDepreciation),
      interest: String(valuationResult.finalInterest),
      multipleAuto: false,
      multiple: Number(sdeMultiple),
      annualRevenue: String(stats.runRateRevenue),
      revenueMultiple: Number(revenueMultiple),
      dcfCashFlow: String(valuationResult.sde),
      dcfGrowth: Number(dcfGrowth),
      dcfDiscount: Number(dcfDiscount),
      dcfYears: Number(dcfYears),
      dcfTerminal: Number(sdeMultiple),
      assets: String(assets),
      liabilities: String(liabilities)
    };

    if (isDemo) {
      try {
        const localKey = `ig-${agencyId || 'guest'}-acq-evaluations`;
        let evals = [];
        try {
          const raw = localStorage.getItem(localKey);
          evals = raw ? JSON.parse(raw) : [];
        } catch (_) {}

        const id = matchingEval?.id || crypto.randomUUID();
        const original = evals.find(e => e.id === id) || {};
        
        const nextEval = {
          ...original,
          id,
          businessName: activeBiz.name,
          sector: activeBiz.sector || 'Services',
          date: original.date || new Date().toISOString().slice(0, 10),
          agencyId,
          valuation: valuationData,
          total: original.total || 50, // placeholder score
          savedAt: new Date().toISOString()
        };

        const nextEvals = evals.some(e => e.id === id) 
          ? evals.map(e => e.id === id ? nextEval : e)
          : [...evals, nextEval];

        localStorage.setItem(localKey, JSON.stringify(nextEvals));
        setEvaluations(nextEvals);
        toast.success("Settings Saved", `Valuation settings saved locally for "${activeBiz.name}".`);
      } catch (err) {
        toast.error("Save Failed", "Could not save valuation details.");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const sb = createClient();
      const id = matchingEval?.id || crypto.randomUUID();
      const original = matchingEval || {};
      
      const payload = {
        ...original,
        id,
        businessName: activeBiz.name,
        sector: activeBiz.sector || 'Services',
        date: original.date || new Date().toISOString().slice(0, 10),
        agencyId,
        valuation: valuationData,
        total: original.total || 50,
        savedAt: new Date().toISOString(),
        evaluator: original.evaluator || {
          id: userProfile?.id || null,
          name: userProfile?.full_name || userProfile?.email || 'System'
        }
      };

      const { error } = await sb.from('acquisition_evaluations').upsert({
        id,
        agency_id: agencyId,
        created_by: userProfile?.id || null,
        data: payload
      });

      if (error) throw error;

      // Update local state list
      setEvaluations(prev => {
        if (prev.some(e => e.id === id)) {
          return prev.map(e => e.id === id ? payload : e);
        } else {
          return [...prev, payload];
        }
      });

      toast.success("Settings Saved", `Valuation for "${activeBiz.name}" synced with the team.`);
    } catch (err) {
      console.error(err);
      toast.error("Save Failed", err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const cardStyle = { 
    background: 'var(--color-bg-elevated)', 
    border: '1px solid var(--color-border)', 
    borderRadius: 14,
    padding: 20
  };

  const inputStyle = {
    background: 'rgba(2, 4, 10, 0.4)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    padding: '8px 12px',
    fontSize: 13.5,
    outline: 'none',
    width: '100%',
    marginTop: 4,
    transition: 'border-color 150ms ease'
  };

  const labelStyle = { 
    fontSize: 11, 
    fontWeight: 700, 
    color: 'var(--color-text-tertiary)', 
    textTransform: 'uppercase', 
    letterSpacing: '.05em', 
    display: 'block' 
  };

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(224,72,90,0.12)', color: '#E0485A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Lock size={24} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Restricted</div>
        <div style={{ fontSize: 13 }}>Valuation calculations are available to managers and admins in ACR.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '14px 12px 60px' : '12px 16px 60px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(48,108,236,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B9BFF' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-.02em' }}>Business Valuation</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Calculate asset and earnings multiples of operational businesses from active logs</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="biz-btn ghost" onClick={() => setCurrentView('finance')}>
            <Wallet size={14} style={{ marginRight: 6 }} /> Daily Finance
          </button>
          
          <button className="biz-btn primary" onClick={handleSave} disabled={saving || !activeBiz}>
            {saving ? <RefreshCw size={14} className="animate-spin" style={{ marginRight: 6 }} /> : <Save size={14} style={{ marginRight: 6 }} />}
            Save Valuation
          </button>
        </div>
      </div>

      {/* Main Grid Selector & Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 16, marginBottom: 16 }}>
        
        {/* Sidebar Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <label style={labelStyle}>Select Business</label>
            <select 
              value={selectedBizId} 
              onChange={(e) => setSelectedBizId(e.target.value)} 
              style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? (
                <option>Loading businesses...</option>
              ) : businesses.length === 0 ? (
                <option value="">No businesses found</option>
              ) : (
                businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>

            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Extrapolation Period</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 6 }}>
                {[
                  { value: '30d', label: '30 Days' },
                  { value: '90d', label: '90 Days' },
                  { value: '12m', label: '12 Months' },
                  { value: 'all', label: 'All Time' }
                ].map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    style={{
                      background: period === p.value ? 'var(--color-bg-active)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${period === p.value ? 'var(--color-border-active)' : 'var(--color-border)'}`,
                      borderRadius: 8,
                      color: period === p.value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      padding: '8px 4px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 120ms ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {matchingEval && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Linked Evaluation Score:</span>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 700, 
                    color: matchingEval.total >= 75 ? '#16A36B' : matchingEval.total >= 50 ? '#F5A623' : '#E0485A',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>{matchingEval.total}/100</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Financial Performance Stats */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Database size={15} style={{ color: 'var(--color-text-secondary)' }} />
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>Operational Run Rates</h3>
            </div>
            
            {loadingLogs ? (
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                <RefreshCw size={16} className="animate-spin" style={{ marginRight: 8 }} /> Loading financial logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                <AlertCircle size={28} style={{ margin: '0 auto 8px', color: 'var(--color-warning)' }} />
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>No daily finance data found</div>
                <div style={{ fontSize: 11.5, marginTop: 2 }}>Create transaction entries on the Daily Finance page to see calculations.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Log Date Span</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>{stats.months} Months</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{filteredLogs.length} days logged</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Total Net Profit</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: stats.totalNetProfit >= 0 ? '#16A36B' : '#E0485A', marginTop: 4 }}>
                    {money(stats.totalNetProfit)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Revenue: {money(stats.totalRevenue)}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Annualized Revenue</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
                    {money(stats.runRateRevenue)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{stats.annualizedFactor === 1 ? 'Actual 12m sum' : `Projected (x${stats.annualizedFactor.toFixed(1)} run-rate)`}</div>
                </div>

                <div style={{ background: 'rgba(48,108,236,0.06)', padding: 12, borderRadius: 10, border: '1px solid rgba(48,108,236,0.15)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7EB3FF', textTransform: 'uppercase' }}>Annualized Net Profit</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#5B9BFF', marginTop: 4 }}>
                    {money(stats.runRateNet)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(91,155,255,0.6)', marginTop: 2 }}>Valuation baseline profit</div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main Body */}
      {filteredLogs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2.2fr', gap: 16 }}>
          
          {/* SDE Add-backs & Inputs (Left) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Auto-detected Add-backs Table */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckSquare size={16} style={{ color: 'var(--color-accent-secondary)' }} />
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>Potential Add-backs detected in Daily Finance</h3>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Toggled items will be annualized & added to SDE</span>
              </div>

              {stats.detectedItems.length === 0 ? (
                <div style={{ padding: '16px 8px', textStyle: 'center', fontSize: 12.5, color: 'var(--color-text-tertiary)', background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                  <Info size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  No matching SDE add-backs detected in transaction descriptions for this period. Add them manually below.
                </div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto', background: 'rgba(2, 4, 10, 0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <th style={{ padding: '8px 12px', width: 40 }}>Include</th>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Type</th>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.detectedItems.map(item => {
                        const isEnabled = enabledAddBacks[item.itemId] !== false;
                        return (
                          <tr 
                            key={item.itemId} 
                            onClick={() => toggleItem(item.itemId)}
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.03)', 
                              cursor: 'pointer',
                              background: isEnabled ? 'rgba(48,108,236,0.03)' : 'transparent',
                              transition: 'background 100ms ease'
                            }}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {isEnabled ? (
                                <CheckSquare size={15} style={{ color: 'var(--color-accent-secondary)' }} />
                              ) : (
                                <div style={{ width: 15, height: 15, border: '1px solid var(--color-border)', borderRadius: 3 }} />
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{item.date}</td>
                            <td style={{ padding: '10px 12px', textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{item.type}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>{item.what}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#5B9BFF' }}>{money(item.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Manual SDE Overrides Form */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sliders size={16} style={{ color: 'var(--color-accent-secondary)' }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>SDE Add-backs & Multiple Adjustment</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>
                    Owner's Salary
                    <span style={{ fontSize: 9.5, float: 'right', color: 'var(--color-text-muted)' }}>
                      Detected: {money(valuationResult.annualizedSalaryAddBack)}/yr
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={money(valuationResult.annualizedSalaryAddBack)}
                    value={manualSalary}
                    onChange={(e) => setManualSalary(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Owner's Perks
                    <span style={{ fontSize: 9.5, float: 'right', color: 'var(--color-text-muted)' }}>
                      Detected: {money(valuationResult.annualizedPerksAddBack)}/yr
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={money(valuationResult.annualizedPerksAddBack)}
                    value={manualPerks}
                    onChange={(e) => setManualPerks(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    One-off Costs
                    <span style={{ fontSize: 9.5, float: 'right', color: 'var(--color-text-muted)' }}>
                      Detected: {money(valuationResult.annualizedOneOffsAddBack)}/yr
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={money(valuationResult.annualizedOneOffsAddBack)}
                    value={manualOneOffs}
                    onChange={(e) => setManualOneOffs(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Depreciation (D&A)
                    <span style={{ fontSize: 9.5, float: 'right', color: 'var(--color-text-muted)' }}>
                      Detected: {money(valuationResult.annualizedDepreciationAddBack)}/yr
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={money(valuationResult.annualizedDepreciationAddBack)}
                    value={manualDepreciation}
                    onChange={(e) => setManualDepreciation(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Interest Paid
                    <span style={{ fontSize: 9.5, float: 'right', color: 'var(--color-text-muted)' }}>
                      Detected: {money(valuationResult.annualizedInterestAddBack)}/yr
                    </span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={money(valuationResult.annualizedInterestAddBack)}
                    value={manualInterest}
                    onChange={(e) => setManualInterest(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={labelStyle}>SDE Multiple</label>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-accent-secondary)' }}>{sdeMultiple}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="1.0" 
                    max="5.0" 
                    step="0.1"
                    value={sdeMultiple}
                    onChange={(e) => setSdeMultiple(e.target.value)}
                    style={{ width: '100%', marginTop: 10, accentColor: 'var(--color-accent-primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    <span>1.0x (Low)</span>
                    <span>3.0x (SME Avg)</span>
                    <span>5.0x (High)</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(48,108,236,0.04)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Seller's Discretionary Earnings (SDE)</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>Annualized Net Profit + Total SDE Add-backs</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#5B9BFF' }}>
                    {money(valuationResult.sde)}
                  </div>
                </div>
              </div>

            </div>

            {/* Other Valuation Approach Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              
              {/* Market Approach & DCF */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>DCF & Market Inputs</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Revenue Multiple</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0.1"
                        value={revenueMultiple}
                        onChange={(e) => setRevenueMultiple(e.target.value)}
                        style={inputStyle}
                      />
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>x</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Growth Rate (%)</label>
                      <input 
                        type="number" 
                        value={dcfGrowth}
                        onChange={(e) => setDcfGrowth(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Discount Rate (%)</label>
                      <input 
                        type="number" 
                        value={dcfDiscount}
                        onChange={(e) => setDcfDiscount(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Asset Approach */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>Asset Approach</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Total Assets Value</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 5,000,000"
                      value={assets}
                      onChange={(e) => setAssets(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Liabilities</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1,200,000"
                      value={liabilities}
                      onChange={(e) => setLiabilities(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Valuation Outputs (Right) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Main Valuation Result Card */}
            <div style={{ 
              ...cardStyle, 
              background: 'linear-gradient(135deg, rgba(48,108,236,0.15) 0%, rgba(13,27,56,0.85) 100%)',
              border: '1px solid rgba(48,108,236,0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                position: 'absolute', width: 120, height: 120, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(91,155,255,0.2) 0%, transparent 70%)',
                top: -40, right: -40, pointerEvents: 'none'
              }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <TrendingUp size={16} style={{ color: '#5B9BFF' }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7EB3FF', textTransform: 'uppercase', letterSpacing: '.05em' }}>Recommended Business Worth</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#E2EEFF', letterSpacing: '-.02em', margin: '4px 0 8px' }}>
                {money(valuationResult.recommended)}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Based on SDE multiple method with Net Assets as a floor. Best representation for owner-run operations.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Target Offer Range</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>
                    {money(valuationResult.offerLow)} – {money(valuationResult.offerHigh)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Implied Payback</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>
                    {valuationResult.paybackMonths > 0 ? `${valuationResult.paybackMonths} Months (${(valuationResult.paybackMonths / 12).toFixed(1)} yrs)` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Valuation Methods Comparison Card */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>Valuation Methods Breakdown</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {valuationResult.methods.map(m => {
                  const isRec = (m.key === 'earnings' && valuationResult.recommended === m.value) || 
                                (m.key === 'asset' && valuationResult.recommended === m.value && valuationResult.recommended === valuationResult.netAssetWorth);
                  const pctOfMax = valuationResult.rangeHigh > 0 ? (m.value / valuationResult.rangeHigh) * 100 : 0;
                  
                  return (
                    <div key={m.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ 
                          fontWeight: isRec ? 700 : 500, 
                          color: isRec ? '#E2EEFF' : 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {m.label}
                          {isRec && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(48,108,236,0.2)', color: '#7EB3FF', padding: '1px 5px', borderRadius: 4 }}>REC</span>}
                        </span>
                        <span style={{ fontWeight: 700, color: m.value > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                          {m.value > 0 ? money(m.value) : 'Not configured'}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${pctOfMax}%`, 
                          height: '100%', 
                          background: isRec ? 'var(--color-accent-gradient)' : 'rgba(255,255,255,0.08)',
                          borderRadius: 3,
                          transition: 'width 200ms ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Range Viz Bar */}
            {valuationResult.rangeHigh > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>Valuation Range</h3>
                <div style={{ position: 'relative', height: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--color-border)', overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ 
                    position: 'absolute',
                    left: `${((valuationResult.rangeLow - valuationResult.rangeLow) / valuationResult.rangeHigh) * 100}%`,
                    right: `${(1 - (valuationResult.rangeHigh / valuationResult.rangeHigh)) * 100}%`,
                    height: '100%',
                    background: 'rgba(48,108,236,0.12)'
                  }} />
                  
                  {/* Recommended line */}
                  <div style={{
                    position: 'absolute',
                    left: `${(valuationResult.recommended / valuationResult.rangeHigh) * 100}%`,
                    top: 0,
                    width: 3,
                    height: '100%',
                    background: 'var(--color-accent-primary-hover)',
                    boxShadow: '0 0 8px var(--color-accent-primary-hover)'
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  <span>Low: {money(valuationResult.rangeLow)}</span>
                  <span>High: {money(valuationResult.rangeHigh)}</span>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
