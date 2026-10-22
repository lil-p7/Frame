import { useCallback } from "react";
import { toast } from "sonner";
import type { FrameNode, FramePage, FrameProject, StyleValue } from "@/features/document/model";
import { ROOT_NODE_TYPE } from "@/features/document/model";
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
} from "@/features/document/commands";
import { findNode, findParent } from "@/features/document/traversal";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * Editing flow for Phase 4 (spec §9A insertion defaults, §9C layer actions,
 * §13 atomic commands):
 *
 * UI events → pure document command → updated project → IndexedDB save →
 * state update. The document only changes if the command *and* the save
 * succeed: persistence failure leaves UI state untouched (nothing is faked).
 *
 * Selection is adjusted after every command that can invalidate it, per
 * spec §9C ("update selection safely").
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
  /** Merges validated style updates; `null` clears an override. */
  updateLayerStyles: (nodeId: string, updates: Record<string, StyleValue>) => void;
}

export function usePageCommands({
  page,
  project,
  repository,
  onProjectChanged,
}: UsePageCommandsInput): PageCommands {
  /**
   * Runs one document command: persist it, swap the page into project state,
   * then run the selection-adjustment callback. Any failure leaves the UI
   * state as it was and says so.
   */
  const apply = useCallback(
    async (
      commandName: string,
      mutate: (page: FramePage) => FramePage,
      adjustSelection?: (nextPage: FramePage) => void,
    ): Promise<void> => {
      let nextPage: FramePage;
      try {
        nextPage = mutate(page);
      } catch (error) {
        if (error instanceof DocumentCommandError) {
          toast.error(`${commandName} rejected: ${error.message}`);
          return;
        }
        throw error;
      }

      const updated: FrameProject = {
        ...project,
        updatedAt: new Date().toISOString(),
        pages: project.pages.map((existing) => (existing.id === page.id ? nextPage : existing)),
      };

      try {
        await repository.saveProject(updated);
        onProjectChanged(updated);
        adjustSelection?.(nextPage);
      } catch {
        toast.error("Saving failed — the edit was not kept. Try again when storage is back.");
      }
    },
    [page, project, repository, onProjectChanged],
  );

  const insertComponent = useCallback(
    (type: string): void => {
      const definition = getComponent(type);
      if (definition === undefined) {
        toast.error(`"${type}" is not a registered component`);
        return;
      }
      const target = resolveInsertionTarget(page, useEditorStore.getState().selectedNodeId, type);
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
    [apply, page],
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
      const parent = findParent(page.root, nodeId);
      void apply(
        "Deleting",
        (currentPage) => deleteNode(currentPage, nodeId),
        () => {
          // Selection parked on the deleted subtree moves to the parent
          // (or nothing, when the parent is the structural root).
          const selected = useEditorStore.getState().selectedNodeId;
          if (selected === null) return;
          const selectedNode = findNode(page.root, selected);
          const selectionWasDeleted = selectedNode !== null && subtreeHas(selectedNode, nodeId);
          if (selectionWasDeleted) {
            useEditorStore
              .getState()
              .selectNode(parent !== null && parent.type !== ROOT_NODE_TYPE ? parent.id : null);
          }
        },
      );
    },
    [apply, page],
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
      void apply("Updating", (currentPage) => updateNodeProps(currentPage, nodeId, updates));
    },
    [apply],
  );

  const updateLayerStyles = useCallback(
    (nodeId: string, updates: Record<string, StyleValue>): void => {
      void apply("Styling", (currentPage) => updateNodeStyles(currentPage, nodeId, updates));
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
  };
}

function subtreeHas(node: FrameNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((child) => subtreeHas(child, targetId));
}
