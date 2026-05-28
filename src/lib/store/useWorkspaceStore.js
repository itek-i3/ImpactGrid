'use client';

import { create } from 'zustand';

/**
 * Workspace store — manages workspace state, page tree, and navigation.
 * In MVP/demo mode, uses local state. When Supabase is connected,
 * actions will sync with the database.
 */
export const useWorkspaceStore = create((set, get) => ({
  // Current workspace
  workspace: null,
  workspaces: [],

  // Page tree
  pages: [],
  currentPage: null,
  expandedPages: new Set(),

  // UI state
  sidebarOpen: true,
  sidebarWidth: 260,
  searchOpen: false,
  isLoading: false,
  theme: 'dark',

  // ── Actions ──────────────────────────────────

  setWorkspace: (workspace) => set({ workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setPages: (pages) => set({ pages }),

  setCurrentPage: (page) => set({ currentPage: page }),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSearch: () =>
    set((state) => ({ searchOpen: !state.searchOpen })),

  setSearchOpen: (open) => set({ searchOpen: open }),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('impactnotion-theme', newTheme);
      }
      return { theme: newTheme };
    }),

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('impactnotion-theme', theme);
    }
    set({ theme });
  },

  setLoading: (isLoading) => set({ isLoading }),

  togglePageExpanded: (pageId) =>
    set((state) => {
      const expanded = new Set(state.expandedPages);
      if (expanded.has(pageId)) {
        expanded.delete(pageId);
      } else {
        expanded.add(pageId);
      }
      return { expandedPages: expanded };
    }),

  // ── Page CRUD (local state for demo, Supabase integration later) ──

  addPage: (page) =>
    set((state) => ({
      pages: [...state.pages, {
        id: page.id || crypto.randomUUID(),
        title: page.title || 'Untitled',
        icon: page.icon || '📄',
        parentId: page.parentId || null,
        isDatabase: page.isDatabase || false,
        isArchived: false,
        sortOrder: state.pages.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...page,
      }],
    })),

  updatePage: (pageId, updates) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      ),
      currentPage:
        state.currentPage?.id === pageId
          ? { ...state.currentPage, ...updates }
          : state.currentPage,
    })),

  deletePage: (pageId) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isArchived: true } : p
      ),
    })),

  restorePage: (pageId) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isArchived: false } : p
      ),
    })),

  permanentlyDeletePage: (pageId) =>
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== pageId),
    })),

  reorderPage: (pageId, newSortOrder) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, sortOrder: newSortOrder } : p
      ),
    })),

  // ── Computed / Selectors ──

  getPageChildren: (parentId) => {
    return get()
      .pages.filter((p) => p.parentId === parentId && !p.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getRootPages: () => {
    return get()
      .pages.filter((p) => !p.parentId && !p.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getArchivedPages: () => {
    return get().pages.filter((p) => p.isArchived);
  },

  // ── Initialize demo workspace ──
  initDemoWorkspace: () => {
    const workspaceId = crypto.randomUUID();
    const workspace = {
      id: workspaceId,
      name: 'Impact360 Workspace',
      icon: '🚀',
      createdAt: new Date().toISOString(),
    };

    const demoPages = [
      {
        id: crypto.randomUUID(),
        title: 'Getting Started',
        icon: '👋',
        parentId: null,
        isDatabase: false,
        isArchived: false,
        sortOrder: 0,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Meeting Notes',
        icon: '📝',
        parentId: null,
        isDatabase: false,
        isArchived: false,
        sortOrder: 1,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Agencies',
        icon: '🏢',
        parentId: null,
        isDatabase: true,
        databaseType: 'agencies',
        isArchived: false,
        sortOrder: 2,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Asset Tracker',
        icon: '💰',
        parentId: null,
        isDatabase: true,
        databaseType: 'assets',
        isArchived: false,
        sortOrder: 3,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Event Manager',
        icon: '📅',
        parentId: null,
        isDatabase: true,
        databaseType: 'events',
        isArchived: false,
        sortOrder: 4,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Member Directory',
        icon: '👥',
        parentId: null,
        isDatabase: true,
        databaseType: 'members',
        isArchived: false,
        sortOrder: 5,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'WhatsApp Groups',
        icon: '💬',
        parentId: null,
        isDatabase: true,
        databaseType: 'whatsapp',
        isArchived: false,
        sortOrder: 6,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Project Tracker',
        icon: '📊',
        parentId: null,
        isDatabase: true,
        databaseType: 'tasks',
        isArchived: false,
        sortOrder: 7,
        workspaceId,
      },
      {
        id: crypto.randomUUID(),
        title: 'Resources',
        icon: '📚',
        parentId: null,
        isDatabase: false,
        isArchived: false,
        sortOrder: 8,
        workspaceId,
      },
    ];

    set({
      workspace,
      workspaces: [workspace],
      pages: demoPages,
    });

    return { workspace, pages: demoPages };
  },
}));
