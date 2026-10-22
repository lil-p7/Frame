import { describe, expect, it } from "vitest";
import { createRootNode, type FrameNode, type FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { resolveInsertionTarget } from "@/features/editor/usePageCommands";

function node(id: string, type: string, children: FrameNode[] = []): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown type ${type}`);
  return { ...definition.createDefaultNode(), id, children };
}

function pageWith(rootChildren: FrameNode[]): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: { ...createRootNode("root"), children: rootChildren },
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}

describe("resolveInsertionTarget (Phase 4 insertion rules, spec §9A)", () => {
  it("inserts into the page root when nothing is selected", () => {
    const target = resolveInsertionTarget(pageWith([node("a", "section")]), null, "heading");
    expect(target).toEqual({ parentId: "root" });
  });

  it("treats a stale selection like no selection", () => {
    const target = resolveInsertionTarget(pageWith([node("a", "section")]), "ghost", "heading");
    expect(target).toEqual({ parentId: "root" });
  });

  it("nests into the selected container", () => {
    const page = pageWith([node("hero", "hero", [])]);
    const target = resolveInsertionTarget(page, "hero", "paragraph");
    expect(target).toEqual({ parentId: "hero", index: 0 });
  });

  it("places beside a selected leaf, under its parent", () => {
    const page = pageWith([
      node("stack", "stack", [node("first", "heading"), node("second", "spacer")]),
    ]);
    const target = resolveInsertionTarget(page, "first", "paragraph");
    expect(target).toEqual({ parentId: "stack", index: 1 });
  });

  it("appends beside the last child without exceeding the array bounds", () => {
    const page = pageWith([node("stack", "stack", [node("last", "heading")])]);
    const target = resolveInsertionTarget(page, "last", "paragraph");
    expect(target).toEqual({ parentId: "stack", index: 1 });
  });

  it("falls back to the root when the parent cannot host the type", () => {
    // A leaf that has (invalidly) collected children: its parent is a heading,
    // which accepts no children — the nearest valid position is the root.
    const page = pageWith([node("heading", "heading", [node("stray", "text")])]);
    const target = resolveInsertionTarget(page, "stray", "paragraph");
    expect(target).toEqual({ parentId: "root" });
  });

  it("falls back to the root when the selection is the structural root itself", () => {
    const page = pageWith([]);
    const target = resolveInsertionTarget(page, page.root.id, "section");
    expect(target).toEqual({ parentId: page.root.id });
  });
});
