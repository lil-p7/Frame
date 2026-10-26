import { create } from "zustand";
import type { FramePage } from "@/features/document/model";
import {
  canRedo,
  canUndo,
  clearPageHistory,
  recordHistory,
  type HistoryState,
} from "@/features/document/history";

/**
 * Editor history store (spec §13C/§14).
 *
 * Holds per-page undo/redo snapshots for the current editing session — never
 * persisted, and never part of the document. Commands record history only
 * after their save succeeds; undo/redo transitions are committed through
 * `replace` so a failed save can roll the stacks back (document state and
 * history stay consistent, spec §14).
 */
interface HistoryStoreState {
  pages: HistoryState;
  /** Records a successful command's `before` snapshot on its page. */
  record: (pageId: string, before: FramePage, coalesceKey?: string | null) => void;
  /** Applies a computed transition (undo/redo commit or rollback). */
  replace: (pages: HistoryState) => void;
  clearPage: (pageId: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryStoreState>()((set) => ({
  pages: {},
  record: (pageId, before, coalesceKey = null) =>
    set((state) => ({ pages: recordHistory(state.pages, pageId, before, { coalesceKey }) })),
  replace: (pages) => set({ pages }),
  clearPage: (pageId) => set((state) => ({ pages: clearPageHistory(state.pages, pageId) })),
  clearAll: () => set({ pages: {} }),
}));

/** Reactive undo availability for one page (toolbar disabled state). */
export function useCanUndo(pageId: string | null): boolean {
  return useHistoryStore((state) => pageId !== null && canUndo(state.pages, pageId));
}

/** Reactive redo availability for one page. */
export function useCanRedo(pageId: string | null): boolean {
  return useHistoryStore((state) => pageId !== null && canRedo(state.pages, pageId));
}

/** Test/reset helper: forgets every page's history. */
export function resetHistory(): void {
  useHistoryStore.setState({ pages: {} });
}
