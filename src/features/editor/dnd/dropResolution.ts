import type { FramePage } from "@/features/document/model";
import { findNode, findParent, subtreeContains } from "@/features/document/traversal";
import { getComponent, parentAllowsChild } from "@/features/component-registry/registry";

/**
 * Drop-target resolution (spec §15).
 *
 * A deliberate strategy — never raw pointer coordinates alone: dnd-kit
 * droppable zones identify *which component* the pointer is over, the band
 * says *where relative to it*, and registry metadata (`acceptsChildren`,
 * `allowedChildTypes`, locks, cycles) decides *whether* the outcome is valid.
 * Everything here is pure so resolution is unit-testable; the surfaces only
 * render indicators and hand the result to the command layer on drop.
 */

/** Where relative to the overed component the drop lands. */
export type DropBand = "before" | "inside" | "after";

/** What the current drag is carrying. */
export type DragPayload =
  { kind: "library"; componentType: string } | { kind: "node"; nodeId: string };

/** Resolved drop outcome; `index` is a slot in the *current* children array. */
export interface DropTarget {
  parentId: string;
  index: number;
}

/** Top/bottom fractions of a droppable that mean before/after (§15 zones). */
const EDGE_BAND = 0.25;

/**
 * Maps the pointer's position within the overed droppable's rect to a band.
 * The middle of a container means "inside it"; the edges mean between
 * siblings (spec §15: before a sibling / after a sibling / inside a container).
 */
export function bandFromPointerRatio(ratio: number): DropBand {
  if (ratio < EDGE_BAND) return "before";
  if (ratio > 1 - EDGE_BAND) return "after";
  return "inside";
}

/** Client Y coordinate of the pointer for an in-flight dnd-kit event. */
export function pointerYFrom(activatorEvent: Event, deltaY: number): number | null {
  const clientY = (activatorEvent as PointerEvent | MouseEvent).clientY;
  return Number.isFinite(clientY) ? clientY + deltaY : null;
}

/** Effective band for a target that does not accept children (or is locked). */
function degradeInside(band: DropBand, ratio: number): DropBand {
  if (band !== "inside") return band;
  return ratio < 0.5 ? "before" : "after";
}

/**
 * True when `childType` may be dropped *inside* `page`'s node `overNodeId`:
 * the parent accepts children of that type and, for node drags, the move is
 * not a cycle (a node cannot enter its own subtree, §9C/§15). Locked
 * containers do not accept drops inside — they ignore ordinary canvas
 * interactions (§9C).
 */
export function canDropInside(
  page: FramePage,
  overNodeId: string,
  childType: string,
  movingNodeId?: string,
): boolean {
  if (overNodeId === page.root.id) return true;
  const over = findNode(page.root, overNodeId);
  if (over === null || over.editor.locked) return false;
  if (!parentAllowsChild(over.type, childType)) return false;
  if (movingNodeId !== undefined) {
    if (overNodeId === movingNodeId) return false;
    if (subtreeContains(over, movingNodeId)) return false;
  }
  return true;
}

/** The child type a drag payload would place, or null when unresolvable. */
function childTypeOf(page: FramePage, payload: DragPayload): string | null {
  const type =
    payload.kind === "library" ? payload.componentType : findNode(page.root, payload.nodeId)?.type;
  return type !== undefined && getComponent(type) !== undefined ? type : null;
}

/**
 * The band that will actually be shown/committed: "inside" over an
 * incompatible, locked, or cycle-forming target degrades to the nearer
 * edge so a valid sibling position can still be picked. Returns null when
 * the payload itself is unresolvable (unknown type / missing node).
 */
export function effectiveBand(
  page: FramePage,
  payload: DragPayload,
  overNodeId: string,
  band: DropBand,
  ratio: number,
): DropBand | null {
  const childType = childTypeOf(page, payload);
  if (childType === null) return null;
  if (band !== "inside") return band;
  const movingNodeId = payload.kind === "node" ? payload.nodeId : undefined;
  return canDropInside(page, overNodeId, childType, movingNodeId)
    ? "inside"
    : degradeInside(band, ratio);
}

/**
 * Resolves where a drag should land when it is over `overNodeId`.
 *
 * Returns null when the highlighted target would be invalid — callers show
 * no indicator and drop nothing (spec §15 "invalid-drop prevention").
 *
 * `ratio` is the pointer's position within the overed component's rect
 * (0 = top edge, 1 = bottom edge); it only picks the band for targets that
 * do not accept children, where "inside" degrades to the nearer edge.
 */
export function resolveDropTarget(
  page: FramePage,
  payload: DragPayload,
  overNodeId: string,
  band: DropBand,
  ratio: number,
): DropTarget | null {
  const childType = childTypeOf(page, payload);
  if (childType === null) return null;
  const effective = effectiveBand(page, payload, overNodeId, band, ratio);
  if (effective === null) return null;

  // Dropping onto the structural root: everything lands at the end of root
  // (the root has no siblings; empty-page drops work, spec §10).
  if (overNodeId === page.root.id) {
    return { parentId: page.root.id, index: page.root.children.length };
  }

  const over = findNode(page.root, overNodeId);
  const parent = over === null ? null : findParent(page.root, overNodeId);
  if (over === null || parent === null) return null;
  const siblingIndex = parent.children.findIndex((child) => child.id === overNodeId);

  // A node dragged directly over itself: those positions are no-ops (§15).
  if (payload.kind === "node" && payload.nodeId === overNodeId) return null;

  if (effective === "inside") {
    return { parentId: overNodeId, index: over.children.length };
  }
  if (effective === "before") return { parentId: parent.id, index: siblingIndex };
  return { parentId: parent.id, index: siblingIndex + 1 };
}

/**
 * Layer-tree keyboard alternative (spec §15: "keyboard users must have
 * alternative methods to reorder"): swaps a node with its previous/next
 * sibling by expressing the move as a drop — "before the previous
 * sibling" or "after the next sibling" — in the same current-tree slot
 * semantics `resolveDropTarget` returns, so `moveLayer`'s removal-index
 * conversion applies unchanged. Returns null when there is no such sibling.
 */
export function resolveSiblingShift(
  page: FramePage,
  nodeId: string,
  direction: "up" | "down",
): DropTarget | null {
  if (nodeId === page.root.id) return null;
  const parent = findParent(page.root, nodeId);
  if (parent === null) return null;
  const index = parent.children.findIndex((child) => child.id === nodeId);
  if (index === -1) return null;
  if (direction === "up") {
    const before = index - 1;
    return before < 0 ? null : { parentId: parent.id, index: before };
  }
  // "Down" = drop after the next sibling = the slot right after it.
  const after = index + 2;
  return after > parent.children.length ? null : { parentId: parent.id, index: after };
}

/** Ordinary moves: the structural root and locked nodes are not draggable. */
export function isMovableNodeId(page: FramePage, nodeId: string): boolean {
  if (nodeId === page.root.id) return false;
  const node = findNode(page.root, nodeId);
  return node !== null && node.editor.locked === false;
}
