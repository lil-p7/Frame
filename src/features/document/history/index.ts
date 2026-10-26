import type { FramePage } from "@/features/document/model";

/**
 * Undo/redo history over document snapshots (spec §14).
 *
 * Pages are immutable by construction — every command builds a new page and
 * shares unchanged subtrees — so a snapshot is just a reference to a previous
 * page. History is kept **per page**: editing page B then undoing on page A
 * can never apply one page's history to another (spec §14 history rules).
 *
 * Coalescing: continuous edits (typing, dragging a color picker) are recorded
 * with the same `coalesceKey`; while consecutive records share that key inside
 * `COALESCE_WINDOW_MS` no new snapshot is pushed, so the whole burst undoes as
 * one operation. A different key, a pause, or any undo/redo ends the group.
 */

/** Maximum snapshots kept per page (spec §14: bounded 50–100 operations). */
export const HISTORY_LIMIT = 80;

/** Consecutive edits sharing a key within this window undo together. */
export const COALESCE_WINDOW_MS = 1000;

export interface PageHistory {
  /** Snapshots taken before each reversible operation, oldest first. */
  past: FramePage[];
  /** Snapshots undone, most recently undone first. */
  future: FramePage[];
  /** Coalescing key of the most recent operation, or null. */
  lastKey: string | null;
  /** Timestamp of the most recent operation (for the coalescing window). */
  lastRecordedAt: number;
}

/** History per page ID. Pages absent from the map have empty history. */
export type HistoryState = Readonly<Record<string, PageHistory>>;

const EMPTY_PAGE_HISTORY: PageHistory = {
  past: [],
  future: [],
  lastKey: null,
  lastRecordedAt: 0,
};

function entryFor(state: HistoryState, pageId: string): PageHistory {
  return state[pageId] ?? EMPTY_PAGE_HISTORY;
}

export interface RecordHistoryOptions {
  /**
   * Identity of a continuous edit (e.g. one prop of one node). Records with
   * the same key inside the coalescing window replace no snapshot, so the
   * burst collapses into one undo step.
   */
  coalesceKey?: string | null;
  /** Injectable clock for tests. */
  now?: number;
}

/**
 * Records the snapshot `before` a successful document command.
 *
 * A new operation after an undo clears the redo branch (spec §14). Bounded
 * by `HISTORY_LIMIT`: the oldest snapshot is dropped when the limit is hit.
 */
export function recordHistory(
  state: HistoryState,
  pageId: string,
  before: FramePage,
  options: RecordHistoryOptions = {},
): HistoryState {
  const entry = entryFor(state, pageId);
  const now = options.now ?? Date.now();
  const key = options.coalesceKey ?? null;

  // Same continuous edit still in progress: keep the original snapshot.
  if (
    key !== null &&
    entry.lastKey === key &&
    entry.past.length > 0 &&
    now - entry.lastRecordedAt <= COALESCE_WINDOW_MS
  ) {
    return { ...state, [pageId]: { ...entry, lastRecordedAt: now } };
  }

  const past = [...entry.past, before];
  return {
    ...state,
    [pageId]: {
      // A fresh operation invalidates the redo branch.
      past: past.slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key,
      lastRecordedAt: now,
    },
  };
}

/** The page to restore plus the history state that results from doing so. */
export interface HistoryTransition {
  state: HistoryState;
  page: FramePage;
}

/** Undoes the last operation on `pageId`, returning null when none exists. */
export function undoHistory(
  state: HistoryState,
  pageId: string,
  current: FramePage,
): HistoryTransition | null {
  const entry = entryFor(state, pageId);
  const page = entry.past.at(-1);
  if (page === undefined) return null;
  return {
    page,
    state: {
      ...state,
      [pageId]: {
        past: entry.past.slice(0, -1),
        future: [current, ...entry.future],
        // Undo/redo ends any coalescing group: the next edit is its own step.
        lastKey: null,
        lastRecordedAt: 0,
      },
    },
  };
}

/** Redoes the most recently undone operation, or returns null. */
export function redoHistory(
  state: HistoryState,
  pageId: string,
  current: FramePage,
): HistoryTransition | null {
  const entry = entryFor(state, pageId);
  const page = entry.future[0];
  if (page === undefined) return null;
  return {
    page,
    state: {
      ...state,
      [pageId]: {
        past: [...entry.past, current].slice(-HISTORY_LIMIT),
        future: entry.future.slice(1),
        lastKey: null,
        lastRecordedAt: 0,
      },
    },
  };
}

export function canUndo(state: HistoryState, pageId: string): boolean {
  return entryFor(state, pageId).past.length > 0;
}

export function canRedo(state: HistoryState, pageId: string): boolean {
  return entryFor(state, pageId).future.length > 0;
}

/** Drops one page's history (used when a page is removed or replaced). */
export function clearPageHistory(state: HistoryState, pageId: string): HistoryState {
  if (!(pageId in state)) return state;
  const next = { ...state };
  delete next[pageId];
  return next;
}
