import { describe, expect, it } from "vitest";
import type { FrameNode } from "@/features/document/model";
import {
  BREAKPOINT_MEDIA_QUERIES,
  breakpointForWidth,
  getBreakpointStyles,
  hasBreakpointOverrides,
  resolveNodeStyles,
  withResolvedStyles,
} from "@/features/document/responsive";
import { responsiveCssForNode, responsiveStyleRules } from "@/features/document/responsive/css";
import { validatePage } from "@/features/document/validation";
import { createRootNode, type FramePage } from "@/features/document/model";

function heading(overrides: Partial<FrameNode> = {}): FrameNode {
  return {
    id: "heading-1",
    type: "heading",
    name: "Heading",
    props: { level: 2, text: "Hello" },
    styles: { fontSize: 40, color: "#111111", lineHeight: 1.2 },
    responsive: { tablet: { fontSize: 32 }, mobile: { fontSize: 24 } },
    children: [],
    editor: { hidden: false, locked: false },
    ...overrides,
  };
}

describe("responsive breakpoints (spec §16)", () => {
  it("maps viewport widths to the documented breakpoint system", () => {
    expect(breakpointForWidth(390)).toBe("mobile");
    expect(breakpointForWidth(639)).toBe("mobile");
    expect(breakpointForWidth(640)).toBe("tablet");
    expect(breakpointForWidth(768)).toBe("tablet");
    expect(breakpointForWidth(1023)).toBe("tablet");
    expect(breakpointForWidth(1024)).toBe("base");
    expect(breakpointForWidth(1440)).toBe("base");
  });

  it("resolves base + the active breakpoint only", () => {
    const node = heading();

    expect(resolveNodeStyles(node, "base")).toEqual({
      fontSize: 40,
      color: "#111111",
      lineHeight: 1.2,
    });
    expect(resolveNodeStyles(node, "tablet")).toEqual({
      fontSize: 32,
      color: "#111111",
      lineHeight: 1.2,
    });
    // Mobile does not inherit tablet's fontSize override — only base (§16).
    expect(resolveNodeStyles(node, "mobile")).toEqual({
      fontSize: 24,
      color: "#111111",
      lineHeight: 1.2,
    });
  });

  it("returns an empty override record for nodes without responsive data", () => {
    const node = heading({ responsive: undefined });
    expect(getBreakpointStyles(node, "mobile")).toEqual({});
    expect(hasBreakpointOverrides(node, "mobile")).toBe(false);
    expect(resolveNodeStyles(node, "mobile")).toBe(node.styles);
  });

  it("resolves a render-time copy without touching the stored node", () => {
    const node = heading();
    const mobileView = withResolvedStyles(node, "mobile");

    expect(mobileView.styles.fontSize).toBe(24);
    // The stored record keeps its base value and overrides intact.
    expect(node.styles.fontSize).toBe(40);
    expect(node.responsive?.mobile?.fontSize).toBe(24);
  });
});

describe("responsive CSS generation (spec §16/§17)", () => {
  it("produces base declarations plus one media block per overridden breakpoint", () => {
    const rules = responsiveStyleRules(heading(), ".node-heading-1");

    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({
      selector: ".node-heading-1",
      media: null,
      declarations: { color: "#111111", "font-size": "40px", "line-height": "1.2" },
    });
    expect(rules[1]!.media).toBe(BREAKPOINT_MEDIA_QUERIES.tablet);
    expect(rules[1]!.declarations["font-size"]).toBe("32px");
    expect(rules[2]!.media).toBe(BREAKPOINT_MEDIA_QUERIES.mobile);
    expect(rules[2]!.declarations["font-size"]).toBe("24px");
  });

  it("skips media blocks for breakpoints without overrides", () => {
    const rules = responsiveStyleRules(
      heading({ responsive: { tablet: { fontSize: 30 } } }),
      ".only-tablet",
    );
    expect(rules.map((rule) => rule.media)).toEqual([null, BREAKPOINT_MEDIA_QUERIES.tablet]);
  });

  it("serializes deterministic CSS matching the resolver at every breakpoint", () => {
    const node = heading();
    const css = responsiveCssForNode(node, ".card");

    // The declarations in each rule are exactly what the canvas resolves.
    const rules = responsiveStyleRules(node, ".card");
    expect(rules.map((rule) => rule.declarations["font-size"])).toEqual(["40px", "32px", "24px"]);

    expect(css).toContain(".card {\n  color: #111111;");
    expect(css).toContain(`@media ${BREAKPOINT_MEDIA_QUERIES.tablet} {`);
    expect(css).toContain(`@media ${BREAKPOINT_MEDIA_QUERIES.mobile} {`);
    expect(css).toBe(responsiveCssForNode(node, ".card"));
  });
});

describe("responsive validation", () => {
  function pageWith(node: FrameNode): FramePage {
    return {
      id: "page-1",
      name: "Home",
      slug: "home",
      root: { ...createRootNode("root"), children: [node] },
      settings: { title: "Home", backgroundColor: "#ffffff" },
    };
  }

  it("rejects unsupported or unsafe responsive declarations", () => {
    const corrupt = heading({
      responsive: {
        mobile: { zIndex: 4 },
        tablet: { color: "javascript:alert(1)" },
      },
    });
    const issues = validatePage(pageWith(corrupt));
    expect(issues.some((issue) => issue.message.includes('Breakpoint "mobile"'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Breakpoint "tablet"'))).toBe(true);
  });

  it("accepts valid responsive overrides", () => {
    expect(validatePage(pageWith(heading()))).toEqual([]);
  });
});
