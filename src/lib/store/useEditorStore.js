'use client';

import { create } from 'zustand';
import { useWorkspaceStore } from './useWorkspaceStore';

const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/demo');
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
      await fetch(`/api/pages/${pageId}/blocks/${blockId}`, {
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

  // ── Actions ──────────────────────────────────

  setBlocks: (blocks) => set((state) => setBlocksState(state, blocks)),

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
    const orderedIds = get().blocks.map((b) => b.id);
    try {
      await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
    } catch (e) {
      console.error('Failed to sync block order:', e);
    }
  },

  addBlock: async (block, afterBlockId = null) => {
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

    const tempId = crypto.randomUUID();
    const optimisticBlock = {
      id: tempId,
      pageId,
      type: block.type || 'paragraph',
      content: block.content || { text: '' },
      properties: block.properties || {},
      parentBlockId: resolvedParentBlockId,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let newBlocks = [];
    if (afterBlockId) {
      const index = get().blocks.findIndex((b) => b.id === afterBlockId);
      newBlocks = [...get().blocks];
      newBlocks.splice(index + 1, 0, optimisticBlock);
      newBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));
    } else {
      newBlocks = [...get().blocks, { ...optimisticBlock, sortOrder: get().blocks.length }];
    }

    set((state) => ({
      ...setBlocksState(state, newBlocks, pageId),
      activeBlockId: tempId,
    }));

    if (isDemoMode()) {
      return;
    }

    try {
      const res = await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: optimisticBlock.type,
          content: optimisticBlock.content,
          properties: optimisticBlock.properties,
          parentBlockId: optimisticBlock.parentBlockId,
          sortOrder: optimisticBlock.sortOrder,
        }),
      });

      if (!res.ok) throw new Error('Failed to add block');
      const createdBlock = await res.json();

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

  updateBlock: (blockId, updates) => {
    const pageId = get().blocks.find((b) => b.id === blockId)?.pageId || useWorkspaceStore.getState().currentPage?.id;
    if (!pageId) return;

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

    if (isDemoMode()) return;

    try {
      for (const id of toDelete) {
        await fetch(`/api/pages/${pageId}/blocks/${id}`, { method: 'DELETE' });
      }
      if (pageId) {
        get().syncBlockOrder(pageId);
      }
    } catch (e) {
      console.error('Failed to delete blocks from database:', e);
    }
  },

  moveBlock: async (blockId, newIndex) => {
    const blocks = [...get().blocks];
    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    if (currentIndex === -1) return;

    const pageId = blocks[0]?.pageId || useWorkspaceStore.getState().currentPage?.id;

    const [movedBlock] = blocks.splice(currentIndex, 1);
    blocks.splice(newIndex, 0, movedBlock);
    const newBlocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));

    set((state) => setBlocksState(state, newBlocks, pageId));

    if (isDemoMode()) return;

    if (pageId) {
      get().syncBlockOrder(pageId);
    }
  },

  duplicateBlock: async (blockId) => {
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
        await fetch(`/api/pages/${pageId}/blocks`, {
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
      if (pageId) {
        get().syncBlockOrder(pageId);
      }
    } catch (e) {
      console.error('Failed to save duplicated blocks to database:', e);
    }
  },

  changeBlockType: async (blockId, newType) => {
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
      await fetch(`/api/pages/${pageId}/blocks/${blockId}`, {
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
    set({ isSaving: true });
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

        const page = useWorkspaceStore.getState().pages.find((p) => p.id === pageId);
        let seededBlocks = [];

        if (page?.title === 'Getting Started') {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'h1', content: { text: 'Welcome to ImpactNotion! 👋' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'ImpactNotion is a workspace platform that combines flexible document editing with powerful databases, custom dashboards, and public publishing. Here are a few things to try:' }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Type / in an empty block to open the slash command menu.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Select any text to open the floating formatting toolbar.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Click the + button in the sidebar to create your own pages.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'callout', content: { text: '💡 Tip: You can navigate between blocks using the Up and Down arrow keys on your keyboard!' }, properties: { color: 'blue' }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Pre-built Community Modules' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'We have pre-configured 5 custom databases for Impact360 operations. Go ahead and explore them in the sidebar:' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '🏢 Agencies: View partners, their onboarding checklist, and revenue breakdown.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '💰 Asset Tracker: Track community vehicles and gear, and log operational income in real-time.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '📅 Event Manager: View budget utilization and upcoming community drives.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '👥 Member Directory: Quick-filter staff and volunteers by their skill sets.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '💬 WhatsApp Groups: Coordinate invite links and track active member counts.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'divider', content: {}, pageId },
            { id: crypto.randomUUID(), type: 'h3', content: { text: 'Real-time updates' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'Any edits you make inside the dashboards or database tables persist instantly. Go ahead and try it out!' }, pageId }
          ];
        } else if (page?.title === 'Meeting Notes') {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'h1', content: { text: 'Weekly Sync - May 28, 2026 📝' }, pageId },
            { id: crypto.randomUUID(), type: 'callout', content: { text: 'Attendees: Erick Omondi, Faith Mutua, John Doe, Grace Wanjiku' }, properties: { color: 'blue' }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Agenda' }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Review budget utilization for Youth Leadership Summit 2026' }, properties: { checked: true }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Follow up with Summit Digital agency onboarding' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Update members directory with new volunteer skills list' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Log recent rental income for Toyota Hiace van' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Notes' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'Erick mentioned we need to make sure all WhatsApp group invite links are active. Faith will verify the volunteer group link and update it in the WhatsApp Groups database.' }, pageId }
          ];
        } else {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: '' }, properties: {}, parentBlockId: null, sortOrder: 0, pageId }
          ];
        }

        const finalBlocks = seededBlocks.map((b, i) => ({ ...b, sortOrder: i }));

        set((state) => ({
          blocks: finalBlocks,
          activeBlockId: finalBlocks[0]?.id || null,
          blocksByPage: {
            ...(state.blocksByPage || {}),
            [pageId]: finalBlocks,
          },
        }));
        return;
      }

      const res = await fetch(`/api/pages/${pageId}/blocks`);
      if (!res.ok) throw new Error('Failed to fetch blocks');
      const data = await res.json();

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

      if (blocks.length === 0) {
        const page = useWorkspaceStore.getState().pages.find((p) => p.id === pageId);
        let seededBlocks = [];

        if (page?.title === 'Getting Started') {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'h1', content: { text: 'Welcome to ImpactNotion! 👋' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'ImpactNotion is a workspace platform that combines flexible document editing with powerful databases, custom dashboards, and public publishing. Here are a few things to try:' }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Type / in an empty block to open the slash command menu.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Select any text to open the floating formatting toolbar.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Click the + button in the sidebar to create your own pages.' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'callout', content: { text: '💡 Tip: You can navigate between blocks using the Up and Down arrow keys on your keyboard!' }, properties: { color: 'blue' }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Pre-built Community Modules' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'We have pre-configured 5 custom databases for Impact360 operations. Go ahead and explore them in the sidebar:' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '🏢 Agencies: View partners, their onboarding checklist, and revenue breakdown.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '💰 Asset Tracker: Track community vehicles and gear, and log operational income in real-time.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '📅 Event Manager: View budget utilization and upcoming community drives.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '👥 Member Directory: Quick-filter staff and volunteers by their skill sets.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'list', content: { text: '💬 WhatsApp Groups: Coordinate invite links and track active member counts.' }, properties: { listType: 'bullet' }, pageId },
            { id: crypto.randomUUID(), type: 'divider', content: {}, pageId },
            { id: crypto.randomUUID(), type: 'h3', content: { text: 'Real-time updates' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'Any edits you make inside the dashboards or database tables persist instantly. Go ahead and try it out!' }, pageId }
          ];
        } else if (page?.title === 'Meeting Notes') {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'h1', content: { text: 'Weekly Sync - May 28, 2026 📝' }, pageId },
            { id: crypto.randomUUID(), type: 'callout', content: { text: 'Attendees: Erick Omondi, Faith Mutua, John Doe, Grace Wanjiku' }, properties: { color: 'blue' }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Agenda' }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Review budget utilization for Youth Leadership Summit 2026' }, properties: { checked: true }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Follow up with Summit Digital agency onboarding' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Update members directory with new volunteer skills list' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'checkbox', content: { text: 'Log recent rental income for Toyota Hiace van' }, properties: { checked: false }, pageId },
            { id: crypto.randomUUID(), type: 'h2', content: { text: 'Notes' }, pageId },
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: 'Erick mentioned we need to make sure all WhatsApp group invite links are active. Faith will verify the volunteer group link and update it in the WhatsApp Groups database.' }, pageId }
          ];
        } else {
          seededBlocks = [
            { id: crypto.randomUUID(), type: 'paragraph', content: { text: '' }, properties: {}, parentBlockId: null, sortOrder: 0, pageId }
          ];
        }

        const finalBlocks = seededBlocks.map((b, i) => ({ ...b, sortOrder: i }));

        for (const b of finalBlocks) {
          await fetch(`/api/pages/${pageId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: b.type,
              content: b.content,
              properties: b.properties,
              parentBlockId: b.parentBlockId,
              sortOrder: b.sortOrder,
            }),
          });
        }

        blocks = finalBlocks;
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
    } finally {
      set({ isSaving: false });
    }
  },

  // ── Save state ──
  setSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (time) => set({ lastSaved: time }),
}));
