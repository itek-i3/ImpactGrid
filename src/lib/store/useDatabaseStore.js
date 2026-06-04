'use client';

import { create } from 'zustand';
import { useWorkspaceStore } from './useWorkspaceStore';

/**
 * Database store — manages database state: properties, rows, cells, views.
 * Mirrors the Supabase schema but operates in-memory for demo mode.
 */
// Helper to save current database state into cache
const saveToCache = (state) => {
  const pageId = state.database?.pageId;
  if (!pageId) return {};
  return {
    cacheByPageId: {
      ...state.cacheByPageId,
      [pageId]: {
        database: state.database,
        properties: state.properties,
        rows: state.rows,
        views: state.views,
        activeViewId: state.activeViewId,
      }
    }
  };
};

export const useDatabaseStore = create((set, get) => ({
  // Cache of databases by pageId
  cacheByPageId: {},

  // Current active database
  database: null,
  properties: [],
  rows: [],
  views: [],
  activeViewId: null,

  // Filters and sorts
  filters: [],
  sorts: [],
  searchQuery: '',

  // UI
  isLoading: false,
  editingCell: null, // { rowId, propertyId }

  // ── Actions ──

  setDatabase: (database) => set((state) => {
    const nextState = { ...state, database };
    return { database, ...saveToCache(nextState) };
  }),

  // ── Properties (columns) ──

  setProperties: (properties) => set((state) => {
    const nextState = { ...state, properties };
    return { properties, ...saveToCache(nextState) };
  }),

  addProperty: (property) =>
    set((state) => {
      const nextProps = [
        ...state.properties,
        {
          id: property.id || crypto.randomUUID(),
          name: property.name || 'New Property',
          type: property.type || 'text',
          config: property.config || {},
          sortOrder: state.properties.length,
          ...property,
        },
      ];
      const nextState = { ...state, properties: nextProps };
      return {
        properties: nextProps,
        ...saveToCache(nextState),
      };
    }),

  updateProperty: (propertyId, updates) =>
    set((state) => {
      const nextProps = state.properties.map((p) =>
        p.id === propertyId ? { ...p, ...updates } : p
      );
      const nextState = { ...state, properties: nextProps };
      return {
        properties: nextProps,
        ...saveToCache(nextState),
      };
    }),

  deleteProperty: (propertyId) =>
    set((state) => {
      const nextProps = state.properties.filter((p) => p.id !== propertyId);
      const nextRows = state.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells || {}).filter(([key]) => key !== propertyId)
        ),
      }));
      const nextState = { ...state, properties: nextProps, rows: nextRows };
      return {
        properties: nextProps,
        rows: nextRows,
        ...saveToCache(nextState),
      };
    }),

  reorderProperties: (newOrder) =>
    set((state) => {
      const nextProps = newOrder.map((id, index) => {
        const prop = state.properties.find((p) => p.id === id);
        return { ...prop, sortOrder: index };
      });
      const nextState = { ...state, properties: nextProps };
      return {
        properties: nextProps,
        ...saveToCache(nextState),
      };
    }),

  // ── Rows ──

  setRows: (rows) => set((state) => {
    const nextState = { ...state, rows };
    return { rows, ...saveToCache(nextState) };
  }),

  addRow: (row) =>
    set((state) => {
      const newRow = {
        id: row?.id || crypto.randomUUID(),
        cells: row?.cells || {},
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...row,
      };
      state.properties.forEach((prop) => {
        if (!(prop.id in newRow.cells)) {
          newRow.cells[prop.id] = getDefaultValue(prop.type);
        }
      });
      const nextRows = [...state.rows, newRow];
      const nextState = { ...state, rows: nextRows };
      return { rows: nextRows, ...saveToCache(nextState) };
    }),

  updateCell: (rowId, propertyId, value) =>
    set((state) => {
      const nextRows = state.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: { ...r.cells, [propertyId]: value },
              updatedAt: new Date().toISOString(),
            }
          : r
      );
      const nextState = { ...state, rows: nextRows };
      return {
        rows: nextRows,
        ...saveToCache(nextState),
      };
    }),

  deleteRow: (rowId) =>
    set((state) => {
      const nextRows = state.rows.filter((r) => r.id !== rowId);
      const nextState = { ...state, rows: nextRows };
      return { rows: nextRows, ...saveToCache(nextState) };
    }),

  duplicateRow: (rowId) =>
    set((state) => {
      const row = state.rows.find((r) => r.id === rowId);
      if (!row) return state;
      const nextRows = [
        ...state.rows,
        {
          ...row,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      const nextState = { ...state, rows: nextRows };
      return { rows: nextRows, ...saveToCache(nextState) };
    }),

  // ── Views ──

  setViews: (views) => set((state) => {
    const nextState = { ...state, views };
    return { views, ...saveToCache(nextState) };
  }),

  setActiveViewId: (id) => set((state) => {
    const nextState = { ...state, activeViewId: id };
    return { activeViewId: id, ...saveToCache(nextState) };
  }),

  addView: (view) =>
    set((state) => {
      const newView = {
        id: view.id || crypto.randomUUID(),
        name: view.name || 'New View',
        type: view.type || 'table',
        config: view.config || {},
        sortOrder: state.views.length,
        ...view,
      };
      const nextViews = [...state.views, newView];
      const nextState = {
        ...state,
        views: nextViews,
        activeViewId: newView.id,
      };
      return {
        views: nextViews,
        activeViewId: newView.id,
        ...saveToCache(nextState),
      };
    }),

  updateView: (viewId, updates) =>
    set((state) => {
      const nextViews = state.views.map((v) =>
        v.id === viewId ? { ...v, ...updates } : v
      );
      const nextState = { ...state, views: nextViews };
      return {
        views: nextViews,
        ...saveToCache(nextState),
      };
    }),

  deleteView: (viewId) =>
    set((state) => {
      const remaining = state.views.filter((v) => v.id !== viewId);
      const nextActiveId =
        state.activeViewId === viewId
          ? remaining[0]?.id || null
          : state.activeViewId;
      const nextState = {
        ...state,
        views: remaining,
        activeViewId: nextActiveId,
      };
      return {
        views: remaining,
        activeViewId: nextActiveId,
        ...saveToCache(nextState),
      };
    }),

  // ── Multi-DB Cross-Page Helper Actions ──

  updateCachedCell: (dbPageId, rowId, propertyId, value) =>
    set((state) => {
      const cache = { ...state.cacheByPageId };
      const dbData = cache[dbPageId];
      if (!dbData) return {};

      const updatedRows = dbData.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: { ...r.cells, [propertyId]: value },
              updatedAt: new Date().toISOString(),
            }
          : r
      );

      cache[dbPageId] = {
        ...dbData,
        rows: updatedRows,
      };

      const updates = { cacheByPageId: cache };
      if (state.database?.pageId === dbPageId) {
        updates.rows = updatedRows;
      }
      return updates;
    }),

  addCachedRow: (dbPageId, row) =>
    set((state) => {
      const cache = { ...state.cacheByPageId };
      const dbData = cache[dbPageId];
      if (!dbData) return {};

      const newRow = {
        id: row?.id || crypto.randomUUID(),
        cells: row?.cells || {},
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...row,
      };

      dbData.properties.forEach((prop) => {
        if (!(prop.id in newRow.cells)) {
          newRow.cells[prop.id] = getDefaultValue(prop.type);
        }
      });

      const updatedRows = [...dbData.rows, newRow];
      cache[dbPageId] = {
        ...dbData,
        rows: updatedRows,
      };

      const updates = { cacheByPageId: cache };
      if (state.database?.pageId === dbPageId) {
        updates.rows = updatedRows;
      }
      return updates;
    }),

  deleteCachedRow: (dbPageId, rowId) =>
    set((state) => {
      const cache = { ...state.cacheByPageId };
      const dbData = cache[dbPageId];
      if (!dbData) return {};

      const updatedRows = dbData.rows.filter((r) => r.id !== rowId);
      cache[dbPageId] = {
        ...dbData,
        rows: updatedRows,
      };

      const updates = { cacheByPageId: cache };
      if (state.database?.pageId === dbPageId) {
        updates.rows = updatedRows;
      }
      return updates;
    }),

  editingCell: null,

  // ── Filters & Sorts ──

  setFilters: (filters) => set({ filters }),
  addFilter: (filter) =>
    set((state) => ({
      filters: [
        ...state.filters,
        {
          id: crypto.randomUUID(),
          propertyId: filter.propertyId,
          operator: filter.operator || 'contains',
          value: filter.value || '',
          ...filter,
        },
      ],
    })),
  removeFilter: (filterId) =>
    set((state) => ({
      filters: state.filters.filter((f) => f.id !== filterId),
    })),

  setSorts: (sorts) => set({ sorts }),
  addSort: (sort) =>
    set((state) => ({
      sorts: [
        ...state.sorts,
        {
          id: crypto.randomUUID(),
          propertyId: sort.propertyId,
          direction: sort.direction || 'asc',
          ...sort,
        },
      ],
    })),
  removeSort: (sortId) =>
    set((state) => ({
      sorts: state.sorts.filter((s) => s.id !== sortId),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setEditingCell: (cell) => set({ editingCell: cell }),

  // ── Computed: get filtered & sorted rows ──

  getFilteredRows: () => {
    const { rows, filters, sorts, searchQuery, properties } = get();

    let result = rows.filter((r) => !r.isArchived);

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        Object.values(row.cells || {}).some((val) =>
          String(val ?? '').toLowerCase().includes(q)
        )
      );
    }

    // Apply filters
    filters.forEach((filter) => {
      const prop = properties.find((p) => p.id === filter.propertyId);
      if (!prop) return;

      result = result.filter((row) => {
        const cellValue = row.cells?.[filter.propertyId];
        const filterValue = filter.value;
        const strVal = String(cellValue ?? '').toLowerCase();
        const strFilter = String(filterValue ?? '').toLowerCase();

        switch (filter.operator) {
          case 'contains':
            return strVal.includes(strFilter);
          case 'does_not_contain':
            return !strVal.includes(strFilter);
          case 'equals':
            return strVal === strFilter;
          case 'does_not_equal':
            return strVal !== strFilter;
          case 'is_empty':
            return !cellValue || cellValue === '';
          case 'is_not_empty':
            return cellValue && cellValue !== '';
          case 'greater_than':
            return Number(cellValue) > Number(filterValue);
          case 'less_than':
            return Number(cellValue) < Number(filterValue);
          default:
            return true;
        }
      });
    });

    // Apply sorts
    if (sorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const aVal = a.cells?.[sort.propertyId] ?? '';
          const bVal = b.cells?.[sort.propertyId] ?? '';
          const prop = properties.find((p) => p.id === sort.propertyId);
          let cmp = 0;

          if (prop?.type === 'number') {
            cmp = Number(aVal) - Number(bVal);
          } else if (prop?.type === 'date') {
            cmp = new Date(aVal || 0) - new Date(bVal || 0);
          } else {
            cmp = String(aVal).localeCompare(String(bVal));
          }

          if (cmp !== 0) {
            return sort.direction === 'desc' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }

    return result;
  },

  // ── Initialize demo database ──

  initDemoDatabase: (pageId) => {
    const page = useWorkspaceStore.getState().pages.find((p) => p.id === pageId);
    const dbType = page?.databaseType || 'tasks';
    const dbId = crypto.randomUUID();
    let properties = [];
    let sampleData = [];
    let views = [];
    let dbName = page?.title || 'Project Tracker';

    if (dbType === 'agencies') {
      properties = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', sortOrder: 0 },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 1,
          config: {
            options: [
              { value: 'Onboarding', color: '#fbbf24' },
              { value: 'Active', color: '#34d399' },
              { value: 'Inactive', color: '#ef4444' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Contact Person', type: 'text', sortOrder: 2 },
        { id: crypto.randomUUID(), name: 'Email', type: 'email', sortOrder: 3 },
        { id: crypto.randomUUID(), name: 'Phone', type: 'phone', sortOrder: 4 },
        { id: crypto.randomUUID(), name: 'Total Projects', type: 'number', sortOrder: 5 },
        { id: crypto.randomUUID(), name: 'Revenue Generated', type: 'number', sortOrder: 6 },
        {
          id: crypto.randomUUID(),
          name: 'Performance Score',
          type: 'select',
          sortOrder: 7,
          config: {
            options: [
              { value: 'Excellent', color: '#34d399' },
              { value: 'Good', color: '#60a5fa' },
              { value: 'Average', color: '#fbbf24' },
              { value: 'Poor', color: '#f87171' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Goals', type: 'text', sortOrder: 8 },
        { id: crypto.randomUUID(), name: 'Goal Revenue/Month', type: 'number', sortOrder: 9 },
        { id: crypto.randomUUID(), name: 'Actual Revenue/Month', type: 'number', sortOrder: 10 },
        { id: crypto.randomUUID(), name: 'Loss Origin', type: 'text', sortOrder: 11 },
        { id: crypto.randomUUID(), name: 'Expenditure', type: 'number', sortOrder: 12 },
        { id: crypto.randomUUID(), name: 'Revenue Model', type: 'text', sortOrder: 13 },
        { id: crypto.randomUUID(), name: 'Rate Card', type: 'text', sortOrder: 14 },
        { id: crypto.randomUUID(), name: 'Growth Models', type: 'text', sortOrder: 15 },
        { id: crypto.randomUUID(), name: 'Innovation Box', type: 'text', sortOrder: 16 },
      ];
      sampleData = [
        {
          Name: 'Itek',
          Status: 'Active',
          'Contact Person': 'Alice Johnson',
          Email: 'alice@itek.toig.co',
          Phone: '+254711223344',
          'Total Projects': 5,
          'Revenue Generated': 42000,
          'Performance Score': 'Excellent',
          Goals: 'Scale operations by 40% and finish deployment of the TOIG HQ client onboarding workflow.',
          'Goal Revenue/Month': 15000,
          'Actual Revenue/Month': 14000,
          'Loss Origin': 'Slight budget adjustment on cloud server scaling templates.',
          Expenditure: 9000,
          'Revenue Model': 'Monthly Retainer + Performance Bonus',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'Full Stack Engineering', rate: 150, quantity: 40, total: 6000, owed: 3000 },
            { id: '2', service: 'Mobile App Architecture', rate: 180, quantity: 30, total: 5400, owed: 5400 },
            { id: '3', service: 'UI Design Briefs', rate: 100, quantity: 20, total: 2000, owed: 1000 }
          ]),
          'Growth Models': 'Hire 2 senior developers to accelerate client integrations and cross-sell technical consulting.',
          'Innovation Box': 'Deploying internal AI tools to review pull requests and suggest security patches automatically.'
        },
        {
          Name: 'I360',
          Status: 'Active',
          'Contact Person': 'Bob Smith',
          Email: 'bob@i360.toig.co',
          Phone: '+254722334455',
          'Total Projects': 3,
          'Revenue Generated': 28500,
          'Performance Score': 'Good',
          Goals: 'Deliver Q2 video advertising campaigns for local small businesses.',
          'Goal Revenue/Month': 10000,
          'Actual Revenue/Month': 9500,
          'Loss Origin': 'Higher than expected contractor fees for visual effects.',
          Expenditure: 6000,
          'Revenue Model': 'Retainer + Milestone Payments',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'Social Media Management', rate: 100, quantity: 50, total: 5000, owed: 2500 },
            { id: '2', service: 'Video Ad Production', rate: 150, quantity: 30, total: 4500, owed: 4500 }
          ]),
          'Growth Models': 'Partner with localized content creators to offer cheaper short-form packages.',
          'Innovation Box': 'Testing interactive canvas wireframes to shorten client approval loops.'
        },
        {
          Name: 'I3x Africa',
          Status: 'Active',
          'Contact Person': 'Charlie Brown',
          Email: 'charlie@i3x.toig.co',
          Phone: '+254733445566',
          'Total Projects': 4,
          'Revenue Generated': 32000,
          'Performance Score': 'Good',
          Goals: 'Establish workspace layouts in Nairobi hub and prepare Outbound regional sales strategy.',
          'Goal Revenue/Month': 12000,
          'Actual Revenue/Month': 11500,
          'Loss Origin': 'Increased regional logistical costs for setup materials.',
          Expenditure: 7500,
          'Revenue Model': 'Retainer',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'SaaS Regional Consulting', rate: 150, quantity: 40, total: 6000, owed: 2000 },
            { id: '2', service: 'Business Setup Strategy', rate: 200, quantity: 20, total: 4000, owed: 4000 }
          ]),
          'Growth Models': 'Focusing on cold email outbound sequences targeting tech startups in West and East Africa.',
          'Innovation Box': 'Integrating custom automated dashboards for regional partner analytics.'
        },
        {
          Name: 'I3 studio',
          Status: 'Onboarding',
          'Contact Person': 'Diana Prince',
          Email: 'diana@studio.toig.co',
          Phone: '+254744556677',
          'Total Projects': 0,
          'Revenue Generated': 0,
          'Performance Score': 'Average',
          Goals: 'Draft brand style assets for 3 new inbound client brands.',
          'Goal Revenue/Month': 6000,
          'Actual Revenue/Month': 0,
          'Loss Origin': 'Awaiting initial retainer deposits to commence discovery designs.',
          Expenditure: 0,
          'Revenue Model': 'Fixed Project basis',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'Brand Logo Concept Creation', rate: 120, quantity: 0, total: 0, owed: 0 }
          ]),
          'Growth Models': 'Acquire design contracts with regional startups to establish portfolio presence.',
          'Innovation Box': 'Exploring automated design template distribution to speed up design execution.'
        },
        {
          Name: 'i3+',
          Status: 'Active',
          'Contact Person': 'Erick Omondi',
          Email: 'erick@plus.toig.co',
          Phone: '+254755667788',
          'Total Projects': 2,
          'Revenue Generated': 15000,
          'Performance Score': 'Excellent',
          Goals: 'Initiate pilot test terms for community micro-lending programs.',
          'Goal Revenue/Month': 5000,
          'Actual Revenue/Month': 5000,
          'Loss Origin': 'N/A',
          Expenditure: 2500,
          'Revenue Model': 'Performance Interest Retainer',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'Program Strategy Review', rate: 100, quantity: 30, total: 3000, owed: 1500 }
          ]),
          'Growth Models': 'Scaling community banking partnerships to leverage capital pools.',
          'Innovation Box': 'Exploring blockchain integrations for micro-credit score distribution.'
        },
        {
          Name: 'I3 launchpad',
          Status: 'Onboarding',
          'Contact Person': 'Faith Mutua',
          Email: 'faith@launchpad.toig.co',
          Phone: '+254766778899',
          'Total Projects': 0,
          'Revenue Generated': 0,
          'Performance Score': 'Average',
          Goals: 'Launch the application portal for the next tech cohort.',
          'Goal Revenue/Month': 4000,
          'Actual Revenue/Month': 0,
          'Loss Origin': 'Contracts still in signing phase with the program sponsor.',
          Expenditure: 0,
          'Revenue Model': 'Sponsor Retainer',
          'Rate Card': JSON.stringify([
            { id: '1', service: 'Sponsor Strategy Consults', rate: 200, quantity: 0, total: 0, owed: 0 }
          ]),
          'Growth Models': 'Targeting corporate sponsors interested in local incubation initiatives.',
          'Innovation Box': 'Developing an interactive quiz to screen early stage founders.'
        },
      ];
    } else if (dbType === 'assets') {
      properties = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', sortOrder: 0 },
        {
          id: crypto.randomUUID(),
          name: 'Type',
          type: 'select',
          sortOrder: 1,
          config: {
            options: [
              { value: 'Vehicle', color: '#60a5fa' },
              { value: 'Equipment', color: '#a78bfa' },
              { value: 'Property', color: '#34d399' },
              { value: 'Digital', color: '#fbbf24' },
            ],
          },
        },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 2,
          config: {
            options: [
              { value: 'Available', color: '#34d399' },
              { value: 'In Use', color: '#60a5fa' },
              { value: 'Maintenance', color: '#fbbf24' },
              { value: 'Retired', color: '#ef4444' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Purchase Value', type: 'number', sortOrder: 3 },
        { id: crypto.randomUUID(), name: 'Current Value', type: 'number', sortOrder: 4 },
        { id: crypto.randomUUID(), name: 'Total Income', type: 'number', sortOrder: 5 },
      ];
      sampleData = [
        { Name: 'Toyota Hiace (Member Van)', Type: 'Vehicle', Status: 'In Use', 'Purchase Value': 25000, 'Current Value': 21000, 'Total Income': 8400 },
        { Name: 'Sony FX3 Cinema Camera', Type: 'Equipment', Status: 'Available', 'Purchase Value': 3900, 'Current Value': 3500, 'Total Income': 1200 },
        { Name: 'Community Studio Space', Type: 'Property', Status: 'Available', 'Purchase Value': 85000, 'Current Value': 92000, 'Total Income': 15600 },
        { Name: 'Impact360 domain portfolio', Type: 'Digital', Status: 'Available', 'Purchase Value': 1500, 'Current Value': 2500, 'Total Income': 0 },
        { Name: 'Generac Backup Generator', Type: 'Equipment', Status: 'Maintenance', 'Purchase Value': 5000, 'Current Value': 4200, 'Total Income': 350 },
      ];
    } else if (dbType === 'events') {
      properties = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', sortOrder: 0 },
        { id: crypto.randomUUID(), name: 'Date', type: 'date', sortOrder: 1 },
        { id: crypto.randomUUID(), name: 'Location', type: 'text', sortOrder: 2 },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 3,
          config: {
            options: [
              { value: 'Planning', color: '#8b8fa3' },
              { value: 'Upcoming', color: '#60a5fa' },
              { value: 'Live', color: '#a78bfa' },
              { value: 'Completed', color: '#34d399' },
              { value: 'Cancelled', color: '#f87171' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Expected Attendance', type: 'number', sortOrder: 4 },
        { id: crypto.randomUUID(), name: 'Actual Attendance', type: 'number', sortOrder: 5 },
        { id: crypto.randomUUID(), name: 'Budget', type: 'number', sortOrder: 6 },
        { id: crypto.randomUUID(), name: 'Actual Spend', type: 'number', sortOrder: 7 },
      ];
      sampleData = [
        { Name: 'Youth Leadership Summit 2026', Date: '2026-06-15', Location: 'Main Auditorium', Status: 'Upcoming', 'Expected Attendance': 250, 'Actual Attendance': 0, Budget: 15000, 'Actual Spend': 8400 },
        { Name: 'Impact Hackathon', Date: '2026-05-20', Location: 'Innovation Hub', Status: 'Completed', 'Expected Attendance': 100, 'Actual Attendance': 92, Budget: 5000, 'Actual Spend': 4850 },
        { Name: 'Community Feeding Drive', Date: '2026-05-28', Location: 'Community Center', Status: 'Live', 'Expected Attendance': 500, 'Actual Attendance': 475, Budget: 2500, 'Actual Spend': 2600 },
        { Name: 'Annual Fundraiser Gala', Date: '2026-11-10', Location: 'Grand Ballroom', Status: 'Planning', 'Expected Attendance': 150, 'Actual Attendance': 0, Budget: 35000, 'Actual Spend': 1200 },
      ];
    } else if (dbType === 'members') {
      properties = [
        { id: crypto.randomUUID(), name: 'Full Name', type: 'text', sortOrder: 0 },
        { id: crypto.randomUUID(), name: 'Email', type: 'email', sortOrder: 1 },
        { id: crypto.randomUUID(), name: 'Phone', type: 'phone', sortOrder: 2 },
        {
          id: crypto.randomUUID(),
          name: 'Role',
          type: 'select',
          sortOrder: 3,
          config: {
            options: [
              { value: 'Volunteer', color: '#60a5fa' },
              { value: 'Staff', color: '#a78bfa' },
              { value: 'Leader', color: '#34d399' },
              { value: 'Member', color: '#8b8fa3' },
            ],
          },
        },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 4,
          config: {
            options: [
              { value: 'Active', color: '#34d399' },
              { value: 'Inactive', color: '#f87171' },
            ],
          },
        },
        {
          id: crypto.randomUUID(),
          name: 'Skills',
          type: 'multi_select',
          sortOrder: 5,
          config: {
            options: [
              { value: 'Management', color: '#a78bfa' },
              { value: 'Marketing', color: '#34d399' },
              { value: 'Design', color: '#fbbf24' },
              { value: 'Development', color: '#60a5fa' },
              { value: 'Events', color: '#f472b6' },
              { value: 'Finance', color: '#818cf8' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Joined Date', type: 'date', sortOrder: 6 },
      ];
      sampleData = [
        { 'Full Name': 'Erick Omondi', Email: 'erick@impact360.org', Phone: '+254711000111', Role: 'Leader', Status: 'Active', Skills: ['Management', 'Finance'], 'Joined Date': '2023-01-15' },
        { 'Full Name': 'Faith Mutua', Email: 'faith@gmail.com', Phone: '+254722000222', Role: 'Staff', Status: 'Active', Skills: ['Marketing', 'Events'], 'Joined Date': '2024-03-10' },
        { 'Full Name': 'John Doe', Email: 'john.doe@gmail.com', Phone: '+254733000333', Role: 'Volunteer', Status: 'Active', Skills: ['Development', 'Design'], 'Joined Date': '2025-05-01' },
        { 'Full Name': 'Grace Wanjiku', Email: 'grace@outlook.com', Phone: '+254744000444', Role: 'Member', Status: 'Active', Skills: ['Design', 'Marketing'], 'Joined Date': '2025-02-18' },
        { 'Full Name': 'Paul Kiprop', Email: 'paul@gmail.com', Phone: '+254755000555', Role: 'Volunteer', Status: 'Inactive', Skills: ['Events'], 'Joined Date': '2024-06-01' },
      ];
    } else if (dbType === 'whatsapp') {
      properties = [
        { id: crypto.randomUUID(), name: 'Group Name', type: 'text', sortOrder: 0 },
        { id: crypto.randomUUID(), name: 'Purpose', type: 'text', sortOrder: 1 },
        { id: crypto.randomUUID(), name: 'Invite Link', type: 'url', sortOrder: 2 },
        { id: crypto.randomUUID(), name: 'Member Count', type: 'number', sortOrder: 3 },
        { id: crypto.randomUUID(), name: 'Admin', type: 'text', sortOrder: 4 },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 5,
          config: {
            options: [
              { value: 'Active', color: '#34d399' },
              { value: 'Archived', color: '#8b8fa3' },
            ],
          },
        },
      ];
      sampleData = [
        { 'Group Name': 'Impact360 Announcements', Purpose: 'Broadcast official news, alerts, updates', 'Invite Link': 'https://chat.whatsapp.com/sampleAnnouncements', 'Member Count': 412, Admin: 'Erick Omondi', Status: 'Active' },
        { 'Group Name': 'Dev & Tech Team', Purpose: 'Coordinate platform devs, designers, contributors', 'Invite Link': 'https://chat.whatsapp.com/sampleDevTech', 'Member Count': 48, Admin: 'John Doe', Status: 'Active' },
        { 'Group Name': 'Event Volunteers 2026', Purpose: 'Organize logistics and schedule for events', 'Invite Link': 'https://chat.whatsapp.com/sampleVolunteers', 'Member Count': 124, Admin: 'Faith Mutua', Status: 'Active' },
        { 'Group Name': 'Fundraiser Campaign 2025', Purpose: 'Archive group for completed fundraiser campaign', 'Invite Link': 'https://chat.whatsapp.com/sampleFundraiser2025', 'Member Count': 85, Admin: 'Erick Omondi', Status: 'Archived' },
      ];
    } else {
      // Default tasks
      properties = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', sortOrder: 0 },
        {
          id: crypto.randomUUID(),
          name: 'Status',
          type: 'select',
          sortOrder: 1,
          config: {
            options: [
              { value: 'Not Started', color: '#8b8fa3' },
              { value: 'In Progress', color: '#60a5fa' },
              { value: 'Completed', color: '#34d399' },
              { value: 'Blocked', color: '#f87171' },
            ],
          },
        },
        {
          id: crypto.randomUUID(),
          name: 'Priority',
          type: 'select',
          sortOrder: 2,
          config: {
            options: [
              { value: 'Low', color: '#8b8fa3' },
              { value: 'Medium', color: '#fbbf24' },
              { value: 'High', color: '#f87171' },
              { value: 'Urgent', color: '#ef4444' },
            ],
          },
        },
        { id: crypto.randomUUID(), name: 'Assignee', type: 'text', sortOrder: 3 },
        { id: crypto.randomUUID(), name: 'Due Date', type: 'date', sortOrder: 4 },
        { id: crypto.randomUUID(), name: 'Tags', type: 'multi_select', sortOrder: 5, config: {
          options: [
            { value: 'Design', color: '#a78bfa' },
            { value: 'Dev', color: '#60a5fa' },
            { value: 'Marketing', color: '#34d399' },
            { value: 'Finance', color: '#fbbf24' },
            { value: 'Strategy', color: '#818cf8' },
          ],
        }},
        { id: crypto.randomUUID(), name: 'Done', type: 'checkbox', sortOrder: 6 },
        { id: 'tasks-agency-property-id', name: 'Agency', type: 'select', sortOrder: 7, config: {
          options: [
            { value: 'Itek', color: '#60a5fa' },
            { value: 'I360', color: '#f472b6' },
            { value: 'I3x Africa', color: '#34d399' },
            { value: 'I3 studio', color: '#a78bfa' },
            { value: 'i3+', color: '#fbbf24' },
            { value: 'I3 launchpad', color: '#f87171' }
          ]
        }}
      ];
      sampleData = [
        { Name: 'Build agency dashboard widgets', Status: 'In Progress', Priority: 'High', Assignee: 'Sarah K.', 'Due Date': '2026-06-15', Tags: ['Dev'], Done: false, Agency: 'Itek' },
        { Name: 'Optimize SQL RLS policies', Status: 'Completed', Priority: 'Medium', Assignee: 'James M.', 'Due Date': '2026-06-01', Tags: ['Dev'], Done: true, Agency: 'Itek' },
        { Name: 'Draft Q2 social media briefs', Status: 'Not Started', Priority: 'Low', Assignee: 'Alex N.', 'Due Date': '2026-06-25', Tags: ['Marketing'], Done: false, Agency: 'I360' },
        { Name: 'Formulate Africa expansion blueprint', Status: 'In Progress', Priority: 'High', Assignee: 'Erick O.', 'Due Date': '2026-07-05', Tags: ['Strategy'], Done: false, Agency: 'I3x Africa' },
        { Name: 'Setup server infra in Lagos region', Status: 'Not Started', Priority: 'Urgent', Assignee: 'John D.', 'Due Date': '2026-06-12', Tags: ['Dev'], Done: false, Agency: 'I3x Africa' },
        { Name: 'Design brand assets for new partners', Status: 'Not Started', Priority: 'Medium', Assignee: 'Diana P.', 'Due Date': '2026-06-20', Tags: ['Design'], Done: false, Agency: 'I3 studio' },
        { Name: 'Draft pilot test terms for program launch', Status: 'In Progress', Priority: 'Low', Assignee: 'Grace W.', 'Due Date': '2026-06-18', Tags: ['Finance'], Done: false, Agency: 'i3+' },
        { Name: 'Establish tech cohort application portal', Status: 'Blocked', Priority: 'High', Assignee: 'Faith M.', 'Due Date': '2026-06-30', Tags: ['Dev'], Done: false, Agency: 'I3 launchpad' },
      ];
    }

    const rows = sampleData.map((data) => {
      const cells = {};
      properties.forEach((prop) => {
        cells[prop.id] = data[prop.name] ?? getDefaultValue(prop.type);
      });
      return {
        id: crypto.randomUUID(),
        cells,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    if (dbType !== 'tasks') {
      views.push({
        id: crypto.randomUUID(),
        name: 'Dashboard',
        type: 'dashboard',
        config: {},
        sortOrder: 0,
      });
    }

    const defaultView = {
      id: crypto.randomUUID(),
      name: dbType === 'tasks' ? 'All Tasks' : 'Table View',
      type: 'table',
      config: {},
      sortOrder: views.length,
    };
    views.push(defaultView);

    if (dbType === 'agencies' || dbType === 'assets' || dbType === 'whatsapp' || dbType === 'tasks') {
      const statusProp = properties.find((p) => p.name === 'Status');
      views.push({
        id: crypto.randomUUID(),
        name: 'Board',
        type: 'kanban',
        config: { groupByPropertyId: statusProp?.id },
        sortOrder: views.length,
      });
    }

    if (dbType === 'events') {
      views.push({
        id: crypto.randomUUID(),
        name: 'Calendar',
        type: 'calendar',
        config: {},
        sortOrder: views.length,
      });
    }

    if (dbType === 'members') {
      views.push({
        id: crypto.randomUUID(),
        name: 'Compact List',
        type: 'list',
        config: {},
        sortOrder: views.length,
      });
    }

    set({
      database: { id: dbId, pageId, name: dbName, type: dbType },
      properties,
      rows,
      views,
      activeViewId: views[0].id,
      filters: [],
      sorts: [],
      searchQuery: '',
    });

    return { dbId, properties, rows };
  },
}));

/** Get default value for a property type */
function getDefaultValue(type) {
  switch (type) {
    case 'number': return 0;
    case 'checkbox': return false;
    case 'select': return '';
    case 'multi_select': return [];
    case 'date': return '';
    case 'url': return '';
    case 'email': return '';
    case 'phone': return '';
    default: return '';
  }
}
