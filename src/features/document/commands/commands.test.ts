import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { FrameNode, FramePage } from "@/features/document/model";
import { createRootNode } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import {
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
} from "@/features/document/commands";
import { countNodes, findNode, getPath, walkNodes } from "@/features/document/traversal";
import { validatePage } from "@/features/document/validation";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject, getProject } from "@/features/projects/services/projectService";

function freshPage(): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: createRootNode("root"),
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}

function nodeOfType(type: string): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown type ${type}`);
  return definition.createDefaultNode();
}

describe("insertNode", () => {
  it("appends to the root and inserts at an explicit index", () => {
    const page = freshPage();
    const a = nodeOfType("section");
    const b = nodeOfType("section");

    const afterAppend = insertNode(page, { parentId: "root", node: a });
    expect(afterAppend.root.children.map((c) => c.id)).toEqual([a.id]);

    const afterInsert = insertNode(afterAppend, { parentId: "root", index: 0, node: b });
    expect(afterInsert.root.children.map((c) => c.id)).toEqual([b.id, a.id]);

    // The input page is never mutated.
    expect(page.root.children).toEqual([]);
    expect(validatePage(afterInsert)).toEqual([]);
  });

  it("inserts into nested containers and clamps out-of-range indexes", () => {
    const page = freshPage();
    const stack = nodeOfType("stack");
    const paragraph = nodeOfType("paragraph");

    const withStack = insertNode(page, { parentId: "root", node: stack });
    const nested = insertNode(withStack, {
      parentId: stack.id,
      index: 99,
      node: paragraph,
    });
    const stackNode = findNode(nested.root, stack.id)!;
    expect(stackNode.children.map((c) => c.id)).toEqual([paragraph.id]);
  });

  it("rejects unknown types, invalid props, missing parents, and full containers", () => {
    const page = freshPage();

    const bogus: FrameNode = {
      id: "x1",
      type: "mystery-widget",
      name: "Mystery",
      props: {},
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    };
    expect(() => insertNode(page, { parentId: "root", node: bogus })).toThrow(
      /Unknown component type/,
    );

    const heading = nodeOfType("heading");
    heading.props = { level: 42, text: "hi" };
    expect(() => insertNode(page, { parentId: "root", node: heading })).toThrow(/Invalid props/);

    expect(() => insertNode(page, { parentId: "ghost", node: nodeOfType("section") })).toThrow(
      /does not exist/,
    );

    // A component that does not accept children is rejected as a parent.
    const withLeaf = insertNode(page, { parentId: "root", node: nodeOfType("paragraph") });
    expect(() =>
      insertNode(withLeaf, {
        parentId: withLeaf.root.children[0]!.id,
        node: nodeOfType("section"),
      }),
    ).toThrow(/does not accept children/);
  });

  it("rejects duplicate IDs (spec §12: IDs unique within a project)", () => {
    const page = freshPage();
    const section = nodeOfType("section");
    const withSection = insertNode(page, { parentId: "root", node: section });

    const cloneWithSameId: FrameNode = { ...section, id: section.id };
    expect(() => insertNode(withSection, { parentId: "root", node: cloneWithSameId })).toThrow(
      /Duplicate component ID/,
    );
  });
});

describe("deleteNode", () => {
  it("deletes a component and its subtree, leaving the input untouched", () => {
    const page = freshPage();
    const stack = nodeOfType("stack");
    const inserted = insertNode(page, {
      parentId: "root",
      node: stack,
    });
    const nested = insertNode(inserted, {
      parentId: stack.id,
      node: nodeOfType("paragraph"),
    });

    const after = deleteNode(nested, stack.id);
    expect(after.root.children).toEqual([]);
    expect(countNodes(after.root)).toBe(1); // root only
    // Original page unchanged.
    expect(countNodes(nested.root)).toBe(3);
  });

  it("never deletes the page root (Phase 3 acceptance criterion)", () => {
    const page = freshPage();
    expect(() => deleteNode(page, "root")).toThrow(/page root cannot be deleted/);
    expect(() => deleteNode(page, "ghost")).toThrow(/does not exist/);
    expect(page.root.id).toBe("root");
  });
});

describe("moveNode", () => {
  it("reorders siblings while preserving component identity", () => {
    const page = freshPage();
    const a = nodeOfType("section");
    const b = nodeOfType("section");
    const c = nodeOfType("section");
    let next = insertNode(page, { parentId: "root", node: a });
    next = insertNode(next, { parentId: "root", node: b });
    next = insertNode(next, { parentId: "root", node: c });

    // Move `a` (index 0) to the end of the root: post-removal index 2.
    const moved = moveNode(next, { nodeId: a.id, newParentId: "root", index: 2 });
    expect(moved.root.children.map((n) => n.id)).toEqual([b.id, c.id, a.id]);
    // Same object identity — moving never clones (spec §15).
    expect(moved.root.children[2]).toBe(a);
    expect(next.root.children[0]).toBe(a);
    expect(validatePage(moved)).toEqual([]);
  });

  it("moves into another container", () => {
    const page = freshPage();
    const stack = nodeOfType("stack");
    const section = nodeOfType("section");
    let next = insertNode(page, { parentId: "root", node: stack });
    next = insertNode(next, { parentId: "root", node: section });

    const moved = moveNode(next, { nodeId: section.id, newParentId: stack.id, index: 0 });
    expect(moved.root.children.map((n) => n.id)).toEqual([stack.id]);
    expect(moved.root.children[0]!.children.map((n) => n.id)).toEqual([section.id]);
  });

  it("prevents cycles: into itself or its own descendant", () => {
    const page = freshPage();
    const stack = nodeOfType("stack");
    const inner = nodeOfType("stack");
    let next = insertNode(page, { parentId: "root", node: stack });
    next = insertNode(next, { parentId: stack.id, node: inner });

    expect(() => moveNode(next, { nodeId: stack.id, newParentId: stack.id })).toThrow(
      /cannot be moved into itself/,
    );
    expect(() => moveNode(next, { nodeId: stack.id, newParentId: inner.id })).toThrow(
      /into its own descendant/,
    );
    expect(() => moveNode(next, { nodeId: "root", newParentId: "root" })).toThrow(
      /page root cannot be moved/,
    );
  });

  it("rejects destinations that do not accept children", () => {
    const page = freshPage();
    const section = nodeOfType("section");
    let next = insertNode(page, { parentId: "root", node: section });
    const paragraph = nodeOfType("paragraph");
    next = insertNode(next, { parentId: "root", node: paragraph });

    expect(() => moveNode(next, { nodeId: section.id, newParentId: paragraph.id })).toThrow(
      /does not accept children/,
    );
    expect(() => moveNode(next, { nodeId: "ghost", newParentId: "root" })).toThrow(
      /does not exist/,
    );
  });
});

describe("duplicateNode", () => {
  it("creates fresh IDs throughout the copied subtree and inserts it after the original", () => {
    const page = freshPage();
    const hero = nodeOfType("hero"); // composite with children
    const inserted = insertNode(page, { parentId: "root", node: hero });

    const duplicated = duplicateNode(inserted, hero.id);
    expect(duplicated.root.children).toHaveLength(2);
    const [original, copy] = duplicated.root.children;
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.type).toBe(hero.type);
    expect(copy!.name).toBe(original!.name);

    const originalIds = new Set<string>();
    walkNodes(original!, (n) => originalIds.add(n.id));
    walkNodes(copy!, (n) => expect(originalIds.has(n.id)).toBe(false));
    expect(validatePage(duplicated)).toEqual([]);

    // Source page untouched.
    expect(inserted.root.children).toHaveLength(1);
  });

  it("refuses the root and unknown component types", () => {
    const page = freshPage();
    expect(() => duplicateNode(page, "root")).toThrow(/page root cannot be duplicated/);

    const broken: FramePage = {
      ...page,
      root: {
        ...page.root,
        children: [
          {
            id: "legacy-1",
            type: "legacy-widget",
            name: "Legacy",
            props: {},
            styles: {},
            children: [],
            editor: { hidden: false, locked: false },
          },
        ],
      },
    };
    expect(() => duplicateNode(broken, "legacy-1")).toThrow(/not registered/);
  });
});

describe("renameNode and property/style commands", () => {
  it("renames layers with validation", () => {
    const page = freshPage();
    const section = nodeOfType("section");
    const inserted = insertNode(page, { parentId: "root", node: section });

    const renamed = renameNode(inserted, section.id, "  Hero band  ");
    expect(findNode(renamed.root, section.id)!.name).toBe("Hero band");
    expect(() => renameNode(inserted, section.id, "   ")).toThrow(/name is required/);
    expect(() => renameNode(inserted, section.id, "x".repeat(121))).toThrow(/under 120/);
    expect(() => renameNode(inserted, "root", "nope")).toThrow(/page root cannot be renamed/);
  });

  it("updates props after schema validation and rejects unknown keys", () => {
    const page = freshPage();
    const heading = nodeOfType("heading");
    const inserted = insertNode(page, { parentId: "root", node: heading });

    const updated = updateNodeProps(inserted, heading.id, { text: "Hello", level: 1 });
    expect(findNode(updated.root, heading.id)!.props).toEqual({ level: 1, text: "Hello" });

    expect(() => updateNodeProps(inserted, heading.id, { level: 9 })).toThrow(/Invalid properties/);
    expect(() => updateNodeProps(inserted, heading.id, { nope: 1 })).toThrow(/Unknown property/);
    expect(() => updateNodeProps(inserted, "root", { text: "x" })).toThrow(
      /page root cannot be modified/,
    );
    // Empty update is a no-op that returns the same page.
    expect(updateNodeProps(inserted, heading.id, {})).toBe(inserted);
  });

  it("updates styles with the supported style model and clears via null", () => {
    const page = freshPage();
    const section = nodeOfType("section");
    const inserted = insertNode(page, { parentId: "root", node: section });

    const styled = updateNodeStyles(inserted, section.id, {
      padding: 40,
      backgroundColor: "#000000",
    });
    const styledNode = findNode(styled.root, section.id)!;
    expect(styledNode.styles.padding).toBe(40);
    expect(styledNode.styles.backgroundColor).toBe("#000000");

    const cleared = updateNodeStyles(styled, section.id, { backgroundColor: null });
    // null removes the override entirely — no lingering key.
    expect(findNode(cleared.root, section.id)!.styles.backgroundColor).toBeUndefined();

    expect(() => updateNodeStyles(inserted, section.id, { zIndex: 3 })).toThrow(/not supported/);
    expect(() =>
      updateNodeStyles(inserted, section.id, { backgroundImage: "url(javascript:alert(1))" }),
    ).toThrow(/not supported/);
    expect(() => updateNodeStyles(inserted, section.id, { color: "javascript:alert(1)" })).toThrow(
      /unsafe value/,
    );
    expect(() => updateNodeStyles(inserted, section.id, { opacity: 2 })).toThrow(/between 0 and 1/);
    expect(() => updateNodeStyles(inserted, "root", { padding: 4 })).toThrow(
      /page root cannot be modified/,
    );
  });
});

describe("visibility, locking, and page settings", () => {
  it("toggles editor metadata on components only", () => {
    const page = freshPage();
    const section = nodeOfType("section");
    const inserted = insertNode(page, { parentId: "root", node: section });

    const hidden = setNodeVisibility(inserted, section.id, true);
    expect(findNode(hidden.root, section.id)!.editor.hidden).toBe(true);
    const locked = setNodeLocked(hidden, section.id, true);
    expect(findNode(locked.root, section.id)!.editor.locked).toBe(true);
    expect(validatePage(locked)).toEqual([]);

    expect(() => setNodeVisibility(inserted, "root", true)).toThrow(/page root cannot be hidden/);
    expect(() => setNodeLocked(inserted, "root", true)).toThrow(/page root cannot be locked/);
  });

  it("validates page settings", () => {
    const page = freshPage();
    const updated = updatePageSettings(page, { title: "  About  ", backgroundColor: "#ABCDEF" });
    expect(updated.settings).toEqual({ title: "About", backgroundColor: "#ABCDEF" });
    expect(page.settings.title).toBe("Home"); // input untouched

    expect(() => updatePageSettings(page, { title: "   " })).toThrow(/title is required/);
    expect(() => updatePageSettings(page, { backgroundColor: "red" })).toThrow(/hex color/);
    expect(() => updatePageSettings(page, { backgroundColor: "javascript:alert(1)" })).toThrow(
      /hex color/,
    );
  });
});

describe("saving and loading preserves the tree (Phase 3 acceptance)", () => {
  it("round-trips a command-modified page through IndexedDB", async () => {
    const repository = new DexieProjectRepository("commands-roundtrip");
    const project = await createProject(repository, { name: "Round Trip" });

    const page = project.pages[0]!;
    expect(page).toBeDefined();
    const hero = nodeOfType("hero");
    const withHero = insertNode(page, { parentId: page.root.id, node: hero });
    const renamed = renameNode(withHero, hero.id, "Landing hero");
    const styled = updateNodeStyles(renamed, hero.id, { padding: 72 });

    const modified = { ...project, pages: [styled] };
    await repository.saveProject(modified);

    const reloaded = await getProject(repository, project.id);
    expect(reloaded).not.toBeNull();
    const reloadedPage = reloaded!.pages[0]!;
    expect(validatePage(reloadedPage)).toEqual([]);
    expect(reloadedPage.root.children).toHaveLength(1);
    const reloadedHero = reloadedPage.root.children[0]!;
    expect(reloadedHero.name).toBe("Landing hero");
    expect(reloadedHero.styles.padding).toBe(72);
    expect(reloadedHero.id).toBe(hero.id); // stable ID across persistence
    expect(getPath(reloadedPage.root, hero.id)?.length).toBe(2);
    // Composite preset children survived too.
    expect(reloadedHero.children.length).toBeGreaterThan(0);
  });
});
