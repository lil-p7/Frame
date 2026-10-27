import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  type FrameAsset,
  type FrameNode,
  type FramePage,
  type FrameProject,
} from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { collectAssetReferences, validateForExport } from "@/features/export/validation";

function node(
  type: string,
  overrides: {
    id: string;
    props?: Record<string, unknown>;
    hidden?: boolean;
    children?: FrameNode[];
  },
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    id: overrides.id,
    props: { ...base.props, ...(overrides.props ?? {}) },
    children: overrides.children ?? [],
    editor: { hidden: overrides.hidden ?? false, locked: false },
  };
}

function page(name: string, slug: string, children: FrameNode[], id = `page-${slug}`): FramePage {
  return {
    id,
    name,
    slug,
    root: { ...createRootNode(`root-${slug}`), children },
    settings: { title: name, backgroundColor: "#ffffff" },
  };
}

function project(
  pages: FramePage[],
  assets: FrameAsset[] = [],
  name = "Portfolio",
): FrameProject {
  return {
    id: "project-1",
    name,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pages,
    assets,
    designTokens: { colors: {}, spacing: {}, typography: {} },
  };
}

const imageAsset: FrameAsset = {
  id: "asset-record-1",
  name: "photo.png",
  mimeType: "image/png",
  size: 4,
  storageKey: "asset-abc",
};

describe("export validation (spec §23)", () => {
  it("accepts a clean project", () => {
    const report = validateForExport(
      project([
        page("Home", "home", [
          node("hero", {
            id: "n-hero",
            children: [
              node("heading", { id: "n-heading", props: { text: "Hello" } }),
              node("button", { id: "n-button", props: { label: "Go", href: "https://example.com" } }),
            ],
          }),
        ]),
      ]),
      new Set(),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("blocks unregistered component types instead of exporting placeholders", () => {
    const unknown: FrameNode = {
      id: "n-unknown",
      type: "iframe",
      name: "Embed",
      props: {},
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    };
    const report = validateForExport(project([page("Home", "home", [unknown])]), new Set());
    expect(report.errors.join(" ")).toContain('Unknown component type "iframe"');
  });

  it("blocks a referenced image whose stored bytes are missing", () => {
    const report = validateForExport(
      project(
        [
          page("Home", "home", [
            node("image", { id: "n-image", props: { src: "asset:asset-abc", alt: "Shot" } }),
          ]),
        ],
        [imageAsset],
      ),
      new Set(), // nothing readable
    );
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("stored file is missing");
    expect(report.errors[0]).toContain("Home");

    // With the bytes available the same project passes.
    const available = validateForExport(
      project([page("Home", "home", [node("image", { id: "n-image", props: { src: "asset:asset-abc" } })])], [imageAsset]),
      new Set(["asset-abc"]),
    );
    expect(available.errors).toEqual([]);
  });

  it("ignores assets referenced only by hidden components", () => {
    const report = validateForExport(
      project([
        page("Home", "home", [
          node("image", {
            id: "n-hidden-image",
            props: { src: "asset:asset-gone" },
            hidden: true,
          }),
        ]),
      ]),
      new Set(),
    );
    expect(report.errors).toEqual([]);
    expect(collectAssetReferences(project([page("Home", "home", [])]))).toEqual([]);
  });

  it("blocks links to pages that no longer exist", () => {
    const report = validateForExport(
      project([
        page("Home", "home", [
          node("button", { id: "n-button", props: { label: "Old page", href: "page:deleted" } }),
        ]),
      ]),
      new Set(),
    );
    expect(report.errors.join(" ")).toContain("targets a page that no longer exists");
  });

  it("blocks duplicate page slugs and unsafe page backgrounds", () => {
    const report = validateForExport(
      project(
        [
          page("Home", "home", []),
          { ...page("Landing", "home", [], "page-landing"), settings: { title: "x", backgroundColor: "javascript:alert(1)" } },
        ],
        [],
      ),
      new Set(),
    );
    const messages = report.errors.join(" ");
    expect(messages).toContain('share the slug "home"');
    expect(messages).toContain("unsafe background color");
  });

  it("warns about images without a source but does not block", () => {
    const report = validateForExport(
      project([page("Home", "home", [node("image", { id: "n-image", props: { src: "" } })])]),
      new Set(),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.join(" ")).toContain("no image source set");
  });

  it("reports the location of each referenced asset", () => {
    const single = project([
      page("About", "about", [
        node("section", {
          id: "n-section",
          children: [
            node("image", { id: "n-image", props: { src: "asset:asset-abc", alt: "" } }),
          ],
        }),
      ]),
    ]);
    const references = collectAssetReferences(single);
    expect(references).toHaveLength(1);
    expect(references[0]?.storageKey).toBe("asset-abc");
    expect(references[0]?.location).toContain('Page "About"');
    expect(references[0]?.location).toContain("Image#n-image");
  });
});
