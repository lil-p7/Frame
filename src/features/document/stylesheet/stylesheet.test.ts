import { describe, expect, it } from "vitest";
import { createRootNode, type FrameNode, type FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import {
  COMPONENT_BASE_CSS,
  PAGE_CLASS,
  SITE_RESET_CSS,
  nodeClassName,
  nodeSelector,
  pageStyleRules,
  pageStylesheet,
} from "@/features/document/stylesheet";

function node(
  type: string,
  overrides: {
    id: string;
    styles?: Record<string, string | number | null>;
    responsive?: FrameNode["responsive"];
    hidden?: boolean;
    children?: FrameNode[];
  },
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    id: overrides.id,
    styles: overrides.styles ?? {},
    ...(overrides.responsive === undefined ? {} : { responsive: overrides.responsive }),
    children: overrides.children ?? [],
    editor: { hidden: overrides.hidden ?? false, locked: false },
  };
}

function page(children: FrameNode[], backgroundColor = "#ffffff"): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: { ...createRootNode("root-1"), children },
    settings: { title: "Home", backgroundColor },
  };
}

describe("page stylesheet (spec §16, §17)", () => {
  it("builds a CSS-safe class name from an untrusted node ID", () => {
    expect(nodeClassName("2f4c-9b21")).toBe("fr-2f4c-9b21");
    // Stored IDs are untrusted input (§32): anything unsafe is replaced.
    expect(nodeClassName('a b"c)d{e')).toBe("fr-a-b-c-d-e");
    expect(nodeSelector("abc")).toBe(".fr-abc");
  });

  it("emits base declarations plus media-query overrides in responsive mode", () => {
    const target = node("grid", {
      id: "grid-1",
      styles: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 },
      responsive: { mobile: { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" } },
    });
    const css = pageStylesheet(page([target]), "responsive");

    expect(css).toContain(".fr-grid-1 {");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain("gap: 24px;");
    // The override travels inside its own breakpoint's media query.
    expect(css).toContain("@media (max-width: 639.98px)");
    expect(css).toContain("grid-template-columns: repeat(1, minmax(0, 1fr));");
  });

  it("resolves preview mode to unconditional declarations with no media queries", () => {
    const target = node("grid", {
      id: "grid-1",
      styles: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
      responsive: { mobile: { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" } },
    });
    const mobile = pageStylesheet(page([target]), "mobile");
    expect(mobile).not.toContain("@media");
    expect(mobile).toContain("grid-template-columns: repeat(1, minmax(0, 1fr));");

    // A breakpoint without overrides falls back to the base record (§16).
    const tablet = pageStylesheet(page([target]), "tablet");
    expect(tablet).not.toContain("@media");
    expect(tablet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
  });

  it("applies the page background as a page-level rule", () => {
    const css = pageStylesheet(page([], "#101828"), "responsive");
    expect(css).toContain(`.${PAGE_CLASS} {`);
    expect(css).toContain("background-color: #101828;");
  });

  it("skips hidden nodes and unsupported or unsafe declarations", () => {
    const hidden = node("section", { id: "hidden-1", styles: { padding: 40 }, hidden: true });
    const unsafe = node("section", {
      id: "unsafe-1",
      styles: { padding: 12, backgroundColor: "javascript:alert(1)", nope: 2 },
    });
    const css = pageStylesheet(page([hidden, unsafe]), "responsive");

    expect(css).not.toContain(".fr-hidden-1");
    expect(css).toContain(".fr-unsafe-1 {");
    expect(css).toContain("padding: 12px;");
    expect(css).not.toContain("javascript:");
    expect(css).not.toContain("nope");
  });

  it("is deterministic: the same page always produces the same CSS", () => {
    const children = [
      node("section", { id: "s-1", styles: { padding: 24 } }),
      node("stack", { id: "s-2", styles: { gap: 8, display: "flex" } }),
    ];
    const first = pageStyleRules(page(children), "responsive");
    const second = pageStyleRules(page(children), "responsive");
    expect(second).toEqual(first);
    expect(pageStylesheet(page(children), "responsive")).toBe(
      pageStylesheet(page(children), "responsive"),
    );
  });

  it("ships the shared component base styles and the export reset", () => {
    for (const rule of [".frame-button", ".frame-divider", ".frame-placeholder", `.${PAGE_CLASS}`]) {
      expect(COMPONENT_BASE_CSS).toContain(rule);
    }
    // The reset mirrors the editor canvas defaults the exported site lacks.
    expect(SITE_RESET_CSS).toContain("box-sizing: border-box;");
    expect(SITE_RESET_CSS).toContain("font-size: inherit;");
  });
});
