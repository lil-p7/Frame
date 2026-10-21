import { describe, expect, it } from "vitest";
import {
  COMPONENT_DEFINITIONS,
  getComponent,
  isRegisteredType,
  listComponents,
} from "@/features/component-registry/registry";
import { COMPONENT_CATEGORIES } from "@/features/component-registry/types";
import { isValidStyleRecord } from "@/features/component-registry/styles";
import { buildNode } from "@/features/component-registry/define";
import { walkNodes } from "@/features/document/traversal";

describe("registry integrity", () => {
  it("registers every component exactly once with a valid category", () => {
    const types = COMPONENT_DEFINITIONS.map((def) => def.type);
    expect(new Set(types).size).toBe(types.length);
    for (const definition of COMPONENT_DEFINITIONS) {
      expect(COMPONENT_CATEGORIES).toContain(definition.category);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
    }
    expect(types).toEqual(
      expect.arrayContaining([
        "section",
        "container",
        "stack",
        "grid",
        "spacer",
        "heading",
        "paragraph",
        "text",
        "image",
        "button",
        "link",
        "divider",
        "navbar",
        "hero",
        "footer",
      ]),
    );
  });

  it("resolves known types and rejects unknown ones", () => {
    expect(getComponent("heading")?.label).toBe("Heading");
    expect(getComponent("nope")).toBeUndefined();
    expect(isRegisteredType("section")).toBe(true);
    expect(isRegisteredType("iframe")).toBe(false);
  });

  it("lists components per category without gaps", () => {
    const listed = listComponents("text").map((def) => def.type);
    expect(listed).toEqual(["heading", "paragraph", "text"]);
    const all = COMPONENT_CATEGORIES.flatMap((category) => listComponents(category));
    expect(all).toHaveLength(COMPONENT_DEFINITIONS.length);
  });
});

describe("createDefaultNode", () => {
  it("produces valid nodes with fresh unique IDs every time", () => {
    for (const definition of COMPONENT_DEFINITIONS) {
      const a = definition.createDefaultNode();
      const b = definition.createDefaultNode();

      expect(a.id).not.toBe(b.id);
      expect(a.type).toBe(definition.type);
      expect(a.name.length).toBeGreaterThan(0);
      expect(definition.validateProps(a.props)).toBe(true);
      expect(isValidStyleRecord(a.styles)).toBe(true);
      expect(a.editor).toEqual({ hidden: false, locked: false });

      // IDs are unique across the whole generated subtree.
      const ids: string[] = [];
      walkNodes(a, (node) => ids.push(node.id));
      expect(new Set(ids).size).toBe(ids.length);

      // Children are registered and themselves valid.
      walkNodes(a, (node) => {
        if (node.id === a.id) return;
        expect(isRegisteredType(node.type)).toBe(true);
        const childDef = getComponent(node.type);
        expect(childDef?.validateProps(node.props)).toBe(true);
      });
    }
  });

  it("never shares mutable defaults between nodes", () => {
    const first = getComponent("heading")!.createDefaultNode();
    first.props.text = "mutated";
    first.styles.margin = 99;

    const second = getComponent("heading")!.createDefaultNode();
    expect(second.props.text).toBe("Heading");
    expect(second.styles.margin).toBe(0);
  });

  it("marks composites as decomposable, not opaque", () => {
    for (const type of ["navbar", "hero", "footer"]) {
      const definition = getComponent(type)!;
      const node = definition.createDefaultNode();
      expect(definition.acceptsChildren).toBe(true);
      expect(node.children.length).toBeGreaterThan(0);
      for (const child of node.children) {
        expect(isRegisteredType(child.type)).toBe(true);
      }
    }
  });

  it("buildNode honors the definition's own defaults", () => {
    const node = buildNode(getComponent("stack")!);
    expect(node.styles.display).toBe("flex");
    expect(node.children).toEqual([]);
  });
});

describe("prop schemas reject unsafe input", () => {
  it("image sources: accepts safe values, rejects active schemes", () => {
    const image = getComponent("image")!;
    expect(image.validateProps({ src: "", alt: "" })).toBe(true);
    expect(image.validateProps({ src: "/assets/pic.png", alt: "x" })).toBe(true);
    expect(image.validateProps({ src: "https://example.com/p.png", alt: "" })).toBe(true);
    expect(image.validateProps({ src: "data:image/png;base64,AAAA", alt: "" })).toBe(true);
    expect(image.validateProps({ src: "javascript:alert(1)", alt: "" })).toBe(false);
  });

  it("link and button hrefs reject javascript: destinations", () => {
    const link = getComponent("link")!;
    expect(link.validateProps({ label: "x", href: "#top", newTab: false })).toBe(true);
    expect(link.validateProps({ label: "x", href: "https://x.dev", newTab: true })).toBe(true);
    expect(link.validateProps({ label: "x", href: "javascript:alert(1)", newTab: false })).toBe(
      false,
    );

    const button = getComponent("button")!;
    expect(button.validateProps({ label: "Go", href: "/next" })).toBe(true);
    expect(button.validateProps({ label: "Go", href: "javascript:void(0)" })).toBe(false);
  });

  it("heading levels are bounded to h1–h6", () => {
    const heading = getComponent("heading")!;
    expect(heading.validateProps({ level: 1, text: "a" })).toBe(true);
    expect(heading.validateProps({ level: 6, text: "a" })).toBe(true);
    expect(heading.validateProps({ level: 0, text: "a" })).toBe(false);
    expect(heading.validateProps({ level: 9, text: "a" })).toBe(false);
    expect(heading.validateProps({ level: 2, text: 42 })).toBe(false);
  });
});
