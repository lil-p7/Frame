import { describe, expect, it } from "vitest";
import type { FrameNode, FramePage, FrameProject } from "@/features/document/model";
import { createRootNode } from "@/features/document/model";
import {
  DocumentValidationError,
  assertValidPage,
  validatePage,
  validateProject,
} from "@/features/document/validation";
import { getComponent } from "@/features/component-registry/registry";

function freshPage(): FramePage {
  const page = {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: createRootNode("root"),
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
  // Give the root one registered child so baseline expectations are clear.
  page.root.children.push(getComponent("section")!.createDefaultNode());
  return page;
}

function headingNode(id: string): FrameNode {
  const heading = getComponent("heading")!.createDefaultNode();
  heading.id = id;
  return heading;
}

describe("validatePage", () => {
  it("accepts a valid page with zero issues", () => {
    expect(validatePage(freshPage())).toEqual([]);
    expect(() => assertValidPage(freshPage())).not.toThrow();
  });

  it("flags an unknown component type", () => {
    const page = freshPage();
    page.root.children.push({
      id: "mystery",
      type: "mystery-widget",
      name: "Mystery",
      props: {},
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    });
    const issues = validatePage(page);
    expect(issues.some((issue) => issue.message.includes("Unknown component type"))).toBe(true);
    expect(() => assertValidPage(page)).toThrow(DocumentValidationError);
  });

  it("flags props that fail their component schema", () => {
    const page = freshPage();
    const heading = headingNode("bad-props");
    heading.props = { level: 11, text: "x" };
    page.root.children.push(heading);
    expect(validatePage(page).some((i) => i.message.includes("Invalid props"))).toBe(true);
  });

  it("flags children under a component that does not accept them", () => {
    const page = freshPage();
    const heading = headingNode("heading-with-child");
    heading.children = [headingNode("stray")];
    page.root.children.push(heading);
    expect(validatePage(page).some((i) => i.message.includes("does not accept children"))).toBe(
      true,
    );
  });

  it("flags duplicate IDs anywhere in the tree", () => {
    const page = freshPage();
    const first = page.root.children[0]!;
    page.root.children.push({ ...first }); // same ID as the first child
    const issues = validatePage(page);
    expect(issues.some((issue) => issue.message.includes("Duplicate ID"))).toBe(true);
  });

  it("flags a page whose root is not the structural root type", () => {
    const page = freshPage();
    (page.root as { type: string }).type = "section";
    expect(validatePage(page).some((i) => i.message.includes("Page root must be"))).toBe(true);
  });

  it("flags unsupported style keys and unsafe style values", () => {
    const page = freshPage();
    page.root.children[0]!.styles = { zIndex: 5 };
    expect(validatePage(page).some((i) => i.message.includes("Styles contain"))).toBe(true);

    const other = freshPage();
    other.root.children[0]!.styles = { backgroundColor: "javascript:alert(1)" };
    expect(validatePage(other).some((i) => i.message.includes("Styles contain"))).toBe(true);
  });

  it("flags empty page names and slugs", () => {
    const page = freshPage();
    page.name = "   ";
    page.slug = "";
    const issues = validatePage(page);
    expect(issues.some((i) => i.message === "Page name is required")).toBe(true);
    expect(issues.some((i) => i.message === "Page slug is required")).toBe(true);
  });
});

describe("validateProject", () => {
  it("prefixes issues with their page index", () => {
    const page = freshPage();
    page.root.children.push({
      id: "mystery",
      type: "mystery-widget",
      name: "Mystery",
      props: {},
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    });
    const project: FrameProject = {
      id: "p1",
      name: "Project",
      schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      pages: [page],
      assets: [],
      designTokens: { colors: {}, spacing: {}, typography: {} },
    };
    const issues = validateProject(project);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.path.startsWith("pages[0]")).toBe(true);
  });
});
