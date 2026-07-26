'use client';

import { create } from 'zustand';
import { useWorkspaceStore } from './useWorkspaceStore';

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

// Module-level debounce timer map
const debounceTimers = {};

const saveBlockDebounced = (blockId, pageId, updates) => {
  if (isDemoMode()) return;
  if (debounceTimers[blockId]) {
    clearTimeout(debounceTimers[blockId]);
  }
  debounceTimers[blockId] = setTimeout(async () => {
    delete debounceTimers[blockId];
    try {
      await fetch(`/os/api/pages/${pageId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.error('Failed to auto-save block:', e);
    }
  }, 1000);
};

/**
 * Helper to update both the flat `blocks` array and the page-mapped `blocksByPage` dictionary.
 */
const setBlocksState = (state, newBlocks, pageId) => {
  const activePageId = pageId || state.blocks[0]?.pageId || state.activeBlockId;
  if (!activePageId) return { blocks: newBlocks };
  return {
    blocks: newBlocks,
    blocksByPage: {
      ...state.blocksByPage,
      [activePageId]: newBlocks,
    },
  };
};

/**
 * Helper to recursively find all descendant IDs of a block.
 */
const getDescendantIds = (blocks, parentId) => {
  let ids = [];
  const children = blocks.filter((b) => b.parentBlockId === parentId);
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getDescendantIds(blocks, child.id));
  }
  return ids;
};

/**
 * Editor store — manages block editor state for the current page.
 * Each page has an ordered list of blocks with content and properties.
 */
export const useEditorStore = create((set, get) => ({
  // Current page's blocks
  blocks: [],
  blocksByPage: {}, // Mapped by pageId for persistent demo editing
  activeBlockId: null,
  selectedBlockIds: new Set(),
  isEditing: false,
  isSaving: false,
  lastSaved: null,

  // Command palette
  commandMenuOpen: false,
  commandMenuBlockId: null,

  // Toolbar
  toolbarVisible: false,
  toolbarPosition: { top: 0, left: 0 },

  // ── Global undo/redo (tracks page block snapshots) ──
  _historyStack: [],   // Array<Array<Block>>
  _futureStack: [],
  _skipHistory: false,
  _lastHistoryTime: 0,

  pushHistory: () => {
    if (get()._skipHistory) return;
    const now = Date.now();
    const currentBlocks = get().blocks;
    if (!currentBlocks || currentBlocks.length === 0) return;
    const snapshot = JSON.parse(JSON.stringify(currentBlocks));
    set((s) => ({
      _historyStack: [...s._historyStack.slice(-49), snapshot],
      _futureStack: [],
      _lastHistoryTime: now,
    }));
  },

  undo: () => {
    const { _historyStack, blocks } = get();
    if (_historyStack.length === 0) return;
    const prevBlocks = _historyStack[_historyStack.length - 1];
    const currentSnapshot = JSON.parse(JSON.stringify(blocks));
    const pageId = blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;

    set((s) => ({
      _historyStack: s._historyStack.slice(0, -1),
      _futureStack: [...s._futureStack, currentSnapshot],
      _skipHistory: true,
    }));

    if (pageId) {
      set((s) => setBlocksState(s, prevBlocks, pageId));
      if (!isDemoMode()) {
        get().syncBlockOrder(pageId);
        prevBlocks.forEach((b) => {
          saveBlockDebounced(b.id, pageId, { type: b.type, content: b.content, properties: b.properties });
        });
      }
    } else {
      set({ blocks: prevBlocks });
    }

    set({ _skipHistory: false });
  },

  redo: () => {
    const { _futureStack, blocks } = get();
    if (_futureStack.length === 0) return;
    const nextBlocks = _futureStack[_futureStack.length - 1];
    const currentSnapshot = JSON.parse(JSON.stringify(blocks));
    const pageId = blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;

    set((s) => ({
      _futureStack: s._futureStack.slice(0, -1),
      _historyStack: [...s._historyStack, currentSnapshot],
      _skipHistory: true,
    }));

    if (pageId) {
      set((s) => setBlocksState(s, nextBlocks, pageId));
      if (!isDemoMode()) {
        get().syncBlockOrder(pageId);
        nextBlocks.forEach((b) => {
          saveBlockDebounced(b.id, pageId, { type: b.type, content: b.content, properties: b.properties });
        });
      }
    } else {
      set({ blocks: nextBlocks });
    }

    set({ _skipHistory: false });
  },

  // ── Actions ──────────────────────────────────

  setBlocks: (blocks) => set((state) => setBlocksState(state, blocks)),

  seedBlocksForPage: (pageId, blocks) =>
    set((state) => ({
      blocksByPage: { ...(state.blocksByPage || {}), [pageId]: blocks },
    })),

  setActiveBlock: (blockId) => set({ activeBlockId: blockId }),

  setEditing: (isEditing) => set({ isEditing }),

  openCommandMenu: (blockId) =>
    set({ commandMenuOpen: true, commandMenuBlockId: blockId }),

  closeCommandMenu: () =>
    set({ commandMenuOpen: false, commandMenuBlockId: null }),

  showToolbar: (position) =>
    set({ toolbarVisible: true, toolbarPosition: position }),

  hideToolbar: () => set({ toolbarVisible: false }),

  // ── Block CRUD (connected to REST APIs) ──

  syncBlockOrder: async (pageId) => {
    if (isDemoMode()) return;
    const pageBlocks = get().blocksByPage?.[pageId] || get().blocks.filter((b) => b.pageId === pageId);
    const orderedIds = pageBlocks.map((b) => b.id);
    if (!orderedIds || orderedIds.length === 0) return;

    try {
      await fetch(`/os/api/pages/${pageId}/blocks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
    } catch (e) {
      console.error('Failed to sync block order:', e);
    }
  },

  addBlock: async (block, afterBlockId = null) => {
    get().pushHistory();
    const pageId = block.pageId || get().blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;
    if (!pageId) return;

    let resolvedParentBlockId = block.parentBlockId;
    if (resolvedParentBlockId === undefined) {
      if (afterBlockId) {
        const afterBlock = get().blocks.find((b) => b.id === afterBlockId);
        resolvedParentBlockId = afterBlock ? afterBlock.parentBlockId : null;
      } else {
        resolvedParentBlockId = null;
      }
    }

    const calculatedSortOrder = afterBlockId
      ? get().blocks.findIndex((b) => b.id === afterBlockId) + 1
      : get().blocks.length;

    const tempId = block.id || crypto.randomUUID();
    const optimisticBlock = {
      id: tempId,
      pageId,
      type: block.type || 'paragraph',
      content: block.content || { text: '' },
      properties: block.properties || {},
      parentBlockId: resolvedParentBlockId,
      sortOrder: calculatedSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let newBlocks = [];
    if (afterBlockId) {
      const index = get().blocks.findIndex((b) => b.id === afterBlockId);
      newBlocks = [...get().blocks];
      if (index !== -1) {
        newBlocks.splice(index + 1, 0, optimisticBlock);
      } else {
        newBlocks.push(optimisticBlock);
      }
      newBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));
    } else {
      newBlocks = [...get().blocks, optimisticBlock];
    }

    set((state) => ({
      ...setBlocksState(state, newBlocks, pageId),
      activeBlockId: tempId,
    }));

    if (isDemoMode()) {
      return;
    }

    try {
      const res = await fetch(`/os/api/pages/${pageId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: optimisticBlock.id,
          type: optimisticBlock.type,
          content: optimisticBlock.content,
          properties: optimisticBlock.properties,
          parentBlockId: optimisticBlock.parentBlockId,
          sortOrder: optimisticBlock.sortOrder,
        }),
      });

      if (!res.ok) throw new Error('Failed to add block');
      const createdBlockJson = await res.json();
      const createdBlock = createdBlockJson.data;

      set((state) => {
        const finalBlocks = state.blocks.map((b) =>
          b.id === tempId
            ? {
                id: createdBlock.id,
                pageId: createdBlock.page_id,
                parentBlockId: createdBlock.parent_block_id,
                type: createdBlock.type,
                content: createdBlock.content,
                properties: createdBlock.properties,
                sortOrder: createdBlock.sort_order,
                createdAt: createdBlock.created_at,
                updatedAt: createdBlock.updated_at,
              }
            : b
        );
        return {
          ...setBlocksState(state, finalBlocks, pageId),
          activeBlockId: createdBlock.id,
        };
      });

      if (afterBlockId) {
        get().syncBlockOrder(pageId);
      }
    } catch (e) {
      console.error('Failed to add block to database:', e);
      set((state) => ({
        ...setBlocksState(state, get().blocks.filter((b) => b.id !== tempId), pageId),
        activeBlockId: get().activeBlockId === tempId ? null : get().activeBlockId,
      }));
    }
  },

  addBlocks: async (blocksArray, afterBlockId = null) => {
    if (!blocksArray || blocksArray.length === 0) return [];
    get().pushHistory();

    const firstBlock = blocksArray[0];
    const pageId = firstBlock.pageId || get().blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;
    if (!pageId) return [];

    const currentBlocks = get().blocks;
    let targetIndex = afterBlockId ? currentBlocks.findIndex((b) => b.id === afterBlockId) : currentBlocks.length - 1;
    if (targetIndex === -1) targetIndex = currentBlocks.length - 1;

    let resolvedParentBlockId = firstBlock.parentBlockId;
    if (resolvedParentBlockId === undefined) {
      if (afterBlockId) {
        const afterBlock = currentBlocks.find((b) => b.id === afterBlockId);
        resolvedParentBlockId = afterBlock ? afterBlock.parentBlockId : null;
      } else {
        resolvedParentBlockId = null;
      }
    }

    const newBlocks = [...currentBlocks];
    const insertAt = targetIndex + 1;

    const tempCreated = blocksArray.map((b) => ({
      id: b.id || crypto.randomUUID(),
      pageId,
      type: b.type || 'paragraph',
      content: b.content || { text: '' },
      properties: b.properties || {},
      parentBlockId: b.parentBlockId !== undefined ? b.parentBlockId : resolvedParentBlockId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    newBlocks.splice(insertAt, 0, ...tempCreated);
    const finalBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));
    const createdBlocks = finalBlocks.slice(insertAt, insertAt + tempCreated.length);

    set((state) => ({
      ...setBlocksState(state, finalBlocks, pageId),
      activeBlockId: createdBlocks[createdBlocks.length - 1].id,
    }));

    if (!isDemoMode()) {
      try {
        for (const b of createdBlocks) {
          await fetch(`/os/api/pages/${pageId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: b.id,
              type: b.type,
              content: b.content,
              properties: b.properties,
              parentBlockId: b.parentBlockId,
              sortOrder: b.sortOrder,
            }),
          });
        }
        if (pageId) {
          await get().syncBlockOrder(pageId);
        }
      } catch (e) {
        console.error('Failed to add blocks batch to database:', e);
      }
    }

    return createdBlocks;
  },

  moveBlock: async (draggedId, targetId, position = 'after') => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    get().pushHistory();

    const currentBlocks = [...get().blocks];
    const draggedIndex = currentBlocks.findIndex((b) => b.id === draggedId);
    if (draggedIndex === -1) return;

    const [draggedBlock] = currentBlocks.splice(draggedIndex, 1);

    let targetIndex = currentBlocks.findIndex((b) => b.id === targetId);
    if (targetIndex === -1) targetIndex = currentBlocks.length;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    currentBlocks.splice(insertIndex, 0, draggedBlock);

    const pageId = draggedBlock.pageId || get().blocks[0]?.pageId;
    const finalBlocks = currentBlocks.map((b, i) => ({ ...b, sortOrder: i }));

    set((state) => setBlocksState(state, finalBlocks, pageId));

    if (!isDemoMode() && pageId) {
      await get().syncBlockOrder(pageId);
    }
  },

  updateBlock: (blockId, updates) => {
    const pageId = get().blocks.find((b) => b.id === blockId)?.pageId || useWorkspaceStore.getState().currentPage?.id;
    if (!pageId) return;

    if (!get()._skipHistory && (updates.content !== undefined || updates.properties !== undefined || updates.type !== undefined)) {
      const now = Date.now();
      const lastTime = get()._lastHistoryTime || 0;
      if (now - lastTime > 800 || updates.type !== undefined) {
        get().pushHistory();
      }
    }

    set((state) => {
      const newBlocks = state.blocks.map((b) =>
        b.id === blockId
          ? { ...b, ...updates, updatedAt: new Date().toISOString() }
          : b
      );
      return setBlocksState(state, newBlocks, pageId);
    });

    // Auto-save debounced
    saveBlockDebounced(blockId, pageId, updates);
  },

  deleteBlock: async (blockId) => {
    get().pushHistory();
    const state = get();
    const descendants = getDescendantIds(state.blocks, blockId);
    const toDelete = new Set([blockId, ...descendants]);
    const pageId = state.blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;

    const filtered = state.blocks.filter((b) => !toDelete.has(b.id));
    const newBlocks = filtered.map((b, i) => ({ ...b, sortOrder: i }));

    set((state) => ({
      ...setBlocksState(state, newBlocks, pageId),
      activeBlockId: toDelete.has(state.activeBlockId) ? null : state.activeBlockId,
    }));

    if (!isDemoMode()) {
      try {
        for (const id of toDelete) {
          await fetch(`/os/api/pages/${pageId}/blocks/${id}`, { method: 'DELETE' });
        }
        if (pageId) {
          get().syncBlockOrder(pageId);
        }
      } catch (e) {
        console.error('Failed to delete blocks from database:', e);
      }
    }
  },

  deleteSelectedBlocks: async (blockIds) => {
    if (!blockIds || blockIds.length === 0) return;
    get().pushHistory();
    const state = get();

    const allToDelete = new Set();
    blockIds.forEach((id) => {
      allToDelete.add(id);
      const descendants = getDescendantIds(state.blocks, id);
      descendants.forEach((d) => allToDelete.add(d));
    });

    const pageId = state.blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;
    let filtered = state.blocks.filter((b) => !allToDelete.has(b.id));

    if (filtered.length === 0 && pageId) {
      const pId = crypto.randomUUID();
      filtered = [
        {
          id: pId,
          pageId,
          type: 'paragraph',
          content: { text: '' },
          properties: {},
          parentBlockId: null,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    } else {
      filtered = filtered.map((b, i) => ({ ...b, sortOrder: i }));
    }

    set((state) => ({
      ...setBlocksState(state, filtered, pageId),
      activeBlockId: allToDelete.has(state.activeBlockId) ? null : state.activeBlockId,
    }));

    if (!isDemoMode()) {
      try {
        for (const id of allToDelete) {
          await fetch(`/os/api/pages/${pageId}/blocks/${id}`, { method: 'DELETE' });
        }
        if (pageId) {
          get().syncBlockOrder(pageId);
        }
      } catch (e) {
        console.error('Failed to batch delete blocks from database:', e);
      }
    }
  },

  duplicateBlock: async (blockId) => {
    get().pushHistory();
    const state = get();
    const block = state.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const pageId = block.pageId || useWorkspaceStore.getState().currentPage?.id;
    const descendants = getDescendantIds(state.blocks, blockId);
    const descendantBlocks = state.blocks.filter((b) => descendants.includes(b.id));

    const idMap = { [blockId]: crypto.randomUUID() };
    descendants.forEach((dId) => { idMap[dId] = crypto.randomUUID(); });

    const duplicateOne = (b, newParentId) => ({
      ...b,
      id: idMap[b.id],
      parentBlockId: newParentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const newBlocksToInsert = [];
    const newRootBlock = duplicateOne(block, block.parentBlockId);
    newBlocksToInsert.push(newRootBlock);

    const recurseDuplicate = (oldParentId, newParentId) => {
      const children = descendantBlocks.filter((b) => b.parentBlockId === oldParentId);
      children.forEach((child) => {
        const newChild = duplicateOne(child, newParentId);
        newBlocksToInsert.push(newChild);
        recurseDuplicate(child.id, newChild.id);
      });
    };

    recurseDuplicate(blockId, newRootBlock.id);

    const index = state.blocks.findIndex((b) => b.id === blockId);
    let insertIndex = index;
    descendants.forEach((dId) => {
      const dIndex = state.blocks.findIndex((b) => b.id === dId);
      if (dIndex > insertIndex) insertIndex = dIndex;
    });

    const newBlocks = [...state.blocks];
    newBlocks.splice(insertIndex + 1, 0, ...newBlocksToInsert);
    const finalBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));

    set((state) => ({
      ...setBlocksState(state, finalBlocks, pageId),
      activeBlockId: newRootBlock.id,
    }));

    if (isDemoMode()) return;

    try {
      for (const b of newBlocksToInsert) {
        await fetch(`/os/api/pages/${pageId}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: b.id,
            type: b.type,
            content: b.content,
            properties: b.properties,
            parentBlockId: b.parentBlockId,
            sortOrder: b.sortOrder,
          }),
        });
      }
      if (pageId) {
        get().syncBlockOrder(pageId);
      }
    } catch (e) {
      console.error('Failed to save duplicated blocks to database:', e);
    }
  },

  changeBlockType: async (blockId, newType) => {
    get().pushHistory();
    const pageId = get().blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;

    set((state) => {
      const newBlocks = state.blocks.map((b) =>
        b.id === blockId
          ? { ...b, type: newType, updatedAt: new Date().toISOString() }
          : b
      );
      return setBlocksState(state, newBlocks, pageId);
    });

    if (isDemoMode()) return;

    try {
      await fetch(`/os/api/pages/${pageId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType }),
      });
    } catch (e) {
      console.error('Failed to update block type in database:', e);
    }
  },

  // ── Selection ──

  toggleBlockSelection: (blockId) =>
    set((state) => {
      const selected = new Set(state.selectedBlockIds);
      if (selected.has(blockId)) {
        selected.delete(blockId);
      } else {
        selected.add(blockId);
      }
      return { selectedBlockIds: selected };
    }),

  clearSelection: () => set({ selectedBlockIds: new Set() }),

  selectAll: () =>
    set((state) => ({
      selectedBlockIds: new Set(state.blocks.map((b) => b.id)),
    })),

  // ── Initialize with default blocks ──

  initBlocks: async (pageId) => {
    set({ isSaving: true, _historyStack: [], _futureStack: [] });
    try {
      if (isDemoMode()) {
        const cached = get().blocksByPage?.[pageId];
        if (cached && cached.length > 0) {
          set({
            blocks: cached,
            activeBlockId: cached[0]?.id || null,
          });
          return;
        }

        const seededBlocks = [
          { id: crypto.randomUUID(), type: 'paragraph', content: { text: '' }, properties: {}, parentBlockId: null, sortOrder: 0, pageId }
        ];

        set((state) => ({
          blocks: seededBlocks,
          activeBlockId: seededBlocks[0]?.id || null,
          blocksByPage: {
            ...(state.blocksByPage || {}),
            [pageId]: seededBlocks,
          },
        }));
        return;
      }

      const res = await fetch(`/os/api/pages/${pageId}/blocks`);
      if (!res.ok) {
        // Page may not exist in DB (e.g. locally-injected page) — use cache if available
        const cached = get().blocksByPage?.[pageId];
        if (cached && cached.length > 0) {
          set({ blocks: cached, activeBlockId: cached[0]?.id || null });
        }
        return;
      }
      const dataJson = await res.json();
      const data = dataJson.data || [];

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

      let blocks = data.map(mapBlockFromDb);
      blocks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      if (blocks.length === 0) {
        // Check local cache before seeding an empty paragraph
        const cached = get().blocksByPage?.[pageId];
        if (cached && cached.length > 0) {
          set((state) => ({
            blocks: cached,
            activeBlockId: cached[0]?.id || null,
            blocksByPage: { ...(state.blocksByPage || {}), [pageId]: cached },
          }));
          return;
        }

        const seededBlocks = [
          { id: crypto.randomUUID(), type: 'paragraph', content: { text: '' }, properties: {}, parentBlockId: null, sortOrder: 0, pageId }
        ];

        await fetch(`/os/api/pages/${pageId}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'paragraph',
            content: { text: '' },
            properties: {},
            parentBlockId: null,
            sortOrder: 0,
          }),
        });

        blocks = seededBlocks;
      }

      set((state) => ({
        blocks,
        activeBlockId: blocks[0]?.id || null,
        blocksByPage: {
          ...(state.blocksByPage || {}),
          [pageId]: blocks,
        },
      }));
    } catch (e) {
      console.error('Failed to initialize blocks:', e);
      // Fallback to local cache on unexpected errors
      const cached = get().blocksByPage?.[pageId];
      if (cached && cached.length > 0) {
        set({ blocks: cached, activeBlockId: cached[0]?.id || null });
      }
    } finally {
      set({ isSaving: false });
    }
  },

  // ── Save state ──
  setSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (time) => set({ lastSaved: time }),
}));
