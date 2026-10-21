import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  parseFrameProject,
  slugify,
  validateProjectName,
  type FrameProject,
} from "./index";
import { createId } from "@/lib/ids";

function makeValidProject(): FrameProject {
  const name = "Portfolio Website";
  return {
    id: createId(),
    name,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    pages: [
      {
        id: createId(),
        name,
        slug: "portfolio-website",
        root: {
          id: createId(),
          type: "root",
          name: "Root",
          props: {},
          styles: {},
          children: [
            {
              id: createId(),
              type: "section",
              name: "Section",
              props: {},
              styles: {},
              children: [],
              editor: { hidden: false, locked: false },
            },
          ],
          editor: { hidden: false, locked: false },
        },
        settings: { title: name, backgroundColor: "#ffffff" },
      },
    ],
    assets: [],
    designTokens: { colors: {}, spacing: {}, typography: {} },
  };
}

describe("parseFrameProject", () => {
  it("accepts a valid project", () => {
    const project = makeValidProject();
    expect(() => parseFrameProject(structuredClone(project))).not.toThrow();
    expect(parseFrameProject(structuredClone(project)).name).toBe(project.name);
  });

  it("rejects duplicate IDs across the tree", () => {
    const project = makeValidProject();
    const childId = project.pages[0]?.root.children[0]?.id ?? null;
    if (childId === null) throw new Error("fixture broken: missing child node ID");
    // Mutate the root's ID to alias the child's ID (would allow one object to
    // appear twice under different parents).
    project.pages[0]!.root.id = childId;
    expect(() => parseFrameProject(project)).toThrow(/Duplicate ID/);
  });

  it("rejects empty names and malformed page counts", () => {
    const project = makeValidProject();
    project.name = "";
    expect(() => parseFrameProject(project)).toThrow();

    const projectNoPages = { ...makeValidProject(), pages: [] };
    expect(() => parseFrameProject(projectNoPages)).toThrow();
  });

  it("rejects unsupported schema versions", () => {
    const project = { ...makeValidProject(), schemaVersion: 99 };
    expect(() => parseFrameProject(project)).toThrow(/schema version/i);
  });

  it("rejects non-ISO timestamps", () => {
    const project = { ...makeValidProject(), updatedAt: "yesterday" };
    expect(() => parseFrameProject(project)).toThrow();
  });
});

describe("createRootNode", () => {
  it("creates the reserved non-selectable root container", () => {
    const root = createRootNode(createId());
    expect(root.type).toBe("root");
    expect(root.children).toEqual([]);
    expect(root.editor).toEqual({ hidden: false, locked: false });
  });
});

describe("validateProjectName", () => {
  it("rejects empty and over-length names", () => {
    expect(validateProjectName("   ")).toBe("Project name is required.");
    expect(validateProjectName("a".repeat(121))).not.toBeNull();
    expect(validateProjectName("Portfolio")).toBeNull();
  });
});

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Portfolio Website")).toBe("portfolio-website");
    expect(slugify("  Über — Cool!!!  ")).toBe("u-ber-cool");
    expect(slugify("---")).toBe("page");
  });
});
