'use client';

import { create } from 'zustand';

// A single "active undo controller" the top-bar Undo/Redo buttons delegate to.
// A view with its own history (e.g. the Acquisition panel) registers a controller
// while mounted; the top bar prefers it over the page-editor's undo/redo, and
// falls back to the editor when nothing is registered.
//
// controller shape: { undo:fn, redo:fn, canUndo:bool, canRedo:bool, label?:string }
export const useUndoStore = create((set) => ({
  controller: null,
  setController: (controller) => set({ controller }),
  clearController: () => set((s) => (s.controller ? { controller: null } : s)),
}));
