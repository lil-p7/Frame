import { describe, expect, it } from "vitest";
import type { FrameNode, FramePage } from "@/features/document/model";
import { ROOT_NODE_TYPE } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import {
  bandFromPointerRatio,
  canDropInside,
  effectiveBand,
  isMovableNodeId,
  resolveDropTarget,
  resolveSiblingShift,
} from "@/features/editor/dnd/dropResolution";

function node(
  id: string,
  type: string,
  children: FrameNode[] = [],
  editor: FrameNode["editor"] = { hidden: false, locked: false },
): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`fixture: unknown type ${type}`);
  return {
    id,
    type,
    name: id,
    props: definition.createDefaultProps(),
    styles: {},
    children,
    editor,
  };
}

function page(rootChildren: FrameNode[]): FramePage {
  return {
    id: "page-1",
    name: "Page",
    slug: "page",
    root: node("root", ROOT_NODE_TYPE, rootChildren),
    settings: { title: "Page", backgroundColor: "#ffffff" },
  };
}

describe("bandFromPointerRatio", () => {
  it("splits the droppable into before / inside / after zones (§15)", () => {
    expect(bandFromPointerRatio(0.1)).toBe("before");
    expect(bandFromPointerRatio(0.5)).toBe("inside");
    expect(bandFromPointerRatio(0.9)).toBe("after");
    // Boundaries: exactly on the 25% marks count as the edge zones.
    expect(bandFromPointerRatio(0.25)).toBe("inside");
    expect(bandFromPointerRatio(0.75)).toBe("inside");
  });
});

describe("resolveDropTarget — library drags", () => {
  const p = page([node("s1", "section", [node("h1", "heading")]), node("s2", "section")]);
  const paragraph = { kind: "library", componentType: "paragraph" } as const;

  it("resolves before and after a sibling at the page root", () => {
    expect(resolveDropTarget(p, paragraph, "s1", "before", 0.1)).toEqual({
      parentId: "root",
      index: 0,
    });
    expect(resolveDropTarget(p, paragraph, "s1", "after", 0.9)).toEqual({
      parentId: "root",
      index: 1,
    });
  });

  it("resolves inside a container as append (spec §15 empty containers)", () => {
    expect(resolveDropTarget(p, paragraph, "s1", "inside", 0.5)).toEqual({
      parentId: "s1",
      index: 1,
    });
  });

  it("drops on the root zone (empty page / padding) at the end of the page (§10)", () => {
    expect(resolveDropTarget(p, paragraph, "root", "inside", 0.5)).toEqual({
      parentId: "root",
      index: 2,
    });
  });

  it("degrades 'inside' over a leaf to the nearer edge — never nests illegally", () => {
    // heading does not accept children: middle-top becomes before, middle-bottom after.
    expect(resolveDropTarget(p, paragraph, "h1", "inside", 0.4)).toEqual({
      parentId: "s1",
      index: 0,
    });
    expect(resolveDropTarget(p, paragraph, "h1", "inside", 0.6)).toEqual({
      parentId: "s1",
      index: 1,
    });
  });

  it("rejects unknown component types", () => {
    const bogus = { kind: "library", componentType: "nope" } as const;
    expect(resolveDropTarget(p, bogus, "s1", "inside", 0.5)).toBeNull();
  });
});

describe("resolveDropTarget — node moves (§9C, §15)", () => {
  const tree = () =>
    page([
      node("s1", "section", [node("h1", "heading"), node("h2", "heading")]),
      node("s2", "section", [node("h3", "heading")]),
    ]);
  const move = (nodeId: string) => ({ kind: "node", nodeId }) as const;

  it("preserves identity targets: moves to sibling slots without touching the node", () => {
    const p = tree();
    // h1 dragged after h2 (same parent): current-tree slot 2.
    expect(resolveDropTarget(p, move("h1"), "h2", "after", 0.9)).toEqual({
      parentId: "s1",
      index: 2,
    });
  });

  it("refuses a node dragged over itself", () => {
    expect(resolveDropTarget(tree(), move("s1"), "s1", "before", 0.1)).toBeNull();
    expect(resolveDropTarget(tree(), move("s1"), "s1", "after", 0.9)).toBeNull();
  });

  it("never moves a node into its own descendant (cycle prevention)", () => {
    const p = tree();
    // "Inside h1" for s1 itself: invalid cycle → degraded to the nearer edge.
    expect(effectiveBand(p, move("s1"), "h1", "inside", 0.3)).toBe("before");
    expect(canDropInside(p, "h1", "section", "s1")).toBe(false);
    expect(canDropInside(p, "s2", "section", "s1")).toBe(true);
  });

  it("does not accept drops inside locked containers", () => {
    const locked = page([
      node("s1", "section", [], { hidden: false, locked: true }),
      node("s2", "section"),
    ]);
    expect(canDropInside(locked, "s1", "heading")).toBe(false);
    // Sibling positions around it remain usable: the middle band over the
    // locked container degrades to the nearer edge (bottom half → after).
    expect(
      resolveDropTarget(
        locked,
        { kind: "library", componentType: "heading" },
        "s1",
        "inside",
        0.5,
      ),
    ).toEqual({ parentId: "root", index: 1 });
  });

  it("reports movability: root and locked nodes are not draggable", () => {
    const locked = page([node("s1", "section", [], { hidden: false, locked: true })]);
    expect(isMovableNodeId(locked, "root")).toBe(false);
    expect(isMovableNodeId(locked, "s1")).toBe(false);
    expect(isMovableNodeId(locked, "s2missing")).toBe(false);
  });
});

describe("resolveSiblingShift — keyboard alternative (§15)", () => {
  const p = page([node("a", "section"), node("b", "section"), node("c", "section")]);

  it("moves up = before the previous sibling", () => {
    expect(resolveSiblingShift(p, "b", "up")).toEqual({ parentId: "root", index: 0 });
    expect(resolveSiblingShift(p, "a", "up")).toBeNull();
  });

  it("moves down = after the next sibling (matches moveLayer's slot semantics)", () => {
    expect(resolveSiblingShift(p, "b", "down")).toEqual({ parentId: "root", index: 3 });
    expect(resolveSiblingShift(p, "c", "down")).toBeNull();
  });

  it("refuses the root and unknown nodes", () => {
    expect(resolveSiblingShift(p, "root", "up")).toBeNull();
    expect(resolveSiblingShift(p, "missing", "down")).toBeNull();
  });
});
