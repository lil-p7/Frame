import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  type FrameNode,
  type FramePage,
  type FrameProject,
} from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { canUndo } from "@/features/document/history";
import { usePageCommands } from "@/features/editor/usePageCommands";
import { resetHistory, useHistoryStore } from "@/features/editor/stores/historyStore";
import { resetClipboard } from "@/features/editor/stores/clipboardStore";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * Phase 11 "Test error recovery" (spec §35), asserting the §14/§31 promises:
 *
 * - a failed save leaves the document untouched, records no history entry,
 *   and surfaces a visible error;
 * - the serialized command queue survives failures (the next edit still
 *   works) and rejected commands never reach storage;
 * - a failed undo save rolls the history stacks back, so document and
 *   history can never disagree;
 * - rapid edits are saved in order, so a stale snapshot can never overwrite
 *   a newer one.
 */
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function makeNode(id: string, name: string): FrameNode {
  const definition = getComponent("heading");
  if (definition === undefined) throw new Error("heading is not registered");
  return {
    id,
    type: "heading",
    name,
    props: definition.createDefaultProps(),
    styles: {},
    children: [],
    editor: { hidden: false, locked: false },
  };
}

function makePage(): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: { ...createRootNode("root"), children: [makeNode("node-a", "Original")] },
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}

function makeProject(page: FramePage): FrameProject {
  return {
    id: "proj-1",
    name: "Recovery Project",
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pages: [page],
    assets: [],
    designTokens: { colors: {}, spacing: {}, typography: {} },
  };
}

/** The first child name of a snapshot that was handed to storage. */
function savedNodeName(project: FrameProject | undefined): string | undefined {
  return project?.pages[0]?.root.children[0]?.name;
}

function setup() {
  const page = makePage();
  const project = makeProject(page);
  const savedProjects: FrameProject[] = [];
  const saveProject = vi.fn(async (next: FrameProject): Promise<void> => {
    savedProjects.push(next);
  });
  const repository: ProjectRepository = {
    listProjects: vi.fn(async () => [project]),
    getProject: vi.fn(async () => project),
    saveProject,
    deleteProject: vi.fn(async () => undefined),
    putAsset: vi.fn(async () => undefined),
    getAssetBlob: vi.fn(async () => null),
    deleteAsset: vi.fn(async () => undefined),
  };
  const onProjectChanged = vi.fn();

  const { result } = renderHook(() =>
    usePageCommands({ page, project, repository, onProjectChanged }),
  );

  /** Runs one command through the hook's queue and waits for it to settle. */
  const run = async (command: () => void): Promise<void> => {
    await act(async () => {
      command();
      await result.current.flush();
    });
  };

  return { page, repository, saveProject, savedProjects, onProjectChanged, run, result };
}

beforeEach(() => {
  resetHistory();
  resetClipboard();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
  vi.mocked(toast.error).mockClear();
});

describe("save failure recovery (Phase 11, spec §14/§31)", () => {
  it("keeps the document, history, and project untouched when a save fails", async () => {
    const { repository, saveProject, onProjectChanged, run, result } = setup();
    saveProject.mockRejectedValueOnce(new Error("disk full"));

    await run(() => {
      result.current.renameLayer("node-a", "Renamed");
    });

    // The edit reached storage (and failed there) exactly once…
    expect(saveProject).toHaveBeenCalledTimes(1);
    // …but no state advanced: no project update, no history entry.
    expect(onProjectChanged).not.toHaveBeenCalled();
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(false);
    // §31: "Display an error and preserve recoverable data if saving fails".
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringMatching(/saving failed/i),
    );
    // Storage was only touched by that one failed save — no reads, no retries.
    expect(repository.getProject).toHaveBeenCalledTimes(0);
    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid command before anything reaches storage", async () => {
    const { saveProject, onProjectChanged, run, result } = setup();

    await run(() => {
      result.current.renameLayer("node-a", "   ");
    });

    expect(saveProject).not.toHaveBeenCalled();
    expect(onProjectChanged).not.toHaveBeenCalled();
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringMatching(/rejected/i),
    );
  });

  it("keeps working after a failed save: the next edit persists", async () => {
    const { saveProject, savedProjects, onProjectChanged, run, result } = setup();
    saveProject.mockRejectedValueOnce(new Error("offline"));

    await run(() => {
      result.current.renameLayer("node-a", "First try");
    });
    expect(onProjectChanged).not.toHaveBeenCalled();
    expect(savedProjects).toHaveLength(0);

    await run(() => {
      result.current.renameLayer("node-a", "Second try");
    });
    expect(onProjectChanged).toHaveBeenCalledTimes(1);
    expect(savedProjects).toHaveLength(1);
    expect(savedNodeName(savedProjects[0])).toBe("Second try");
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(true);
  });

  it("rolls the history stacks back when an undo save fails", async () => {
    const { saveProject, onProjectChanged, run, result } = setup();

    // A successful edit establishes an undo entry.
    await run(() => {
      result.current.renameLayer("node-a", "Renamed");
    });
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(true);
    expect(onProjectChanged).toHaveBeenCalledTimes(1);

    saveProject.mockRejectedValueOnce(new Error("disk full"));
    await run(() => {
      result.current.undo();
    });

    // The stacks moved first and were rolled back with the save: history
    // still matches the document on screen, and the failure was announced.
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(true);
    expect(onProjectChanged).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringMatching(/undo failed/i),
    );

    // Storage recovered: the same undo now succeeds.
    vi.mocked(toast.error).mockClear();
    await run(() => {
      result.current.undo();
    });
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(false);
    expect(onProjectChanged).toHaveBeenCalledTimes(2);
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("saves rapid edits in order so a stale snapshot never wins", async () => {
    const { saveProject, savedProjects, result } = setup();

    await act(async () => {
      result.current.renameLayer("node-a", "First");
      result.current.renameLayer("node-a", "Second");
      await result.current.flush();
    });

    expect(saveProject).toHaveBeenCalledTimes(2);
    // Each save carries the state up to and including that command: the
    // first snapshot cannot overwrite the newer second one (§31).
    expect(savedNodeName(savedProjects[0])).toBe("First");
    expect(savedNodeName(savedProjects[1])).toBe("Second");
    expect(canUndo(useHistoryStore.getState().pages, "page-1")).toBe(true);
  });
});
