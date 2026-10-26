import {
  RESPONSIVE_BREAKPOINTS,
  ROOT_NODE_TYPE,
  slugify,
  type FrameNode,
  type FramePage,
  type ResponsiveStyles,
  type StyleBreakpoint,
  type StyleValue,
} from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { isSafeStyleValue, isSupportedStyleKey } from "@/features/component-registry/styles";
import { DocumentValidationError, assertValidPage } from "@/features/document/validation";
import { cloneSubtreeWithFreshIds, findNode, findParent } from "@/features/document/traversal";
import { createId } from "@/lib/ids";

/**
 * Atomic document command layer (spec §13 "Atomic document operations").
 *
 * Every command is a pure function `FramePage -> FramePage` that:
 * 1. validates its inputs with specific error messages,
 * 2. resolves the target node and parent,
 * 3. enforces structural constraints (root protection, cycles, child rules),
 * 4. returns a page that passes full document validation,
 * 5. never mutates the input page.
 *
 * History updates (Phase 7), dirty-marking/persistence, and selection
 * adjustment happen in the store layer that calls these commands — the
 * commands themselves stay pure and serializable-friendly.
 */
export class DocumentCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentCommandError";
  }
}

/** Runs full validation and rethrows issues as command errors. */
function finish(page: FramePage): FramePage {
  try {
    assertValidPage(page);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      throw new DocumentCommandError(
        `Command rejected — ${error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    throw error;
  }
  return page;
}

/**
 * Immutably maps the node with `id` through `updater`.
 * Only nodes along the path are copied; everything else is shared.
 */
function updateInTree(
  root: FrameNode,
  id: string,
  updater: (node: FrameNode) => FrameNode,
): FrameNode {
  if (root.id === id) return updater(root);
  let changed = false;
  const children = root.children.map((child) => {
    const next = updateInTree(child, id, updater);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

function requireTarget(page: FramePage, nodeId: string): FrameNode {
  const node = findNode(page.root, nodeId);
  if (node === null) throw new DocumentCommandError(`Component "${nodeId}" does not exist`);
  return node;
}

/** The structural root is not a user component: it cannot be operated on. */
function rejectRootOperation(page: FramePage, nodeId: string, operation: string): void {
  if (page.root.id === nodeId) {
    throw new DocumentCommandError(`The page root cannot be ${operation}`);
  }
}

export interface InsertNodeInput {
  /** Parent to insert into — the page root or any child-accepting component. */
  parentId: string;
  /** Position in the parent's children (clamped); defaults to appending. */
  index?: number;
  /** Fully built node (usually from `definition.createDefaultNode()`). */
  node: FrameNode;
}

/** Inserts a node under a parent as one atomic, validated operation. */
export function insertNode(page: FramePage, input: InsertNodeInput): FramePage {
  const parent = findNode(page.root, input.parentId);
  if (parent === null) {
    throw new DocumentCommandError(`Parent "${input.parentId}" does not exist`);
  }

  const parentAccepts =
    parent.type === ROOT_NODE_TYPE ? true : (getComponent(parent.type)?.acceptsChildren ?? false);
  if (!parentAccepts) {
    throw new DocumentCommandError(`Component "${parent.type}" does not accept children`);
  }

  const definition = getComponent(input.node.type);
  if (definition === undefined) {
    throw new DocumentCommandError(`Unknown component type "${input.node.type}"`);
  }
  if (!definition.validateProps(input.node.props)) {
    throw new DocumentCommandError(`Invalid props for component "${input.node.type}"`);
  }

  const parentDefinition = parent.type === ROOT_NODE_TYPE ? null : getComponent(parent.type);
  const allowed = parentDefinition?.allowedChildTypes ?? null;
  if (allowed !== null && !allowed.includes(input.node.type)) {
    throw new DocumentCommandError(
      `"${parent.type}" does not allow children of type "${input.node.type}"`,
    );
  }

  // IDs must stay unique across the whole page (spec §12).
  const existingIds = new Set<string>();
  const collect = (node: FrameNode): void => {
    existingIds.add(node.id);
    node.children.forEach(collect);
  };
  collect(page.root);
  const subtreeIds: string[] = [];
  const collectSubtree = (node: FrameNode): void => {
    subtreeIds.push(node.id);
    node.children.forEach(collectSubtree);
  };
  collectSubtree(input.node);
  for (const id of subtreeIds) {
    if (existingIds.has(id)) {
      throw new DocumentCommandError(`Duplicate component ID "${id}"`);
    }
  }

  const parentIndex = input.index ?? parent.children.length;
  const nextRoot = updateInTree(page.root, parent.id, (parentNode) => {
    const children = [...parentNode.children];
    const at = Math.max(0, Math.min(Math.round(parentIndex), children.length));
    children.splice(at, 0, input.node);
    return { ...parentNode, children };
  });

  return finish({ ...page, root: nextRoot });
}

/** Deletes a component subtree. The page root is never deletable (spec §12). */
export function deleteNode(page: FramePage, nodeId: string): FramePage {
  rejectRootOperation(page, nodeId, "deleted");
  const parent = findParent(page.root, nodeId);
  if (parent === null) {
    throw new DocumentCommandError(`Component "${nodeId}" does not exist`);
  }

  const nextRoot = updateInTree(page.root, parent.id, (parentNode) => ({
    ...parentNode,
    children: parentNode.children.filter((child) => child.id !== nodeId),
  }));
  return finish({ ...page, root: nextRoot });
}

export interface MoveNodeInput {
  nodeId: string;
  newParentId: string;
  /**
   * Insertion position in the destination's children *after* `nodeId` has
   * been removed; clamped to valid bounds.
   */
  index?: number;
}

/**
 * Moves a component while preserving its identity (spec §15). Prevents
 * moving a node into itself or one of its descendants (cycles).
 */
export function moveNode(page: FramePage, input: MoveNodeInput): FramePage {
  rejectRootOperation(page, input.nodeId, "moved");
  const node = requireTarget(page, input.nodeId);

  if (input.newParentId === input.nodeId) {
    throw new DocumentCommandError("A component cannot be moved into itself");
  }
  if (subtreeContainsNode(node, input.newParentId)) {
    throw new DocumentCommandError("A component cannot be moved into its own descendant");
  }

  const newParent = findNode(page.root, input.newParentId);
  if (newParent === null) {
    throw new DocumentCommandError(`Parent "${input.newParentId}" does not exist`);
  }
  const parentAccepts =
    newParent.type === ROOT_NODE_TYPE
      ? true
      : (getComponent(newParent.type)?.acceptsChildren ?? false);
  if (!parentAccepts) {
    throw new DocumentCommandError(`Component "${newParent.type}" does not accept children`);
  }
  const parentDefinition = newParent.type === ROOT_NODE_TYPE ? null : getComponent(newParent.type);
  const allowed = parentDefinition?.allowedChildTypes ?? null;
  if (allowed !== null && !allowed.includes(node.type)) {
    throw new DocumentCommandError(
      `"${newParent.type}" does not allow children of type "${node.type}"`,
    );
  }

  // 1) Remove (copy-on-write), 2) re-insert at the clamped destination index.
  const parentOfNode = findParent(page.root, input.nodeId);
  if (parentOfNode === null) {
    throw new DocumentCommandError(`Component "${input.nodeId}" does not exist`);
  }
  const withoutNode = updateInTree(page.root, parentOfNode.id, (parentNode) => ({
    ...parentNode,
    children: parentNode.children.filter((child) => child.id !== input.nodeId),
  }));

  const nextRoot = updateInTree(withoutNode, input.newParentId, (parentNode) => {
    const children = [...parentNode.children];
    const target = Math.max(
      0,
      Math.min(Math.round(input.index ?? children.length), children.length),
    );
    children.splice(target, 0, node);
    return { ...parentNode, children };
  });

  return finish({ ...page, root: nextRoot });
}

function subtreeContainsNode(node: FrameNode, candidateId: string): boolean {
  if (node.id === candidateId) return true;
  return node.children.some((child) => subtreeContainsNode(child, candidateId));
}

/** Duplicates a subtree with fresh IDs everywhere, inserted after the original. */
export function duplicateNode(page: FramePage, nodeId: string): FramePage {
  rejectRootOperation(page, nodeId, "duplicated");
  const node = requireTarget(page, nodeId);
  const definition = getComponent(node.type);
  if (definition === undefined) {
    throw new DocumentCommandError(
      `Cannot duplicate "${node.type}" — the component type is not registered`,
    );
  }
  if (!definition.canDuplicate) {
    throw new DocumentCommandError(`Component "${node.type}" cannot be duplicated`);
  }

  const parent = findParent(page.root, nodeId);
  if (parent === null) {
    throw new DocumentCommandError(`Component "${nodeId}" does not exist`);
  }
  const originalIndex = parent.children.findIndex((child) => child.id === nodeId);
  const copy = cloneSubtreeWithFreshIds(node, createId);

  const nextRoot = updateInTree(page.root, parent.id, (parentNode) => {
    const children = [...parentNode.children];
    children.splice(originalIndex + 1, 0, copy);
    return { ...parentNode, children };
  });
  return finish({ ...page, root: nextRoot });
}

/** Renames a layer (labels only — content is untouched, spec §9C). */
export function renameNode(page: FramePage, nodeId: string, name: string): FramePage {
  rejectRootOperation(page, nodeId, "renamed");
  requireTarget(page, nodeId);

  const trimmed = name.trim();
  if (trimmed.length === 0) throw new DocumentCommandError("Component name is required");
  if (trimmed.length > 120) {
    throw new DocumentCommandError("Component name must be under 120 characters");
  }

  const nextRoot = updateInTree(page.root, nodeId, (node) => ({ ...node, name: trimmed }));
  return finish({ ...page, root: nextRoot });
}

/**
 * Merges validated property updates. Unknown property keys and values that
 * fail the component's schema are rejected outright (spec §11, §12).
 */
export function updateNodeProps(
  page: FramePage,
  nodeId: string,
  updates: Record<string, unknown>,
): FramePage {
  rejectRootOperation(page, nodeId, "modified");
  const node = requireTarget(page, nodeId);
  const definition = getComponent(node.type);
  if (definition === undefined) {
    throw new DocumentCommandError(`Unknown component type "${node.type}"`);
  }
  if (Object.keys(updates).length === 0) return page;

  const merged = { ...node.props, ...updates };
  const parsed = definition.propSchema.safeParse(merged);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new DocumentCommandError(`Invalid properties for "${node.type}": ${detail}`);
  }

  // Reject keys the schema does not know (zod would silently strip them).
  const parsedData = parsed.data;
  if (typeof parsedData === "object" && parsedData !== null) {
    const knownKeys = Object.keys(parsedData);
    for (const key of Object.keys(merged)) {
      if (!knownKeys.includes(key)) {
        throw new DocumentCommandError(`Unknown property "${key}" for "${node.type}"`);
      }
    }
  }

  const nextRoot = updateInTree(page.root, nodeId, (current) => ({
    ...current,
    props: merged,
  }));
  return finish({ ...page, root: nextRoot });
}

const STYLE_BREAKPOINTS: ReadonlySet<string> = new Set(["base", ...RESPONSIVE_BREAKPOINTS]);

/** Shared validation for base and breakpoint style updates (spec §17). */
function assertValidStyleUpdates(updates: Record<string, StyleValue>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (!isSupportedStyleKey(key)) {
      throw new DocumentCommandError(
        `Style property "${key}" is not supported (spec §17 style model)`,
      );
    }
    if (value !== null && typeof value !== "string" && typeof value !== "number") {
      throw new DocumentCommandError(`Style "${key}" must be a string, number, or null`);
    }
    if (!isSafeStyleValue(value)) {
      throw new DocumentCommandError(`Style "${key}" contains an unsafe value`);
    }
    if (key === "opacity" && typeof value === "number" && (value < 0 || value > 1)) {
      throw new DocumentCommandError("Opacity must be between 0 and 1");
    }
  }
}

/**
 * Merges validated style updates into the base styles or one breakpoint's
 * overrides (spec §16, §17). Only properties in the supported style model are
 * accepted; `null` removes the declaration, and removing the last override of
 * a breakpoint drops the breakpoint record entirely (restores inheritance).
 */
export function updateNodeStyles(
  page: FramePage,
  nodeId: string,
  updates: Record<string, StyleValue>,
  breakpoint: StyleBreakpoint = "base",
): FramePage {
  rejectRootOperation(page, nodeId, "modified");
  const node = requireTarget(page, nodeId);
  if (!STYLE_BREAKPOINTS.has(breakpoint)) {
    throw new DocumentCommandError(`Unknown breakpoint "${String(breakpoint)}"`);
  }
  assertValidStyleUpdates(updates);

  if (breakpoint === "base") {
    const nextStyles: Record<string, StyleValue> = { ...node.styles };
    for (const [key, value] of Object.entries(updates)) {
      if (value === null)
        delete nextStyles[key]; // null clears the override
      else nextStyles[key] = value;
    }

    const nextRoot = updateInTree(page.root, nodeId, (current) => ({
      ...current,
      styles: nextStyles,
    }));
    return finish({ ...page, root: nextRoot });
  }

  // Narrower breakpoints keep independent override records (§16).
  const responsive: ResponsiveStyles = { ...(node.responsive ?? {}) };
  const overrides: Record<string, StyleValue> = { ...(responsive[breakpoint] ?? {}) };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) delete overrides[key];
    else overrides[key] = value;
  }

  const nextResponsive: ResponsiveStyles = { ...responsive };
  if (Object.keys(overrides).length === 0) delete nextResponsive[breakpoint];
  else nextResponsive[breakpoint] = overrides;

  const nextRoot = updateInTree(page.root, nodeId, (current) => ({
    ...current,
    responsive: nextResponsive,
  }));
  return finish({ ...page, root: nextRoot });
}

/** Hides/shows a component (editor metadata, spec §9C). */
export function setNodeVisibility(page: FramePage, nodeId: string, hidden: boolean): FramePage {
  rejectRootOperation(page, nodeId, "hidden");
  requireTarget(page, nodeId);
  const nextRoot = updateInTree(page.root, nodeId, (node) => ({
    ...node,
    editor: { ...node.editor, hidden },
  }));
  return finish({ ...page, root: nextRoot });
}

/** Locks/unlocks a component (editor metadata, spec §9C). */
export function setNodeLocked(page: FramePage, nodeId: string, locked: boolean): FramePage {
  rejectRootOperation(page, nodeId, "locked");
  requireTarget(page, nodeId);
  const nextRoot = updateInTree(page.root, nodeId, (node) => ({
    ...node,
    editor: { ...node.editor, locked },
  }));
  return finish({ ...page, root: nextRoot });
}

export interface PageSettingsUpdates {
  /** Display name of the page (§20 page management). */
  name?: string;
  title?: string;
  /** URL slug; normalized with `slugify` before storing. */
  slug?: string;
  backgroundColor?: string;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Updates page settings with validation (name, slug, title, background).
 * Slug uniqueness is enforced by the caller, which has the project context.
 */
export function updatePageSettings(page: FramePage, updates: PageSettingsUpdates): FramePage {
  const settings = { ...page.settings };
  let name = page.name;
  let slug = page.slug;

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (trimmed.length === 0) throw new DocumentCommandError("Page name is required");
    if (trimmed.length > 120) {
      throw new DocumentCommandError("Page name must be under 120 characters");
    }
    name = trimmed;
  }

  if (updates.slug !== undefined) {
    if (updates.slug.trim().length === 0) {
      throw new DocumentCommandError("Page slug is required");
    }
    slug = slugify(updates.slug);
  }

  if (updates.title !== undefined) {
    const title = updates.title.trim();
    if (title.length === 0) throw new DocumentCommandError("Page title is required");
    if (title.length > 200) {
      throw new DocumentCommandError("Page title must be under 200 characters");
    }
    settings.title = title;
  }

  if (updates.backgroundColor !== undefined) {
    if (!HEX_COLOR.test(updates.backgroundColor.trim())) {
      throw new DocumentCommandError("Background color must be a hex color like #ffffff");
    }
    settings.backgroundColor = updates.backgroundColor.trim();
  }

  return finish({ ...page, name, slug, settings });
}
