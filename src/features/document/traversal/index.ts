import type { FrameNode } from "@/features/document/model";

/**
 * Pure tree traversal utilities (spec §34 `document/traversal`).
 * All functions treat nodes as immutable and never mutate the input tree.
 */

/** Pre-order walk over every node including the root. */
export function walkNodes(root: FrameNode, visit: (node: FrameNode) => void): void {
  visit(root);
  for (const child of root.children) walkNodes(child, visit);
}

/**
 * Pre-order walk that skips hidden subtrees (spec §9C): hidden components are
 * not rendered in the canvas, preview, or export, so style generation and
 * static rendering share this one rule.
 */
export function walkVisibleNodes(root: FrameNode, visit: (node: FrameNode) => void): void {
  if (root.editor.hidden) return;
  visit(root);
  for (const child of root.children) walkVisibleNodes(child, visit);
}

/** Finds a node by ID, or null when it is not in this tree. */
export function findNode(root: FrameNode, id: string): FrameNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found !== null) return found;
  }
  return null;
}

/** Finds the parent of a node by ID; the root's parent is null. */
export function findParent(root: FrameNode, id: string): FrameNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found !== null) return found;
  }
  return null;
}

/** Ancestor chain from the root down to `id` (inclusive), or null if absent. */
export function getPath(root: FrameNode, id: string): FrameNode[] | null {
  const path: FrameNode[] = [];
  const walk = (node: FrameNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  return walk(root) ? path : null;
}

/** True when `candidateId` is `ancestorId`'s descendant (or the same node). */
export function subtreeContains(ancestor: FrameNode, candidateId: string): boolean {
  return findNode(ancestor, candidateId) !== null;
}

/** Number of nodes in the tree, including the root. */
export function countNodes(root: FrameNode): number {
  let count = 0;
  walkNodes(root, () => {
    count += 1;
  });
  return count;
}

/**
 * Deep-clones a subtree with completely fresh IDs (spec §9: "Never reuse
 * IDs when duplicating components"). Props and styles are cloned too, so
 * the copy shares nothing mutable with the source.
 */
export function cloneSubtreeWithFreshIds(node: FrameNode, makeId: () => string): FrameNode {
  return {
    ...node,
    id: makeId(),
    props: structuredClone(node.props),
    styles: structuredClone(node.styles),
    // Responsive overrides belong to the copy, never to the source.
    ...(node.responsive === undefined ? {} : { responsive: structuredClone(node.responsive) }),
    children: node.children.map((child) => cloneSubtreeWithFreshIds(child, makeId)),
    editor: { ...node.editor },
  };
}
