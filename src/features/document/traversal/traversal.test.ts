import { describe, expect, it } from "vitest";
import { createRootNode, type FrameNode } from "@/features/document/model";
import {
  cloneSubtreeWithFreshIds,
  countNodes,
  findNode,
  findParent,
  getPath,
  subtreeContains,
  walkNodes,
} from "@/features/document/traversal";
import { createId } from "@/lib/ids";

function node(id: string, children: FrameNode[] = []): FrameNode {
  return {
    id,
    type: "section",
    name: id,
    props: {},
    styles: {},
    children,
    editor: { hidden: false, locked: false },
  };
}

function makeTree(): FrameNode {
  // root > a > a1, a2 ; root > b
  return {
    ...createRootNode("root"),
    children: [node("a", [node("a1"), node("a2")]), node("b")],
  };
}

describe("traversal", () => {
  it("walks every node in pre-order", () => {
    const visited: string[] = [];
    walkNodes(makeTree(), (current) => visited.push(current.id));
    expect(visited).toEqual(["root", "a", "a1", "a2", "b"]);
  });

  it("finds nodes, parents, and ancestor paths", () => {
    const root = makeTree();
    expect(findNode(root, "a1")?.id).toBe("a1");
    expect(findNode(root, "missing")).toBeNull();
    expect(findParent(root, "a1")?.id).toBe("a");
    expect(findParent(root, "root")).toBeNull();
    expect(getPath(root, "a1")?.map((n) => n.id)).toEqual(["root", "a", "a1"]);
    expect(getPath(root, "missing")).toBeNull();
    expect(countNodes(root)).toBe(5);
  });

  it("answers subtree containment (used for cycle checks)", () => {
    const root = makeTree();
    const a = findNode(root, "a")!;
    expect(subtreeContains(a, "a")).toBe(true);
    expect(subtreeContains(a, "a2")).toBe(true);
    expect(subtreeContains(a, "b")).toBe(false);
    expect(subtreeContains(root, "b")).toBe(true);
  });

  it("clones subtrees with fresh IDs without touching the source", () => {
    const source = makeTree();
    const before = JSON.stringify(source);
    const clone = cloneSubtreeWithFreshIds(findNode(source, "a")!, createId);

    expect(JSON.stringify(source)).toBe(before);
    expect(clone.id).not.toBe("a");
    expect(clone.name).toBe("a");
    expect(clone.children).toHaveLength(2);

    const sourceIds = new Set<string>();
    walkNodes(source, (current) => sourceIds.add(current.id));
    walkNodes(clone, (current) => expect(sourceIds.has(current.id)).toBe(false));

    // Mutating the clone never reaches the source.
    clone.props.mutated = true;
    expect(findNode(source, "a")!.props.mutated).toBeUndefined();
  });
});
