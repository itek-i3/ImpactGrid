'use client';

import { create } from 'zustand';
import { useWorkspaceStore } from './useWorkspaceStore';

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

  // ── Block CRUD ──

  addBlock: (block, afterBlockId = null) =>
    set((state) => {
      const newBlock = {
        id: block.id || crypto.randomUUID(),
        type: block.type || 'paragraph',
        content: block.content || { text: '' },
        properties: block.properties || {},
        parentBlockId: block.parentBlockId || null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...block,
      };

      let newBlocks = [];
      if (afterBlockId) {
        const index = state.blocks.findIndex((b) => b.id === afterBlockId);
        newBlocks = [...state.blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        newBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));
      } else {
        newBlocks = [...state.blocks, { ...newBlock, sortOrder: state.blocks.length }];
      }

      return {
        ...setBlocksState(state, newBlocks, newBlock.pageId || block.pageId),
        activeBlockId: newBlock.id,
      };
    }),

  updateBlock: (blockId, updates) =>
    set((state) => {
      const newBlocks = state.blocks.map((b) =>
        b.id === blockId
          ? { ...b, ...updates, updatedAt: new Date().toISOString() }
          : b
      );
      return setBlocksState(state, newBlocks);
    }),

  deleteBlock: (blockId) =>
    set((state) => {
      const filtered = state.blocks.filter((b) => b.id !== blockId);
      const newBlocks = filtered.map((b, i) => ({ ...b, sortOrder: i }));
      return {
        ...setBlocksState(state, newBlocks),
        activeBlockId: state.activeBlockId === blockId ? null : state.activeBlockId,
      };
    }),

  moveBlock: (blockId, newIndex) =>
    set((state) => {
      const blocks = [...state.blocks];
      const currentIndex = blocks.findIndex((b) => b.id === blockId);
      if (currentIndex === -1) return state;

      const [movedBlock] = blocks.splice(currentIndex, 1);
      blocks.splice(newIndex, 0, movedBlock);
      const newBlocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));

      return setBlocksState(state, newBlocks);
    }),

  duplicateBlock: (blockId) =>
    set((state) => {
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block) return state;

      const newBlock = {
        ...block,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const index = state.blocks.findIndex((b) => b.id === blockId);
      const newBlocks = [...state.blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      const finalBlocks = newBlocks.map((b, i) => ({ ...b, sortOrder: i }));

      return {
        ...setBlocksState(state, finalBlocks),
        activeBlockId: newBlock.id,
      };
    }),

  changeBlockType: (blockId, newType) =>
    set((state) => {
      const newBlocks = state.blocks.map((b) =>
        b.id === blockId
          ? { ...b, type: newType, updatedAt: new Date().toISOString() }
          : b
      );
      return setBlocksState(state, newBlocks);
    }),

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

  initBlocks: (pageId) => {
    const state = get();
    if (state.blocksByPage && state.blocksByPage[pageId]) {
      set({
        blocks: state.blocksByPage[pageId],
        activeBlockId: state.blocksByPage[pageId][0]?.id || null,
      });
      return;
    }

    // Try to find the page title to seed default content
    const page = useWorkspaceStore.getState().pages.find((p) => p.id === pageId);
    let seededBlocks = [];

    if (page?.title === 'Getting Started') {
      seededBlocks = [
        {
          id: crypto.randomUUID(),
          type: 'h1',
          content: { text: 'Welcome to ImpactNotion! 👋' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: { text: 'ImpactNotion is a workspace platform that combines flexible document editing with powerful databases, custom dashboards, and public publishing. Here are a few things to try:' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Type / in an empty block to open the slash command menu.' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Select any text to open the floating formatting toolbar.' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Click the + button in the sidebar to create your own pages.' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'callout',
          content: { text: '💡 Tip: You can navigate between blocks using the Up and Down arrow keys on your keyboard!' },
          properties: { color: 'blue' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'h2',
          content: { text: 'Pre-built Community Modules' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: { text: 'We have pre-configured 5 custom databases for Impact360 operations. Go ahead and explore them in the sidebar:' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'list',
          content: { text: '🏢 Agencies: View partners, their onboarding checklist, and revenue breakdown.' },
          properties: { listType: 'bullet' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'list',
          content: { text: '💰 Asset Tracker: Track community vehicles and gear, and log operational income in real-time.' },
          properties: { listType: 'bullet' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'list',
          content: { text: '📅 Event Manager: View budget utilization and upcoming community drives.' },
          properties: { listType: 'bullet' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'list',
          content: { text: '👥 Member Directory: Quick-filter staff and volunteers by their skill sets.' },
          properties: { listType: 'bullet' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'list',
          content: { text: '💬 WhatsApp Groups: Coordinate invite links and track active member counts.' },
          properties: { listType: 'bullet' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'divider',
          content: {},
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'h3',
          content: { text: 'Real-time updates' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: { text: 'Any edits you make inside the dashboards or database tables persist instantly. Go ahead and try it out!' },
          pageId,
        },
      ];
    } else if (page?.title === 'Meeting Notes') {
      seededBlocks = [
        {
          id: crypto.randomUUID(),
          type: 'h1',
          content: { text: 'Weekly Sync - May 28, 2026 📝' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'callout',
          content: { text: 'Attendees: Erick Omondi, Faith Mutua, John Doe, Grace Wanjiku' },
          properties: { color: 'blue' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'h2',
          content: { text: 'Agenda' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Review budget utilization for Youth Leadership Summit 2026' },
          properties: { checked: true },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Follow up with Summit Digital agency onboarding' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Update members directory with new volunteer skills list' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'checkbox',
          content: { text: 'Log recent rental income for Toyota Hiace van' },
          properties: { checked: false },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'h2',
          content: { text: 'Notes' },
          pageId,
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: { text: 'Erick mentioned we need to make sure all WhatsApp group invite links are active. Faith will verify the volunteer group link and update it in the WhatsApp Groups database.' },
          pageId,
        },
      ];
    } else {
      seededBlocks = [
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: { text: '' },
          properties: {},
          parentBlockId: null,
          sortOrder: 0,
          pageId,
        },
      ];
    }

    const finalBlocks = seededBlocks.map((b, i) => ({ ...b, sortOrder: i }));

    set({
      blocks: finalBlocks,
      activeBlockId: finalBlocks[0]?.id || null,
      blocksByPage: {
        ...(state.blocksByPage || {}),
        [pageId]: finalBlocks,
      },
    });
  },

  // ── Save state ──
  setSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (time) => set({ lastSaved: time }),
}));
