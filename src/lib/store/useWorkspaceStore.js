'use client';

import { create } from 'zustand';

const isDemoMode = () => {
  try {
    const isDemo = useWorkspaceStore.getState().isDemo;
    if (isDemo !== undefined) return isDemo;
  } catch {}
  if (typeof window !== 'undefined') {
    return window.location.pathname.includes('/demo');
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
  isDemo: true,
  userProfile: null,

  // Active Chat Channel (for global notification filtering)
  activeChatChannel: null,

  // Multi-agency
  agencies: [],
  activeAgencyId: null,

  // Page tree
  pages: [],
  currentPage: null,
  currentView: null, // null | 'acquisition' | 'meetings' — in-shell tabs that aren't pages
  expandedPages: new Set(),

  // UI state
  sidebarOpen: true,
  sidebarWidth: 260,
  searchOpen: false,
  isLoading: false,
  theme: 'dark',
  unreadChatCount: 0,
  unreadChatChannels: [],
  // Per-channel notification detail: { [channel]: { senderName, message, count, at, isDm } }
  chatNotifs: {},

  // ── Actions ──────────────────────────────────

  fetchUserProfile: async () => {
    try {
      const res = await fetch('/os/api/profile');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const agencies = json.data.agencies || [];
          // Restore last active agency from localStorage
          const savedAgencyId = typeof window !== 'undefined'
            ? localStorage.getItem('activeAgencyId')
            : null;
          const validSaved = agencies.find((a) => a.id === savedAgencyId);
          const activeAgencyId = validSaved?.id || agencies[0]?.id || null;
          set({ userProfile: json.data, isDemo: false, agencies, activeAgencyId });
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile, staying in demo mode:', err);
    }
    set({ isDemo: true });
    return null;
  },

  switchAgency: async (agencyId) => {
    if (typeof window !== 'undefined') localStorage.setItem('activeAgencyId', agencyId);
    set({ activeAgencyId: agencyId, workspace: null, workspaces: [], pages: [], currentPage: null, currentView: null });
    await get().loadWorkspace(null, agencyId);
  },

  setActiveChatChannel: (activeChatChannel) => set({ activeChatChannel }),
  setWorkspace: (workspace) => set({ workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),

  updateWorkspaceSettings: async (id, updates) => {
    const res = await fetch(`/os/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to save'); }
    const { data } = await res.json();
    set((state) => ({
      workspace: state.workspace?.id === id ? { ...state.workspace, ...data } : state.workspace,
      workspaces: state.workspaces.map((w) => w.id === id ? { ...w, ...data } : w),
    }));
    return data;
  },
  setPages: (pages) => set({ pages }),

  setCurrentPage: (page) => set({ currentPage: page, currentView: null }),

  // In-shell views that aren't pages (e.g. Acquisition). Clears the open page
  // so the workspace content area renders the view instead.
  setCurrentView: (view) => set({ currentView: view, currentPage: null }),

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

  // meta: { senderName, message, isDm } — who sent it + a preview (optional)
  addChatNotification: (channel, meta = {}) =>
    set((state) => {
      if (!channel) return state;
      const prev = state.chatNotifs[channel];
      const nextChannels = state.unreadChatChannels.includes(channel)
        ? state.unreadChatChannels
        : [...state.unreadChatChannels, channel];
      return {
        unreadChatChannels: nextChannels,
        unreadChatCount: nextChannels.length,
        chatNotifs: {
          ...state.chatNotifs,
          [channel]: {
            senderName: meta.senderName || prev?.senderName || 'Someone',
            message: meta.message ?? prev?.message ?? '',
            isDm: meta.isDm ?? prev?.isDm ?? channel.startsWith('dm:'),
            count: (prev?.count || 0) + 1,
            at: Date.now(),
          },
        },
      };
    }),

  clearChatNotifications: (channel) =>
    set((state) => {
      if (!channel) return state;
      const nextChannels = state.unreadChatChannels.filter((c) => c !== channel);
      const chatNotifs = { ...state.chatNotifs };
      delete chatNotifs[channel];
      return {
        unreadChatCount: nextChannels.length,
        unreadChatChannels: nextChannels,
        chatNotifs,
      };
    }),

  clearAllChatNotifications: () => set({ unreadChatCount: 0, unreadChatChannels: [], chatNotifs: {} }),

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

  loadWorkspace: async (workspaceId, agencyId = null) => {
    if (isDemoMode()) {
      return; // Handled by initDemoWorkspace
    }

    const effectiveAgencyId = agencyId || get().activeAgencyId;

    set({ isLoading: true });
    try {
      const url = effectiveAgencyId
        ? `/os/api/workspaces?agencyId=${effectiveAgencyId}`
        : '/os/api/workspaces';
      const wsRes = await fetch(url);
      if (!wsRes.ok) throw new Error('Failed to fetch workspaces');
      const wsJson = await wsRes.json();
      let workspaces = wsJson.data || [];

      if (workspaces.length === 0) {
        const createRes = await fetch('/os/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Personal Workspace', icon: '🚀' }),
        });
        if (createRes.ok) {
          const newWsJson = await createRes.json();
          const newWs = newWsJson.data;
          workspaces = [newWs];
        }
      }

      set({ workspaces });

      const activeWs = workspaces.find((w) => w.id === workspaceId) || workspaces[0];
      if (!activeWs) return;

      set({ workspace: activeWs });

      const [activePagesRes, archivedPagesRes] = await Promise.all([
        fetch(`/os/api/pages?workspaceId=${activeWs.id}&archived=false`),
        fetch(`/os/api/pages?workspaceId=${activeWs.id}&archived=true`),
      ]);

      let activePages = [];
      let archivedPages = [];

      if (activePagesRes.ok) {
        const activePagesJson = await activePagesRes.json();
        activePages = activePagesJson.data || [];
      }
      if (archivedPagesRes.ok) {
        const archivedPagesJson = await archivedPagesRes.json();
        archivedPages = archivedPagesJson.data || [];
      }

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
      if (pages.length > 0 && !get().currentPage) {
        const rootPages = pages.filter((p) => !p.parentId && !p.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
        set({ currentPage: rootPages[0] || pages[0] });
      }
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
      const res = await fetch('/os/api/pages', {
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
      const createdPageJson = await res.json();
      const createdPage = createdPageJson.data;

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
    if (updates.isPublished !== undefined) dbUpdates.is_published = updates.isPublished;

    try {
      const res = await fetch(`/os/api/pages/${pageId}`, {
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
      const res = await fetch(`/os/api/pages/${pageId}`, {
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
      const res = await fetch(`/os/api/pages/${pageId}`, {
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
      const res = await fetch(`/os/api/pages/${pageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete page');
    } catch (e) {
      console.error('Failed to permanently delete page in database:', e);
    }
  },

  emptyTrash: async () => {
    const archivedIds = get().pages.filter((p) => p.isArchived).map((p) => p.id);
    set((state) => ({
      pages: state.pages.filter((p) => !p.isArchived),
      currentPage: archivedIds.includes(state.currentPage?.id) ? null : state.currentPage,
    }));

    if (isDemoMode()) return;

    await Promise.allSettled(
      archivedIds.map((id) => fetch(`/os/api/pages/${id}`, { method: 'DELETE' }))
    );
  },

  reorderPage: async (pageId, newSortOrder) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, sortOrder: newSortOrder } : p
      ),
    }));

    if (isDemoMode()) return;

    try {
      const res = await fetch(`/os/api/pages/${pageId}`, {
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
      const res = await fetch(`/os/api/pages/${pageId}`, {
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
      const res = await fetch('/os/api/pages', {
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
      const newPageJson = await res.json();
      const newPage = newPageJson.data;

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
        const blocksRes = await fetch(`/os/api/pages/${pageId}/blocks`);
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
            await fetch(`/os/api/pages/${newPage.id}/blocks`, {
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
        title: 'Welcome',
        icon: '👋',
        parentId: null,
        isDatabase: false,
        isArchived: false,
        sortOrder: 0,
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
