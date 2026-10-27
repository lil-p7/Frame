import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  FrameAsset,
  FramePage,
  FrameProject,
  StyleBreakpoint,
  StyleValue,
} from "@/features/document/model";
import { createRootNode, slugify, ROOT_NODE_TYPE } from "@/features/document/model";
import { getComponent, parentAllowsChild } from "@/features/component-registry/registry";
import {
  DocumentCommandError,
  deleteNode,
  duplicateNode,
  insertNode,
  moveNode,
  renameNode,
  setNodeLocked,
  setNodeVisibility,
  updateNodeProps,
  updateNodeStyles,
  updatePageSettings,
  type PageSettingsUpdates,
} from "@/features/document/commands";
import { redoHistory, undoHistory } from "@/features/document/history";
import { cloneSubtreeWithFreshIds, findNode, findParent } from "@/features/document/traversal";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import { useHistoryStore } from "@/features/editor/stores/historyStore";
import { useClipboardStore } from "@/features/editor/stores/clipboardStore";
import {
  AssetValidationError,
  assetSrcFor,
  storeImageAsset,
  validateImageFile,
} from "@/features/assets/service";
import { createId } from "@/lib/ids";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * Editing flow (spec §9A insertion defaults, §13 atomic commands, §14 history):
 *
 * UI event → pure document command → updated project → IndexedDB save →
 * state update. The document only changes if the command *and* the save
 * succeed: persistence failure leaves UI state untouched (nothing is faked)
 * and records no history entry.
 *
 * History snapshots are recorded per page only after a successful save; undo
 * and redo persist the restored page and roll their stacks back if that save
 * fails, so document and history can never disagree.
 *
 * Selection is adjusted after every command that can invalidate it (spec §9C).
 */

export interface InsertionTarget {
  parentId: string;
  /** Position in the parent's children (defaults to appending). */
  index?: number;
}

/**
 * Resolves where clicking a library item inserts (spec §9A): the selected
 * container gets the child; otherwise the component sits beside its parent's
 * selection; with nothing relevant selected it goes to the page root.
 */
export function resolveInsertionTarget(
  page: FramePage,
  selectedId: string | null,
  type: string,
): InsertionTarget {
  const root = page.root;
  const selection = selectedId === null ? null : findNode(root, selectedId);

  if (selection === null || selection.type === ROOT_NODE_TYPE) {
    return { parentId: root.id };
  }
  if (parentAllowsChild(selection.type, type)) {
    return { parentId: selection.id, index: selection.children.length };
  }
  // Insert next to the selection under the nearest valid parent.
  const parent = findParent(root, selection.id);
  if (parent !== null && parentAllowsChild(parent.type, type)) {
    return {
      parentId: parent.id,
      index: parent.children.findIndex((child) => child.id === selection.id) + 1,
    };
  }
  // The spec's "nearest valid structural position" fallback.
  return { parentId: root.id };
}

interface UsePageCommandsInput {
  page: FramePage;
  project: FrameProject;
  repository: ProjectRepository;
  onProjectChanged: (project: FrameProject) => void;
}

export interface PageCommands {
  /** Inserts a default node of `type` at the current valid location. */
  insertComponent: (type: string) => void;
  /** Inserts a default node at an explicit drop position (spec §15). */
  insertComponentAt: (type: string, parentId: string, index: number) => void;
  /** Moves a node to an explicit drop position, preserving identity (§15). */
  moveLayer: (nodeId: string, newParentId: string, index: number) => void;
  deleteLayer: (nodeId: string) => void;
  duplicateLayer: (nodeId: string) => void;
  renameLayer: (nodeId: string, name: string) => void;
  setLayerVisibility: (nodeId: string, hidden: boolean) => void;
  setLayerLock: (nodeId: string, locked: boolean) => void;
  /** Merges validated prop updates into the node (rejected values are toasted). */
  updateLayerProps: (nodeId: string, updates: Record<string, unknown>) => void;
  /**
   * Merges validated style updates into the base styles or a breakpoint's
   * overrides; `null` removes the declaration/override.
   */
  updateLayerStyles: (
    nodeId: string,
    updates: Record<string, StyleValue>,
    breakpoint?: StyleBreakpoint,
  ) => void;

  /** Reverts the last operation on this page (spec §14). */
  undo: () => void;
  /** Re-applies the last undone operation on this page. */
  redo: () => void;
  /** Copies the selected component to the in-session clipboard. */
  copySelected: () => boolean;
  /** Pastes the clipboard with fresh IDs beside/into the selection. */
  pasteClipboard: () => boolean;
  /** Duplicates the selection (reveals the copy selected). */
  duplicateSelected: () => boolean;
  /** Deletes the selection when the component allows it. */
  deleteSelected: () => boolean;
  /**
   * Uploads a local image, stores it in the asset store, and points `nodeId`
   * at it. The component keeps its ID (spec §19 replace behavior).
   */
  uploadImageForNode: (nodeId: string, file: File) => Promise<void>;

  /** Adds a new page after the current one and selects it (spec §20). */
  createPage: (name: string) => Promise<boolean>;
  /** Duplicates the current page with fresh IDs for page and nodes. */
  duplicatePage: () => Promise<boolean>;
  /** Deletes the current page (refuses when it is the only page). */
  deletePage: () => Promise<boolean>;
  /** Moves the current page one position within the project. */
  movePage: (direction: "up" | "down") => Promise<boolean>;
  /** Updates name/slug/title/background of the current page (validated). */
  updatePageSettings: (updates: PageSettingsUpdates) => Promise<void>;
  /**
   * Resolves once every queued command has been applied and persisted
   * (spec §8: flush pending changes before navigating away or exporting).
   */
  flush: () => Promise<void>;
}

export function usePageCommands({
  page,
  project,
  repository,
  onProjectChanged,
}: UsePageCommandsInput): PageCommands {
  /**
   * Latest page/project as refs: event handlers and key shortcuts run between
   * renders, and undo/redo must chain from the newest snapshot rather than a
   * stale prop (spec §14 coherent history).
   */
  const pageRef = useRef(page);
  const projectRef = useRef(project);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  /**
   * Serialized command queue (spec §31): edits are applied and saved one at a
   * time, so two quick changes (e.g. unit keystrokes) can never race and let
   * an older snapshot overwrite a newer one. Each task reads the latest page
   * when it runs; failures leave the chain alive.
   */
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  /**
   * Runs one document command: persist it, record history, swap the page into
   * project state, then run the selection-adjustment callback. Any failure
   * leaves the UI state as it was and says so.
   */
  const apply = useCallback(
    (
      commandName: string,
      mutate: (page: FramePage) => FramePage,
      adjustSelection?: (nextPage: FramePage) => void,
      coalesceKey: string | null = null,
    ): Promise<void> =>
      enqueue(async () => {
        const before = pageRef.current;
        let nextPage: FramePage;
        try {
          nextPage = mutate(before);
        } catch (error) {
          if (error instanceof DocumentCommandError) {
            toast.error(`${commandName} rejected: ${error.message}`);
            return;
          }
          throw error;
        }
        // No-op commands (e.g. an empty update) must not create a history step.
        if (nextPage === before) return;

        const updated: FrameProject = {
          ...projectRef.current,
          updatedAt: new Date().toISOString(),
          pages: projectRef.current.pages.map((existing) =>
            existing.id === before.id ? nextPage : existing,
          ),
        };

        try {
          await repository.saveProject(updated);
          // History only records edits that actually reached storage (§14/§31).
          useHistoryStore.getState().record(before.id, before, coalesceKey);
          projectRef.current = updated;
          pageRef.current = nextPage;
          onProjectChanged(updated);
          adjustSelection?.(nextPage);
        } catch {
          toast.error("Saving failed — the edit was not kept. Try again when storage is back.");
        }
      }),
    [enqueue, repository, onProjectChanged],
  );

  /**
   * Applies an undo/redo transition and persists the restored page. The
   * history stacks move first so the toolbar reflects it immediately; a save
   * failure rolls both the page and the stacks back (spec §14 consistency).
   */
  const restore = useCallback(
    (direction: "undo" | "redo"): Promise<void> =>
      enqueue(async () => {
        const history = useHistoryStore.getState();
        const current = pageRef.current;
        const previousHistory = history.pages;
        const transition =
          direction === "undo"
            ? undoHistory(previousHistory, current.id, current)
            : redoHistory(previousHistory, current.id, current);
        if (transition === null) return;

        const restored = transition.page;
        history.replace(transition.state);
        pageRef.current = restored;

        const updated: FrameProject = {
          ...projectRef.current,
          updatedAt: new Date().toISOString(),
          pages: projectRef.current.pages.map((existing) =>
            existing.id === restored.id ? restored : existing,
          ),
        };

        try {
          await repository.saveProject(updated);
          projectRef.current = updated;
          onProjectChanged(updated);
          // Never restore a selection that no longer exists in the document.
          const editor = useEditorStore.getState();
          if (
            editor.selectedNodeId !== null &&
            findNode(restored.root, editor.selectedNodeId) === null
          ) {
            editor.selectNode(null);
          }
        } catch {
          history.replace(previousHistory);
          pageRef.current = current;
          toast.error(
            `${direction === "undo" ? "Undo" : "Redo"} failed — the project was not changed.`,
          );
        }
      }),
    [enqueue, repository, onProjectChanged],
  );

  const undo = useCallback((): void => {
    void restore("undo");
  }, [restore]);

  const redo = useCallback((): void => {
    void restore("redo");
  }, [restore]);

  /**
   * Saves a new page list (project-level page operation, spec §20) and points
   * the editor at `selectPageId` when provided. A save failure leaves the UI
   * untouched; switching pages releases the old page's selection.
   */
  const persistPages = useCallback(
    async (nextPages: FramePage[], selectPageId?: string): Promise<boolean> => {
      const updated: FrameProject = {
        ...projectRef.current,
        updatedAt: new Date().toISOString(),
        pages: nextPages,
      };
      try {
        await repository.saveProject(updated);
      } catch {
        toast.error("Saving failed — the page change was not kept.");
        return false;
      }
      projectRef.current = updated;
      onProjectChanged(updated);
      if (selectPageId !== undefined) {
        useEditorStore.getState().setCurrentPage(selectPageId);
        useEditorStore.getState().selectNode(null);
      }
      return true;
    },
    [repository, onProjectChanged],
  );

  /**
   * Waits for the command queue to drain. Commands are appended in order, so
   * the returned promise settles only after every earlier task (including its
   * save) has settled — nothing is written out of order (spec §31).
   */
  const flush = useCallback((): Promise<void> => enqueue(() => Promise.resolve()), [enqueue]);

  const insertComponent = useCallback(
    (type: string): void => {
      const definition = getComponent(type);
      if (definition === undefined) {
        toast.error(`"${type}" is not a registered component`);
        return;
      }
      const target = resolveInsertionTarget(
        pageRef.current,
        useEditorStore.getState().selectedNodeId,
        type,
      );
      const node = definition.createDefaultNode();
      void apply(
        "Inserting",
        (currentPage) =>
          insertNode(currentPage, { parentId: target.parentId, index: target.index, node }),
        // New components are selected after insertion (spec §9A) so the
        // inspector shows them immediately.
        () => useEditorStore.getState().selectNode(node.id),
      );
    },
    [apply],
  );

  const insertComponentAt = useCallback(
    (type: string, parentId: string, index: number): void => {
      const definition = getComponent(type);
      if (definition === undefined) {
        toast.error(`"${type}" is not a registered component`);
        return;
      }
      const node = definition.createDefaultNode();
      void apply(
        "Inserting",
        (currentPage) => insertNode(currentPage, { parentId, index, node }),
        // Same rule as click insertion (spec §9A): select the new node.
        () => useEditorStore.getState().selectNode(node.id),
      );
    },
    [apply],
  );

  const moveLayer = useCallback(
    (nodeId: string, newParentId: string, index: number): void => {
      void apply("Moving", (currentPage) => {
        // The resolver reports the slot in the *current* tree, while
        // `moveNode` expects the index *after* removal (spec §15 /
        // MoveNodeInput). Same-parent moves from before→after shift by one.
        let adjusted = index;
        const parent = findParent(currentPage.root, nodeId);
        if (parent !== null && parent.id === newParentId) {
          const original = parent.children.findIndex((child) => child.id === nodeId);
          if (original < index) adjusted = index - 1;
        }
        return moveNode(currentPage, { nodeId, newParentId, index: adjusted });
      });
    },
    [apply],
  );

  const deleteLayer = useCallback(
    (nodeId: string): void => {
      // The parent is resolved when the queued command actually runs, not when
      // the click happened (spec §31 serialized commands).
      let deletedParentId: string | null = null;
      void apply(
        "Deleting",
        (currentPage) => {
          deletedParentId = findParent(currentPage.root, nodeId)?.id ?? null;
          return deleteNode(currentPage, nodeId);
        },
        (nextPage) => {
          // Selection parked on the deleted subtree moves to the parent
          // (or nothing, when the parent is the structural root).
          const selected = useEditorStore.getState().selectedNodeId;
          if (selected === null) return;
          if (findNode(nextPage.root, selected) !== null) return;
          const parent = deletedParentId === null ? null : findNode(nextPage.root, deletedParentId);
          useEditorStore
            .getState()
            .selectNode(parent !== null && parent.type !== ROOT_NODE_TYPE ? parent.id : null);
        },
      );
    },
    [apply],
  );

  const duplicateLayer = useCallback(
    (nodeId: string): void => {
      void apply(
        "Duplicating",
        (currentPage) => duplicateNode(currentPage, nodeId),
        (nextPage) => {
          // The copy sits right after the original — select it.
          const parent = findParent(nextPage.root, nodeId);
          if (parent === null) return;
          const originalIndex = parent.children.findIndex((child) => child.id === nodeId);
          const copy = parent.children[originalIndex + 1];
          if (copy !== undefined) useEditorStore.getState().selectNode(copy.id);
        },
      );
    },
    [apply],
  );

  const renameLayer = useCallback(
    (nodeId: string, name: string): void => {
      void apply("Renaming", (currentPage) => renameNode(currentPage, nodeId, name));
    },
    [apply],
  );

  const setLayerVisibility = useCallback(
    (nodeId: string, hidden: boolean): void => {
      void apply("Hiding", (currentPage) => setNodeVisibility(currentPage, nodeId, hidden));
    },
    [apply],
  );

  const setLayerLock = useCallback(
    (nodeId: string, locked: boolean): void => {
      void apply("Locking", (currentPage) => setNodeLocked(currentPage, nodeId, locked));
    },
    [apply],
  );

  const updateLayerProps = useCallback(
    (nodeId: string, updates: Record<string, unknown>): void => {
      // Continuous edits to the same property coalesce into one undo step
      // (spec §14); switching node/key starts a new step.
      const coalesceKey =
        Object.keys(updates).length === 0
          ? null
          : `props:${nodeId}:${Object.keys(updates).sort().join(",")}`;
      void apply(
        "Updating",
        (currentPage) => updateNodeProps(currentPage, nodeId, updates),
        undefined,
        coalesceKey,
      );
    },
    [apply],
  );

  const updateLayerStyles = useCallback(
    (
      nodeId: string,
      updates: Record<string, StyleValue>,
      breakpoint: StyleBreakpoint = "base",
    ): void => {
      const coalesceKey =
        Object.keys(updates).length === 0
          ? null
          : `styles:${breakpoint}:${nodeId}:${Object.keys(updates).sort().join(",")}`;
      void apply(
        "Styling",
        (currentPage) => updateNodeStyles(currentPage, nodeId, updates, breakpoint),
        undefined,
        coalesceKey,
      );
    },
    [apply],
  );

  const copySelected = useCallback((): boolean => {
    const selectedId = useEditorStore.getState().selectedNodeId;
    if (selectedId === null) return false;
    const node = findNode(pageRef.current.root, selectedId);
    if (node === null || node.type === ROOT_NODE_TYPE) return false;
    // Snapshot, so later edits to the source never leak into the clipboard.
    useClipboardStore.getState().copy(structuredClone(node));
    return true;
  }, []);

  const pasteClipboard = useCallback((): boolean => {
    const copied = useClipboardStore.getState().node;
    if (copied === null) return false;
    if (getComponent(copied.type) === undefined) {
      toast.error(`Cannot paste — "${copied.type}" is no longer a registered component.`);
      return false;
    }
    const target = resolveInsertionTarget(
      pageRef.current,
      useEditorStore.getState().selectedNodeId,
      copied.type,
    );
    // Paste is a copy: every node in the subtree gets a fresh ID (§12).
    const node = cloneSubtreeWithFreshIds(copied, createId);
    void apply(
      "Pasting",
      (currentPage) =>
        insertNode(currentPage, { parentId: target.parentId, index: target.index, node }),
      () => useEditorStore.getState().selectNode(node.id),
    );
    return true;
  }, [apply]);

  const duplicateSelected = useCallback((): boolean => {
    const selectedId = useEditorStore.getState().selectedNodeId;
    if (selectedId === null) return false;
    const node = findNode(pageRef.current.root, selectedId);
    const definition = node === null ? undefined : getComponent(node.type);
    if (node === null || node.type === ROOT_NODE_TYPE || definition?.canDuplicate !== true) {
      return false;
    }
    duplicateLayer(selectedId);
    return true;
  }, [duplicateLayer]);

  const deleteSelected = useCallback((): boolean => {
    const selectedId = useEditorStore.getState().selectedNodeId;
    if (selectedId === null) return false;
    const node = findNode(pageRef.current.root, selectedId);
    const definition = node === null ? undefined : getComponent(node.type);
    if (node === null || node.type === ROOT_NODE_TYPE || definition?.canDelete !== true) {
      return false;
    }
    deleteLayer(selectedId);
    return true;
  }, [deleteLayer]);

  /**
   * Local image upload (spec §19): validate → store bytes → record the asset
   * → point the component at it. Runs inside the command queue so the page
   * and asset records land in one ordered save; any failure removes the
   * just-written blob so no orphaned asset is left behind.
   */
  const uploadImageForNode = useCallback(
    (nodeId: string, file: File): Promise<void> =>
      enqueue(async () => {
        try {
          validateImageFile(file);
        } catch (error) {
          toast.error(
            error instanceof AssetValidationError ? error.message : "That image could not be read.",
          );
          return;
        }

        const before = pageRef.current;
        let asset: FrameAsset;
        try {
          asset = await storeImageAsset(repository, file);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Storing the image failed — try again.",
          );
          return;
        }

        let nextPage: FramePage;
        try {
          // Same component, new source: the node ID is preserved (§19).
          nextPage = updateNodeProps(before, nodeId, { src: assetSrcFor(asset.storageKey) });
        } catch (error) {
          await repository.deleteAsset(asset.storageKey).catch(() => undefined);
          if (error instanceof DocumentCommandError) {
            toast.error(`Upload rejected: ${error.message}`);
          }
          return;
        }

        const updated: FrameProject = {
          ...projectRef.current,
          updatedAt: new Date().toISOString(),
          assets: [...projectRef.current.assets, asset],
          pages: projectRef.current.pages.map((existing) =>
            existing.id === before.id ? nextPage : existing,
          ),
        };
        try {
          await repository.saveProject(updated);
        } catch {
          await repository.deleteAsset(asset.storageKey).catch(() => undefined);
          toast.error("Saving failed — the image was not kept.");
          return;
        }
        useHistoryStore.getState().record(before.id, before, null);
        projectRef.current = updated;
        pageRef.current = nextPage;
        onProjectChanged(updated);
        toast.success("Image uploaded");
      }),
    [enqueue, repository, onProjectChanged],
  );

  const createPage = useCallback(
    (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        toast.error("Page name is required.");
        return Promise.resolve(false);
      }
      const project = projectRef.current;
      const created: FramePage = {
        id: createId(),
        name: trimmed,
        slug: uniqueSlug(slugify(trimmed), project.pages),
        root: createRootNode(createId()),
        settings: { title: trimmed, backgroundColor: "#ffffff" },
      };
      const index = project.pages.findIndex((page) => page.id === pageRef.current.id);
      const next = [...project.pages];
      next.splice(Math.max(0, index) + 1, 0, created);
      return persistPages(next, created.id);
    },
    [persistPages],
  );

  const duplicatePage = useCallback((): Promise<boolean> => {
    const source = pageRef.current;
    const project = projectRef.current;
    const clone: FramePage = {
      id: createId(),
      name: `${source.name} (copy)`,
      slug: uniqueSlug(`${source.slug}-copy`, project.pages),
      root: cloneSubtreeWithFreshIds(source.root, createId),
      settings: { ...source.settings },
    };
    const index = project.pages.findIndex((page) => page.id === source.id);
    const next = [...project.pages];
    next.splice(Math.max(0, index) + 1, 0, clone);
    return persistPages(next, clone.id);
  }, [persistPages]);

  const deletePage = useCallback((): Promise<boolean> => {
    const project = projectRef.current;
    const target = pageRef.current;
    if (project.pages.length <= 1) {
      toast.error("A project needs at least one page — create another page before deleting.");
      return Promise.resolve(false);
    }
    const index = project.pages.findIndex((page) => page.id === target.id);
    const next = project.pages.filter((page) => page.id !== target.id);
    const fallback = next[Math.min(Math.max(index, 0), next.length - 1)]!;
    return persistPages(next, fallback.id);
  }, [persistPages]);

  const movePage = useCallback(
    (direction: "up" | "down"): Promise<boolean> => {
      const project = projectRef.current;
      const target = pageRef.current;
      const index = project.pages.findIndex((page) => page.id === target.id);
      const destination = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || destination < 0 || destination >= project.pages.length) {
        return Promise.resolve(false);
      }
      const next = [...project.pages];
      const [moved] = next.splice(index, 1);
      next.splice(destination, 0, moved!);
      return persistPages(next);
    },
    [persistPages],
  );

  const updateCurrentPageSettings = useCallback(
    (updates: PageSettingsUpdates): Promise<void> => {
      // Slug uniqueness needs the whole project (§20); check before writing.
      if (updates.slug !== undefined) {
        const slug = slugify(updates.slug);
        if (
          slug !== pageRef.current.slug &&
          projectRef.current.pages.some((page) => page.slug === slug)
        ) {
          toast.error(`Another page already uses the slug "${slug}".`);
          return Promise.resolve();
        }
        updates = { ...updates, slug };
      }
      return apply("Updating page", (currentPage) => updatePageSettings(currentPage, updates));
    },
    [apply],
  );

  return {
    insertComponent,
    insertComponentAt,
    moveLayer,
    deleteLayer,
    duplicateLayer,
    renameLayer,
    setLayerVisibility,
    setLayerLock,
    updateLayerProps,
    updateLayerStyles,
    undo,
    redo,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    deleteSelected,
    uploadImageForNode,
    createPage,
    duplicatePage,
    deletePage,
    movePage,
    updatePageSettings: updateCurrentPageSettings,
    flush,
  };
}

/** First free `<base>`, `<base>-2`, … slug within the project (spec §20). */
function uniqueSlug(base: string, pages: readonly FramePage[]): string {
  const taken = new Set(pages.map((page) => page.slug));
  let candidate = base;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}
