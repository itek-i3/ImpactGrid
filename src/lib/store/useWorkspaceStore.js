'use client';

import { create } from 'zustand';

const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/demo');
  }
  return false;
};

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

  // ── Page CRUD (connected to Next.js REST API routes) ──

  loadWorkspace: async (workspaceId) => {
    if (isDemoMode()) {
      return; // Handled by initDemoWorkspace
    }

    set({ isLoading: true });
    try {
      const wsRes = await fetch('/api/workspaces');
      if (!wsRes.ok) throw new Error('Failed to fetch workspaces');
      let workspaces = await wsRes.json();

      if (workspaces.length === 0) {
        const createRes = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Personal Workspace', icon: '🚀' }),
        });
        if (createRes.ok) {
          const newWs = await createRes.json();
          workspaces = [newWs];
        }
      }

      set({ workspaces });

      const activeWs = workspaces.find((w) => w.id === workspaceId) || workspaces[0];
      if (!activeWs) return;

      set({ workspace: activeWs });

      const [activePagesRes, archivedPagesRes] = await Promise.all([
        fetch(`/api/pages?workspaceId=${activeWs.id}&archived=false`),
        fetch(`/api/pages?workspaceId=${activeWs.id}&archived=true`),
      ]);

      let activePages = [];
      let archivedPages = [];

      if (activePagesRes.ok) activePages = await activePagesRes.json();
      if (archivedPagesRes.ok) archivedPages = await archivedPagesRes.json();

      const mapPageFromDb = (p) => ({
        id: p.id,
        title: p.title,
        icon: p.icon,
        coverUrl: p.cover_url,
        parentId: p.parent_id,
        isDatabase: p.is_database,
        databaseType: p.database_type,
        isArchived: p.is_archived,
        isFavorite: p.is_favorite,
        isPublic: p.is_public,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      });

      const pages = [...activePages, ...archivedPages].map(mapPageFromDb);
      set({ pages });
    } catch (e) {
      console.error('Failed to load workspace:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addPage: async (page) => {
    const state = get();

    if (isDemoMode()) {
      const newPage = {
        id: page.id || crypto.randomUUID(),
        title: page.title || 'Untitled',
        icon: page.icon || '📄',
        parentId: page.parentId || null,
        isDatabase: page.isDatabase || false,
        databaseType: page.databaseType || null,
        isArchived: false,
        isFavorite: page.isFavorite || false,
        sortOrder: state.pages.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        pages: [...state.pages, newPage],
      }));
      return newPage.id;
    }

    const workspaceId = state.workspace?.id;
    if (!workspaceId) return;

    const tempId = crypto.randomUUID();
    const optimisticPage = {
      id: tempId,
      title: page.title || 'Untitled',
      icon: page.icon || '📄',
      parentId: page.parentId || null,
      isDatabase: page.isDatabase || false,
      databaseType: page.databaseType || null,
      isArchived: false,
      isFavorite: page.isFavorite || false,
      sortOrder: state.pages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      pages: [...state.pages, optimisticPage],
    }));

    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          parentId: page.parentId || null,
          title: page.title || 'Untitled',
          icon: page.icon || '📄',
          isDatabase: page.isDatabase || false,
          databaseType: page.databaseType || null,
          sortOrder: optimisticPage.sortOrder,
          isFavorite: optimisticPage.isFavorite,
        }),
      });

      if (!res.ok) throw new Error('Failed to create page');
      const createdPage = await res.json();

      set((state) => ({
        pages: state.pages.map((p) =>
          p.id === tempId
            ? {
                id: createdPage.id,
                title: createdPage.title,
                icon: createdPage.icon,
                coverUrl: createdPage.cover_url,
                parentId: createdPage.parent_id,
                isDatabase: createdPage.is_database,
                databaseType: createdPage.database_type,
                isArchived: createdPage.is_archived,
                isFavorite: createdPage.is_favorite,
                isPublic: createdPage.is_public,
                sortOrder: createdPage.sort_order,
                createdAt: createdPage.created_at,
                updatedAt: createdPage.updated_at,
              }
            : p
        ),
      }));
      return createdPage.id;
    } catch (e) {
      console.error('Failed to save page to database:', e);
      set((state) => ({
        pages: state.pages.filter((p) => p.id !== tempId),
      }));
    }
  },

  updatePage: async (pageId, updates) => {
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
    }));

    if (isDemoMode()) return;

    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.coverUrl !== undefined) dbUpdates.cover_url = updates.coverUrl;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates),
      });
      if (!res.ok) throw new Error('Failed to update page');
    } catch (e) {
      console.error('Failed to update page in database:', e);
    }
  },

  deletePage: async (pageId) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isArchived: true } : p
      ),
      currentPage: state.currentPage?.id === pageId ? null : state.currentPage,
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      if (!res.ok) throw new Error('Failed to archive page');
    } catch (e) {
      console.error('Failed to archive page in database:', e);
    }
  },

  restorePage: async (pageId) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isArchived: false } : p
      ),
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      if (!res.ok) throw new Error('Failed to restore page');
    } catch (e) {
      console.error('Failed to restore page in database:', e);
    }
  },

  permanentlyDeletePage: async (pageId) => {
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== pageId),
      currentPage: state.currentPage?.id === pageId ? null : state.currentPage,
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete page');
    } catch (e) {
      console.error('Failed to permanently delete page in database:', e);
    }
  },

  reorderPage: async (pageId, newSortOrder) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, sortOrder: newSortOrder } : p
      ),
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newSortOrder }),
      });
      if (!res.ok) throw new Error('Failed to reorder page');
    } catch (e) {
      console.error('Failed to reorder page in database:', e);
    }
  },

  toggleFavoritePage: async (pageId) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) return;

    const nextFavorite = !page.isFavorite;

    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isFavorite: nextFavorite } : p
      ),
      currentPage:
        state.currentPage?.id === pageId
          ? { ...state.currentPage, isFavorite: nextFavorite }
          : state.currentPage,
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: nextFavorite }),
      });
      if (!res.ok) throw new Error('Failed to toggle favorite');
    } catch (e) {
      console.error('Failed to toggle favorite in database:', e);
    }
  },

  duplicatePage: async (pageId) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) return;

    if (isDemoMode()) {
      const newPageId = crypto.randomUUID();
      const newPage = {
        ...page,
        id: newPageId,
        title: page.title ? `${page.title} (Copy)` : 'Untitled Copy',
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        pages: [...state.pages, newPage],
      }));

      try {
        const editorStore = require('./useEditorStore').useEditorStore.getState();
        if (editorStore) {
          const oldBlocks = editorStore.blocksByPage?.[pageId] || [];
          const idMap = {};
          
          const duplicatedBlocks = oldBlocks.map((b) => {
            const newBlockId = crypto.randomUUID();
            idMap[b.id] = newBlockId;
            return {
              ...b,
              id: newBlockId,
              pageId: newPageId,
            };
          }).map((b) => ({
            ...b,
            parentBlockId: b.parentBlockId ? idMap[b.parentBlockId] || b.parentBlockId : null,
          }));

          editorStore.blocksByPage = {
            ...(editorStore.blocksByPage || {}),
            [newPageId]: duplicatedBlocks,
          };
        }
      } catch (err) {
        console.warn('Failed to duplicate editor blocks in demo mode:', err);
      }
      return newPageId;
    }

    const workspaceId = get().workspace?.id;
    if (!workspaceId) return;

    const duplicatedTitle = page.title ? `${page.title} (Copy)` : 'Untitled Copy';

    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          parentId: page.parentId,
          title: duplicatedTitle,
          icon: page.icon || '📄',
          isDatabase: page.isDatabase,
          databaseType: page.databaseType,
          sortOrder: get().pages.length,
          isFavorite: false,
        }),
      });

      if (!res.ok) throw new Error('Failed to duplicate page');
      const newPage = await res.json();

      const mapPageFromDb = (p) => ({
        id: p.id,
        title: p.title,
        icon: p.icon,
        coverUrl: p.cover_url,
        parentId: p.parent_id,
        isDatabase: p.is_database,
        databaseType: p.database_type,
        isArchived: p.is_archived,
        isFavorite: p.is_favorite,
        isPublic: p.is_public,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      });

      const newPageMapped = mapPageFromDb(newPage);

      set((state) => ({
        pages: [...state.pages, newPageMapped],
      }));

      try {
        const blocksRes = await fetch(`/api/pages/${pageId}/blocks`);
        if (blocksRes.ok) {
          const oldBlocks = await blocksRes.json();
          const idMap = {};
          
          const duplicatedBlocks = oldBlocks.map((b) => {
            const newBlockId = crypto.randomUUID();
            idMap[b.id] = newBlockId;
            return {
              ...b,
              id: newBlockId,
              page_id: newPage.id,
            };
          }).map((b) => ({
            ...b,
            parent_block_id: b.parent_block_id ? idMap[b.parent_block_id] || b.parent_block_id : null,
          }));

          for (const b of duplicatedBlocks) {
            await fetch(`/api/pages/${newPage.id}/blocks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: b.type,
                content: b.content,
                properties: b.properties,
                parentBlockId: b.parent_block_id,
                sortOrder: b.sort_order,
              }),
            });
          }

          const editorStore = require('./useEditorStore').useEditorStore.getState();
          if (editorStore) {
            const mapBlockFromDb = (block) => ({
              id: block.id,
              pageId: block.page_id,
              parentBlockId: block.parent_block_id,
              type: block.type,
              content: block.content,
              properties: block.properties,
              sortOrder: block.sort_order,
              createdAt: block.created_at,
              updatedAt: block.updated_at,
            });
            editorStore.blocksByPage = {
              ...(editorStore.blocksByPage || {}),
              [newPage.id]: duplicatedBlocks.map(mapBlockFromDb),
            };
          }
        }
      } catch (err) {
        console.warn('Failed to duplicate editor blocks:', err);
      }

      return newPage.id;
    } catch (e) {
      console.error('Failed to duplicate page:', e);
    }
  },

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
