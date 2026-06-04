'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users2,
  DollarSign,
  Award,
  Target,
  TrendingUp,
  Lightbulb,
  Landmark,
  CheckCircle,
  Plus,
  Trash2,
  X,
  AlertCircle,
  ShieldAlert,
  Briefcase,
  Calendar,
  ChevronRight,
  Phone,
  Mail,
  User,
  PlusCircle,
  ArrowRightLeft
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import styles from '@/styles/community.module.css';

export default function AgencyDetailDashboard({ pageId }) {
  const {
    cacheByPageId,
    initDemoDatabase,
    updateCachedCell,
    addCachedRow,
    deleteCachedRow
  } = useDatabaseStore();

  const { workspace, pages } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Load and cache databases if not initialized
  useEffect(() => {
    if (!cacheByPageId['toig-hq-database-page-id']) {
      initDemoDatabase('toig-hq-database-page-id');
    }
    if (!cacheByPageId['project-tracker-database-page-id']) {
      initDemoDatabase('project-tracker-database-page-id');
    }
  }, [cacheByPageId, initDemoDatabase]);

  const agenciesDb = cacheByPageId['toig-hq-database-page-id'];
  const tasksDb = cacheByPageId['project-tracker-database-page-id'];

  const currentPage = pages.find((p) => p.id === pageId);
  const agencyName = currentPage?.title || '';

  // Get properties and find the row for this agency in the agencies database
  const agencyProps = agenciesDb?.properties || [];
  const agencyRow = agenciesDb?.rows?.find(
    (row) => {
      const nameProp = agencyProps.find((p) => p.name === 'Name');
      return nameProp ? row.cells[nameProp.id] === agencyName : false;
    }
  );

  const getPropId = (propName) => {
    return agencyProps.find((p) => p.name === propName)?.id;
  };

  const getVal = (propName) => {
    if (!agencyRow) return null;
    const propId = getPropId(propName);
    return propId ? agencyRow.cells[propId] : null;
  };

  // Local state for all fields to prevent loss of focus or cursor jumps on keystroke
  const [goals, setGoals] = useState('');
  const [goalRev, setGoalRev] = useState(0);
  const [actualRev, setActualRev] = useState(0);
  const [expenditure, setExpenditure] = useState(0);
  const [lossOrigin, setLossOrigin] = useState('');
  const [revenueModel, setRevenueModel] = useState('');
  const [growthModels, setGrowthModels] = useState('');
  const [innovationBox, setInnovationBox] = useState('');
  const [rateCard, setRateCard] = useState([]);

  const [lead, setLead] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');

  // Synchronize local states when the agency row is loaded or updated
  useEffect(() => {
    if (agencyRow) {
      setGoals(getVal('Goals') || '');
      setGoalRev(Number(getVal('Goal Revenue/Month') || 0));
      setActualRev(Number(getVal('Actual Revenue/Month') || 0));
      setExpenditure(Number(getVal('Expenditure') || 0));
      setLossOrigin(getVal('Loss Origin') || '');
      setRevenueModel(getVal('Revenue Model') || '');
      setGrowthModels(getVal('Growth Models') || '');
      setInnovationBox(getVal('Innovation Box') || '');

      setLead(getVal('Contact Person') || '');
      setEmail(getVal('Email') || '');
      setPhone(getVal('Phone') || '');
      setStatus(getVal('Status') || 'Active');

      let rc = [];
      try {
        const rcStr = getVal('Rate Card');
        if (rcStr) {
          rc = JSON.parse(rcStr);
        }
      } catch (e) {
        console.error('Failed to parse rate card:', e);
      }
      setRateCard(rc);
    }
  }, [agencyRow?.id, agenciesDb]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to commit local changes to database store
  const handleBlurField = (fieldName, val) => {
    if (!agencyRow) return;
    const propId = getPropId(fieldName);
    if (propId) {
      updateCachedCell('toig-hq-database-page-id', agencyRow.id, propId, val);
      
      // If we are updating actual revenue, we should also update the "Revenue Generated" field
      if (fieldName === 'Actual Revenue/Month') {
        const revGeneratedPropId = getPropId('Revenue Generated');
        if (revGeneratedPropId) {
          updateCachedCell('toig-hq-database-page-id', agencyRow.id, revGeneratedPropId, Number(val));
        }
      }
    }
  };

  const handleUpdateRateCard = (newRateCard) => {
    setRateCard(newRateCard);
    if (agencyRow) {
      const propId = getPropId('Rate Card');
      if (propId) {
        updateCachedCell('toig-hq-database-page-id', agencyRow.id, propId, JSON.stringify(newRateCard));
      }
    }
  };

  // Add item to rate card
  const addRateCardItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      service: 'Consulting Service',
      rate: 100,
      quantity: 10,
      total: 1000,
      owed: 500,
    };
    const updated = [...rateCard, newItem];
    handleUpdateRateCard(updated);
  };

  // Update item in rate card
  const updateRateCardItem = (itemId, key, val) => {
    const updated = rateCard.map((item) => {
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

  // Delete item from rate card
  const deleteRateCardItem = (itemId) => {
    const updated = rateCard.filter((item) => item.id !== itemId);
    handleUpdateRateCard(updated);
  };

  // Authorization Check
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
  const userRole = workspace?.workspace_members?.[0]?.role;
  const isAuthorized = isDemo || userRole === 'owner';

  if (!isAuthorized) {
    return (
      <div className={styles.shieldContainer} style={{ margin: 'var(--space-6) 0' }}>
        <div className={styles.shieldIconWrapper}>
          <ShieldAlert size={40} />
        </div>
        <h2 className={styles.shieldTitle}>Access Restricted</h2>
        <p className={styles.shieldDesc}>
          Only workspace owners/administrators have permissions to view and modify agency detail dashboards.
        </p>
      </div>
    );
  }

  if (!agencyRow) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed var(--color-border)',
          margin: 'var(--space-6) 0'
        }}
      >
        <Building2 size={32} style={{ margin: '0 auto var(--space-4) auto', opacity: 0.5 }} />
        <h3>Agency Not Found</h3>
        <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
          The agency "{agencyName}" could not be loaded from the main TOIG HQ database list. Please verify its name matches.
        </p>
      </div>
    );
  }

  // ── Retrieve & Filter Tasks ──
  const tasksProps = tasksDb?.properties || [];
  const taskRows = tasksDb?.rows || [];

  const getTaskPropId = (propName) => tasksProps.find((p) => p.name === propName)?.id;

  const filteredTasks = taskRows.filter((row) => {
    const agencyPropId = getTaskPropId('Agency');
    return agencyPropId ? row.cells[agencyPropId] === agencyName : false;
  });

  // Calculate project metrics
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((row) => {
    const statusPropId = getTaskPropId('Status');
    return statusPropId ? row.cells[statusPropId] === 'Completed' : false;
  }).length;

  const taskProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Add a task pre-assigned to this agency
  const handleAddTask = () => {
    const namePropId = getTaskPropId('Name');
    const statusPropId = getTaskPropId('Status');
    const priorityPropId = getTaskPropId('Priority');
    const agencyPropId = getTaskPropId('Agency');

    const newCells = {};
    tasksProps.forEach((p) => {
      newCells[p.id] = '';
    });

    if (namePropId) newCells[namePropId] = 'New Custom Agency Task';
    if (statusPropId) newCells[statusPropId] = 'Not Started';
    if (priorityPropId) newCells[priorityPropId] = 'Medium';
    if (agencyPropId) newCells[agencyPropId] = agencyName;

    addCachedRow('project-tracker-database-page-id', { cells: newCells });
    
    // Also increment project count in agencies database
    const totalProjectsPropId = getPropId('Total Projects');
    if (totalProjectsPropId) {
      const currentProjCount = Number(getVal('Total Projects') || 0);
      updateCachedCell('toig-hq-database-page-id', agencyRow.id, totalProjectsPropId, currentProjCount + 1);
    }
  };

  const handleDeleteTask = (rowId) => {
    deleteCachedRow('project-tracker-database-page-id', rowId);

    // Decrement project count in agencies database
    const totalProjectsPropId = getPropId('Total Projects');
    if (totalProjectsPropId) {
      const currentProjCount = Number(getVal('Total Projects') || 0);
      updateCachedCell('toig-hq-database-page-id', agencyRow.id, totalProjectsPropId, Math.max(0, currentProjCount - 1));
    }
  };

  const handleUpdateTaskCell = (rowId, propName, value) => {
    const propId = getTaskPropId(propName);
    if (propId) {
      updateCachedCell('project-tracker-database-page-id', rowId, propId, value);
    }
  };

  // Financial Calculations
  const netMargin = actualRev - expenditure;
  const isLoss = goalRev > actualRev;
  const deficitValue = isLoss ? goalRev - actualRev : 0;

  return (
    <div className={styles.agencyDetailDashboard}>
      {/* ── Sub-page Profile Header ── */}
      <div className={styles.agencyDetailHeader}>
        <div className={styles.agencyDetailHeaderMain}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className={styles.agencyDetailTitle}>{agencyName} Dashboard</span>
              <span
                className={styles.selectBadge}
                style={{
                  background: status === 'Active' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                  color: status === 'Active' ? '#34d399' : '#fbbf24',
                  fontSize: 'var(--text-xs)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {status}
              </span>
            </div>
            <p className={styles.agencyDetailHeaderSubtitle}>
              TOIG HQ Agency &bull; Custom Workspace Hub
            </p>
          </div>
        </div>

        {/* Quick Contacts Panel */}
        <div className={styles.quickContactCard}>
          <div className={styles.contactItem}>
            <User size={12} className={styles.contactIcon} />
            <input
              className={styles.contactInput}
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              onBlur={() => handleBlurField('Contact Person', lead)}
              placeholder="Leader Name"
            />
          </div>
          <div className={styles.contactItem}>
            <Mail size={12} className={styles.contactIcon} />
            <input
              className={styles.contactInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlurField('Email', email)}
              placeholder="Email Address"
            />
          </div>
          <div className={styles.contactItem}>
            <Phone size={12} className={styles.contactIcon} />
            <input
              className={styles.contactInput}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => handleBlurField('Phone', phone)}
              placeholder="Phone Number"
            />
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.tabButtonActive : ''}`}
        >
          <Target size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Objectives & Goals
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.tabButtonActive : ''}`}
        >
          <Briefcase size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Projects & Tasks ({totalTasks})
        </button>
        <button
          onClick={() => setActiveTab('financials')}
          className={`${styles.tabButton} ${activeTab === 'financials' ? styles.tabButtonActive : ''}`}
        >
          <DollarSign size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Finances & Rate Card
        </button>
      </div>

      {/* ── Tab Panels ── */}
      <div className={styles.tabPanel}>
        {/* TAB 1: OVERVIEW & GOALS */}
        {activeTab === 'overview' && (
          <div className={styles.agencyDetailOverview}>
            <div className={styles.overviewGrid}>
              {/* Goals Card */}
              <div className={styles.detailCard}>
                <div className={styles.detailCardHeader}>
                  <Target size={16} className={styles.detailCardHeaderIcon} style={{ color: '#fbbf24' }} />
                  <span className={styles.detailCardTitle}>Goals & Key Objectives</span>
                </div>
                <textarea
                  className={styles.detailTextarea}
                  placeholder="What is this agency working towards? E.g. Deliver client onboarding portal..."
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  onBlur={() => handleBlurField('Goals', goals)}
                />
              </div>

              {/* Growth Models Card */}
              <div className={styles.detailCard}>
                <div className={styles.detailCardHeader}>
                  <TrendingUp size={16} className={styles.detailCardHeaderIcon} style={{ color: '#34d399' }} />
                  <span className={styles.detailCardTitle}>Growth Models & Scale Strategy</span>
                </div>
                <textarea
                  className={styles.detailTextarea}
                  placeholder="Outline plans for expanding operations, scaling staffing, or increasing customer capture..."
                  value={growthModels}
                  onChange={(e) => setGrowthModels(e.target.value)}
                  onBlur={() => handleBlurField('Growth Models', growthModels)}
                />
              </div>

              {/* Innovation Box Card */}
              <div className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                <div className={styles.detailCardHeader}>
                  <Lightbulb size={16} className={styles.detailCardHeaderIcon} style={{ color: '#a78bfa' }} />
                  <span className={styles.detailCardTitle}>Innovation Box & Prototypes</span>
                </div>
                <textarea
                  className={styles.detailTextarea}
                  placeholder="List new ideas, internal experiments, R&D initiatives, or technological breakthroughs..."
                  value={innovationBox}
                  onChange={(e) => setInnovationBox(e.target.value)}
                  onBlur={() => handleBlurField('Innovation Box', innovationBox)}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TASKS BOARD */}
        {activeTab === 'tasks' && (
          <div className={styles.agencyDetailTasks}>
            <div className={styles.tasksSectionHeader}>
              <div>
                <span className={styles.detailCardTitle} style={{ fontSize: 'var(--text-base)' }}>
                  Active Tasks assigned to {agencyName}
                </span>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Weekly tasks distributed to members. Project Completion: {taskProgress}%
                </p>
              </div>
              <button onClick={handleAddTask} className={styles.addTaskBtn}>
                <Plus size={14} /> Add Task
              </button>
            </div>

            {/* Progress Bar */}
            <div className={styles.progressContainer} style={{ margin: 'var(--space-3) 0 var(--space-4) 0', height: '6px' }}>
              <div className={styles.progressFill} style={{ width: `${taskProgress}%` }} />
            </div>

            {/* Tasks List */}
            <div className={styles.tasksListContainer}>
              {filteredTasks.length > 0 ? (
                <div className={styles.tasksTableWrapper}>
                  <table className={styles.tasksTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Task Name</th>
                        <th style={{ width: '18%' }}>Status</th>
                        <th style={{ width: '18%' }}>Priority</th>
                        <th style={{ width: '18%' }}>Assignee</th>
                        <th style={{ width: '6%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const nameVal = task.cells[getTaskPropId('Name')] || '';
                        const statusVal = task.cells[getTaskPropId('Status')] || 'Not Started';
                        const priorityVal = task.cells[getTaskPropId('Priority')] || 'Medium';
                        const assigneeVal = task.cells[getTaskPropId('Assignee')] || '';

                        return (
                          <tr key={task.id} className={styles.taskTableRow}>
                            <td>
                              <input
                                className={styles.taskTableInput}
                                value={nameVal}
                                onChange={(e) => handleUpdateTaskCell(task.id, 'Name', e.target.value)}
                                placeholder="Task description..."
                              />
                            </td>
                            <td>
                              <select
                                className={styles.taskTableSelect}
                                value={statusVal}
                                onChange={(e) => handleUpdateTaskCell(task.id, 'Status', e.target.value)}
                              >
                                <option value="Not Started">Not Started</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Blocked">Blocked</option>
                              </select>
                            </td>
                            <td>
                              <select
                                className={styles.taskTableSelect}
                                value={priorityVal}
                                onChange={(e) => handleUpdateTaskCell(task.id, 'Priority', e.target.value)}
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className={styles.taskTableInput}
                                value={assigneeVal}
                                onChange={(e) => handleUpdateTaskCell(task.id, 'Assignee', e.target.value)}
                                placeholder="Assignee"
                              />
                            </td>
                            <td>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className={styles.taskDeleteButton}
                                title="Delete task"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-xs)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  No tasks assigned. Click "Add Task" to assign one!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIAL TRACKING */}
        {activeTab === 'financials' && (
          <div className={styles.agencyDetailFinance}>
            {/* KPI Metrics Row */}
            <div className={styles.financeKpiGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div className={styles.financeWidgetCard}>
                <span className={styles.financeWidgetLabel}>Goal Rev / Month</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input
                    type="number"
                    className={styles.financeInputInline}
                    value={goalRev}
                    onChange={(e) => setGoalRev(Number(e.target.value))}
                    onBlur={() => handleBlurField('Goal Revenue/Month', goalRev)}
                  />
                </div>
              </div>

              <div className={styles.financeWidgetCard}>
                <span className={styles.financeWidgetLabel}>Actual Rev / Month</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input
                    type="number"
                    className={styles.financeInputInline}
                    value={actualRev}
                    onChange={(e) => setActualRev(Number(e.target.value))}
                    onBlur={() => handleBlurField('Actual Revenue/Month', actualRev)}
                  />
                </div>
              </div>

              <div className={styles.financeWidgetCard}>
                <span className={styles.financeWidgetLabel}>Expenditure</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>$</span>
                  <input
                    type="number"
                    className={styles.financeInputInline}
                    value={expenditure}
                    onChange={(e) => setExpenditure(Number(e.target.value))}
                    onBlur={() => handleBlurField('Expenditure', expenditure)}
                  />
                </div>
              </div>

              <div className={styles.financeWidgetCard}>
                <span className={styles.financeWidgetLabel}>Net Margin</span>
                <span
                  className={`${styles.financeWidgetValue} ${
                    netMargin >= 0 ? styles.financeWidgetValuePositive : styles.financeWidgetValueNegative
                  }`}
                  style={{ marginTop: '4px' }}
                >
                  ${netMargin.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Deficit Alert Warning Box */}
            {isLoss && (
              <div className={styles.lossAnalysisBox} style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertCircle size={14} style={{ color: '#ef4444' }} />
                  <span className={styles.lossAnalysisTitle}>
                    Monthly Revenue Deficit: ${deficitValue.toLocaleString()}
                  </span>
                </div>
                <p className={styles.lossAnalysisText} style={{ margin: '4px 0 8px 0' }}>
                  The actual revenue fell short of the goal revenue this month. Please specify where this deficit originated for administrative tracking:
                </p>
                <textarea
                  className={styles.lossTextarea}
                  value={lossOrigin}
                  onChange={(e) => setLossOrigin(e.target.value)}
                  onBlur={() => handleBlurField('Loss Origin', lossOrigin)}
                  placeholder="Explain loss factors (e.g. cloud scaling adjustments, delayed invoice clearance, contract signing lag...)"
                />
              </div>
            )}

            {/* Revenue Models Tracker */}
            <div className={styles.detailCard} style={{ marginBottom: 'var(--space-4)' }}>
              <div className={styles.detailCardHeader}>
                <Landmark size={16} className={styles.detailCardHeaderIcon} style={{ color: '#60a5fa' }} />
                <span className={styles.detailCardTitle}>Revenue Tracking & Billing Model</span>
              </div>
              <div className={styles.drawerInputGroup} style={{ marginTop: '2px' }}>
                <input
                  className={styles.revenueModelInput}
                  value={revenueModel}
                  onChange={(e) => setRevenueModel(e.target.value)}
                  onBlur={() => handleBlurField('Revenue Model', revenueModel)}
                  placeholder="E.g. Monthly Retainer, Milestone Commission, Performance Interest pool..."
                />
              </div>
            </div>

            {/* Rate Cards Interactive Subtable */}
            <div className={styles.detailCard}>
              <div className={styles.detailCardHeader} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ArrowRightLeft size={16} className={styles.detailCardHeaderIcon} style={{ color: '#10b981' }} />
                  <span className={styles.detailCardTitle}>Rate Cards & Services Rendered</span>
                </div>
                <button onClick={addRateCardItem} className={styles.addRateCardItemBtn}>
                  <PlusCircle size={12} /> Add Item
                </button>
              </div>

              <div className={styles.rateCardTableContainer} style={{ marginTop: 'var(--space-3)' }}>
                {rateCard.length > 0 ? (
                  <table className={styles.rateCardTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Service Description</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Rate/Hr</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Hours</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Amount Owed</th>
                        <th style={{ width: '4%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateCard.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              className={styles.rateCardInput}
                              value={item.service}
                              onChange={(e) => updateRateCardItem(item.id, 'service', e.target.value)}
                              placeholder="Service description"
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <span>$</span>
                              <input
                                type="number"
                                className={styles.rateCardInput}
                                style={{ textAlign: 'right', width: '60px' }}
                                value={item.rate}
                                onChange={(e) => updateRateCardItem(item.id, 'rate', e.target.value)}
                              />
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              className={styles.rateCardInput}
                              style={{ textAlign: 'right', width: '60px' }}
                              value={item.quantity}
                              onChange={(e) => updateRateCardItem(item.id, 'quantity', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            ${item.total.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <span>$</span>
                              <input
                                type="number"
                                className={styles.rateCardInput}
                                style={{ textAlign: 'right', width: '70px', fontWeight: '500', color: '#fbbf24' }}
                                value={item.owed}
                                onChange={(e) => updateRateCardItem(item.id, 'owed', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => deleteRateCardItem(item.id)}
                              className={styles.rateCardDeleteBtn}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      padding: 'var(--space-6)',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)'
                    }}
                  >
                    No services logged. Click "Add Item" to add rate cards.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
