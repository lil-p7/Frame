import { describe, expect, it } from "vitest";
import { createRootNode, type FramePage } from "@/features/document/model";
import {
  COALESCE_WINDOW_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  clearPageHistory,
  recordHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "@/features/document/history";

function page(id: string): FramePage {
  return {
    id,
    name: "Home",
    slug: "home",
    root: createRootNode(`root-${id}`),
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}

const pageOne = page("page-1");
const pageTwo = page("page-2");

describe("history model (spec §14)", () => {
  it("records a snapshot, undoes it, and redoes the same page identity", () => {
    const before = page("v1");
    const after = page("v2");
    let state: HistoryState = recordHistory({}, pageOne.id, before);
    expect(canUndo(state, pageOne.id)).toBe(true);
    expect(canRedo(state, pageOne.id)).toBe(false);

    const undone = undoHistory(state, pageOne.id, after);
    expect(undone).not.toBeNull();
    expect(undone!.page).toEqual(before);
    expect(canUndo(undone!.state, pageOne.id)).toBe(false);
    expect(canRedo(undone!.state, pageOne.id)).toBe(true);

    const redone = redoHistory(undone!.state, pageOne.id, before);
    expect(redone).not.toBeNull();
    expect(redone!.page).toEqual(after);
    expect(canUndo(redone!.state, pageOne.id)).toBe(true);
    expect(canRedo(redone!.state, pageOne.id)).toBe(false);
    state = redone!.state;
    expect(state).toBeTruthy();
  });

  it("returns null when there is nothing to undo or redo", () => {
    expect(undoHistory({}, pageOne.id, pageOne)).toBeNull();
    expect(redoHistory({}, pageOne.id, pageOne)).toBeNull();
  });

  it("clears the redo branch when a new operation is recorded after undo", () => {
    const initial = page("initial");
    const edited = page("edited");
    let state = recordHistory({}, pageOne.id, initial);

    const undone = undoHistory(state, pageOne.id, edited)!;
    state = undone.state;
    expect(canRedo(state, pageOne.id)).toBe(true);

    state = recordHistory(state, pageOne.id, initial);
    expect(canRedo(state, pageOne.id)).toBe(false);
    expect(redoHistory(state, pageOne.id, initial)).toBeNull();
  });

  it("keeps pages independent so undo never crosses pages", () => {
    const state = recordHistory(
      recordHistory({}, pageOne.id, page("one-before")),
      pageTwo.id,
      page("two-before"),
    );

    const undone = undoHistory(state, pageTwo.id, page("two-after"))!;
    expect(undone.page.id).toBe("two-before");
    // Page one's stack is untouched.
    expect(canUndo(undone.state, pageOne.id)).toBe(true);
    expect(canUndo(undone.state, pageTwo.id)).toBe(false);
  });

  it("coalesces consecutive edits with the same key inside the window", () => {
    const original = page("original");
    const first = recordHistory({}, pageOne.id, original, {
      coalesceKey: "props:node:text",
      now: 1_000,
    });
    const second = recordHistory(first, pageOne.id, page("ignored"), {
      coalesceKey: "props:node:text",
      now: 1_000 + COALESCE_WINDOW_MS - 1,
    });

    // One snapshot only: undo restores the value from before the burst.
    const undone = undoHistory(second, pageOne.id, page("current"))!;
    expect(undone.page).toEqual(original);
    expect(canUndo(undone.state, pageOne.id)).toBe(false);
  });

  it("starts a new step for a different key or after a pause", () => {
    const original = page("original");
    const afterFirst = page("after-first");
    const afterSecond = page("after-second");

    const first = recordHistory({}, pageOne.id, original, { coalesceKey: "props:a", now: 0 });
    const otherKey = recordHistory(first, pageOne.id, afterFirst, {
      coalesceKey: "styles:b",
      now: 10,
    });
    const paused = recordHistory(otherKey, pageOne.id, afterSecond, {
      coalesceKey: "styles:b",
      now: 10 + COALESCE_WINDOW_MS + 1,
    });

    const undoOne = undoHistory(paused, pageOne.id, page("current"))!;
    expect(undoOne.page).toEqual(afterSecond);
    const undoTwo = undoHistory(undoOne.state, pageOne.id, undoOne.page)!;
    expect(undoTwo.page).toEqual(afterFirst);
    const undoThree = undoHistory(undoTwo.state, pageOne.id, undoTwo.page)!;
    expect(undoThree.page).toEqual(original);
  });

  it("never coalesces unkeyed operations", () => {
    const original = page("original");
    const state = recordHistory(
      recordHistory({}, pageOne.id, original),
      pageOne.id,
      page("second"),
    );
    const undone = undoHistory(state, pageOne.id, page("current"))!;
    expect(undone.page.id).toBe("second");
  });

  it("bounds history to the configured limit", () => {
    let state: HistoryState = {};
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      state = recordHistory(state, pageOne.id, page(`snapshot-${i}`));
    }
    const entry = state[pageOne.id]!;
    expect(entry.past).toHaveLength(HISTORY_LIMIT);
    // The oldest snapshots were dropped; the newest is retained last.
    expect(entry.past.at(-1)!.id).toBe(`snapshot-${HISTORY_LIMIT + 9}`);
  });

  it("clears one page's history without touching others", () => {
    const state = recordHistory(recordHistory({}, pageOne.id, pageOne), pageTwo.id, pageTwo);
    const cleared = clearPageHistory(state, pageOne.id);
    expect(canUndo(cleared, pageOne.id)).toBe(false);
    expect(canUndo(cleared, pageTwo.id)).toBe(true);

    // Clearing a page with no history is a no-op on the same object.
    expect(clearPageHistory(cleared, "unknown")).toBe(cleared);
  });
});
