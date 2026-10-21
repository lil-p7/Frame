import type { FrameNode } from "@/features/document/model";

/** Collects node IDs from a subtree (excluding the given root itself). */
export function collectNodeIds(nodes: FrameNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectNodeIds(node.children)]);
}
