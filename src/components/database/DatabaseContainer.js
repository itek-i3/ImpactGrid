'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Columns3,
  Calendar,
  List,
  Plus,
  Filter,
  ArrowUpDown,
  Search,
  X,
  LayoutDashboard,
  Clock,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import TableView from './views/TableView';
import KanbanView from './views/KanbanView';
import CalendarView from './views/CalendarView';
import ListView from './views/ListView';
import TimelineView from './views/TimelineView';
import ChartView from './views/ChartView';
import DatabaseDashboardComponent from './views/DatabaseDashboard';
import styles from '@/styles/database.module.css';
import communityStyles from '@/styles/community.module.css';

const VIEW_ICONS = {
  dashboard: <LayoutDashboard size={14} />,
  table: <Table size={14} />,
  kanban: <Columns3 size={14} />,
  calendar: <Calendar size={14} />,
  timeline: <Clock size={14} />,
  list: <List size={14} />,
  chart: <BarChart3 size={14} />,
};

const VIEW_COMPONENTS = {
  dashboard: DatabaseDashboardComponent,
  table: TableView,
  kanban: KanbanView,
  calendar: CalendarView,
  timeline: TimelineView,
  list: ListView,
  chart: ChartView,
};

const VIEW_TYPES = [
  { type: 'dashboard', label: 'Dashboard' },
  { type: 'table', label: 'Table' },
  { type: 'kanban', label: 'Board' },
  { type: 'calendar', label: 'Calendar' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'list', label: 'List' },
  { type: 'chart', label: 'Chart' },
];

/**
 * DatabaseContainer — wraps a database page with view switcher tabs,
 * filter/sort toolbar, search, and the active view component.
 */
export default function DatabaseContainer({ pageId, readOnly = false }) {
  const {
    database,
    views,
    activeViewId,
    setActiveViewId,
    addView,
    filters,
    sorts,
    searchQuery,
    setSearchQuery,
    removeFilter,
    removeSort,
    initDemoDatabase,
    properties,
    addFilter,
  } = useDatabaseStore();

  const workspace = useWorkspaceStore((state) => state.workspace);

  const [showNewViewMenu, setShowNewViewMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Initialize demo database if not already loaded
  useEffect(() => {
    if (!database || database.pageId !== pageId) {
      initDemoDatabase(pageId);
    }
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Authorization Check:
  // In demo mode (path starts with /demo) or if roles are undefined, the user defaults to owner (admin)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
  const userRole = workspace?.workspace_members?.[0]?.role;
  const isAuthorized = isDemo || !database || database.type !== 'agencies' || userRole === 'owner';

  if (!isAuthorized) {
    return (
      <div className={styles.dbContainer}>
        <div className={communityStyles.shieldContainer}>
          <div className={communityStyles.shieldIconWrapper}>
            <ShieldAlert size={40} />
          </div>
          <h2 className={communityStyles.shieldTitle}>Access Restricted</h2>
          <p className={communityStyles.shieldDesc}>
            Only workspace administrators (owners) have permissions to view and modify agency dashboards.
            Please contact your system administrator if you require access.
          </p>
        </div>
      </div>
    );
  }

  const activeView = views.find((v) => v.id === activeViewId) || views[0];
  const ViewComponent = activeView ? VIEW_COMPONENTS[activeView.type] : null;

  const handleAddView = useCallback(
    (type) => {
      const label = VIEW_TYPES.find((v) => v.type === type)?.label || type;
      addView({
        name: `${label} View`,
        type,
        config: type === 'kanban'
          ? { groupByPropertyId: properties.find((p) => p.type === 'select')?.id }
          : {},
      });
      setShowNewViewMenu(false);
    },
    [addView, properties]
  );

  const handleAddFilter = useCallback(
    (propId) => {
      addFilter({ propertyId: propId, operator: 'contains', value: '' });
      setShowFilterMenu(false);
    },
    [addFilter]
  );

  return (
    <div className={styles.dbContainer}>
      {/* View Switcher Tabs */}
      <div className={styles.viewTabs}>
        {views.map((view) => (
          <button
            key={view.id}
            className={`${styles.viewTab} ${
              view.id === activeViewId ? styles.viewTabActive : ''
            }`}
            onClick={() => setActiveViewId(view.id)}
          >
            {VIEW_ICONS[view.type]}
            {view.name}
          </button>
        ))}

        {!readOnly && (
          <div style={{ position: 'relative' }}>
            <button
              className={`${styles.viewTab} ${styles.viewTabAdd}`}
              onClick={() => setShowNewViewMenu(!showNewViewMenu)}
            >
              <Plus size={14} />
            </button>

            {showNewViewMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 'var(--space-1)',
                  zIndex: 'var(--z-popover)',
                  minWidth: '160px',
                  animation: 'fadeInDown 0.12s ease forwards',
                }}
              >
                {VIEW_TYPES.map((vt) => (
                  <button
                    key={vt.type}
                    className={styles.cellSelectOption}
                    onClick={() => handleAddView(vt.type)}
                  >
                    {VIEW_ICONS[vt.type]}
                    {vt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar: Filter, Sort, Search */}
      <div className={styles.dbToolbar}>
        {/* Filter button */}
        <div style={{ position: 'relative' }}>
          <button
            className={`${styles.dbToolbarBtn} ${
              filters.length > 0 ? styles.dbToolbarBtnActive : ''
            }`}
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            <Filter size={12} />
            Filter
            {filters.length > 0 && (
              <span style={{ marginLeft: '4px' }}>({filters.length})</span>
            )}
          </button>

          {showFilterMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-1)',
                zIndex: 'var(--z-popover)',
                minWidth: '180px',
                animation: 'fadeInDown 0.12s ease forwards',
              }}
            >
              <div style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                fontWeight: 'var(--font-semibold)',
              }}>
                Add filter by
              </div>
              {properties.map((prop) => (
                <button
                  key={prop.id}
                  className={styles.cellSelectOption}
                  onClick={() => handleAddFilter(prop.id)}
                >
                  {prop.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort button */}
        <button
          className={`${styles.dbToolbarBtn} ${
            sorts.length > 0 ? styles.dbToolbarBtnActive : ''
          }`}
          onClick={() => {
            if (sorts.length === 0 && properties.length > 0) {
              useDatabaseStore.getState().addSort({
                propertyId: properties[0].id,
                direction: 'asc',
              });
            }
          }}
        >
          <ArrowUpDown size={12} />
          Sort
          {sorts.length > 0 && (
            <span style={{ marginLeft: '4px' }}>({sorts.length})</span>
          )}
        </button>

        {/* Active filters display */}
        {filters.map((filter) => {
          const prop = properties.find((p) => p.id === filter.propertyId);
          return (
            <span
              key={filter.id}
              className={styles.dbToolbarBtn}
              style={{ gap: '6px' }}
            >
              <span style={{ fontWeight: 'var(--font-medium)' }}>{prop?.name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{filter.operator.replace('_', ' ')}</span>
              <input
                type="text"
                value={filter.value}
                onChange={(e) => {
                  useDatabaseStore.getState().setFilters(
                    filters.map((f) =>
                      f.id === filter.id ? { ...f, value: e.target.value } : f
                    )
                  );
                }}
                placeholder="value..."
                style={{
                  width: '80px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-xs)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => removeFilter(filter.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}

        {/* Active sorts display */}
        {sorts.map((sort) => {
          const prop = properties.find((p) => p.id === sort.propertyId);
          return (
            <span
              key={sort.id}
              className={styles.dbToolbarBtn}
              style={{ gap: '6px' }}
            >
              <ArrowUpDown size={10} />
              <span style={{ fontWeight: 'var(--font-medium)' }}>{prop?.name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{sort.direction}</span>
              <button
                onClick={() => removeSort(sort.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}

        {/* Search */}
        <input
          className={styles.dbSearchInput}
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Active View */}
      {ViewComponent ? (
        <ViewComponent readOnly={readOnly} />
      ) : (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No view selected.
        </div>
      )}
    </div>
  );
}
