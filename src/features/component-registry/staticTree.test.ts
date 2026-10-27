import { describe, expect, it } from "vitest";
import { createRootNode, type FrameNode, type FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { buildStaticPage, buildStaticTree } from "@/features/component-registry/staticTree";
import { nodeClassName } from "@/features/document/stylesheet";

/** Node of a registered type with the given props/children/editor overrides. */
function node(
  type: string,
  overrides: {
    id?: string;
    props?: Record<string, unknown>;
    children?: FrameNode[];
    hidden?: boolean;
  } = {},
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    ...(overrides.id === undefined ? {} : { id: overrides.id }),
    props: { ...base.props, ...(overrides.props ?? {}) },
    children: overrides.children ?? base.children,
    editor: { hidden: overrides.hidden ?? false, locked: false },
  };
}

function heading(id: string, text: string): FrameNode {
  return node("heading", { id, props: { text } });
}

describe("static tree (spec §12, §22, §23)", () => {
  it("maps registered components to their delivered elements", () => {
    const tree = buildStaticTree(
      node("hero", {
        id: "n-hero",
        children: [
          heading("n-heading", "Build visually"),
          node("paragraph", { id: "n-para", props: { text: "Copy" } }),
          node("divider", { id: "n-divider" }),
        ],
      }),
    );

    expect(tree?.element.tag).toBe("section");
    expect(tree?.children.map((child) => child.element.tag)).toEqual(["h2", "p", "hr"]);
    expect(tree?.children[0]?.element.text).toBe("Build visually");
    expect(tree?.children[2]?.element.voidElement).toBe(true);
  });

  it("tags every node with its generated stylesheet class", () => {
    const tree = buildStaticTree(node("divider", { id: "node-1" }));
    // Generated class first, element extras after (`hr` draws its top edge
    // only, exactly like the canvas).
    expect(tree?.className.split(" ")).toEqual([nodeClassName("node-1"), "frame-divider"]);
  });

  it("never renders hidden components or their subtrees", () => {
    const hidden = node("section", { id: "n-hidden", hidden: true, children: [heading("n-in", "x")] });
    expect(buildStaticTree(hidden)).toBeNull();

    const page = { ...createPageFixture(), root: { ...createRootNode("root-1"), children: [hidden] } };
    expect(buildStaticPage(page)).toEqual([]);
  });

  it("renders a controlled placeholder for unknown types and keeps their content", () => {
    const unknown: FrameNode = {
      id: "n-unknown",
      type: "iframe",
      name: "Iframe",
      props: {},
      styles: {},
      children: [heading("n-inside", "Still here")],
      editor: { hidden: false, locked: false },
    };
    const tree = buildStaticTree(unknown);
    expect(tree?.element.attrs?.["data-frame-unknown"]).toBe("iframe");
    expect(tree?.children).toHaveLength(1);
    expect(tree?.children[0]?.element.text).toBe("Still here");
  });

  it("drops children of components that do not accept them", () => {
    const tree = buildStaticTree(
      node("heading", { id: "n-h", props: { text: "Title" }, children: [heading("n-extra", "x")] }),
    );
    expect(tree?.children).toEqual([]);
  });

  it("resolves link destinations through the consumer's mapper", () => {
    const link = node("link", { id: "n-link", props: { label: "About", href: "page:about" } });
    const mapped = buildStaticTree(link, { mapHref: () => "/preview/p1/page-2" });
    expect(mapped?.element.tag).toBe("a");
    expect(mapped?.element.attrs?.href).toBe("/preview/p1/page-2");

    const unmapped = buildStaticTree(link, { mapHref: () => null });
    // No destination: a non-interactive element rather than a dead link.
    expect(unmapped?.element.tag).toBe("span");
    expect(unmapped?.element.attrs?.href).toBeUndefined();
  });

  it("delivers buttons as links with the button base class", () => {
    const button = node("button", {
      id: "n-button",
      props: { label: "Get started", href: "https://example.com" },
    });
    const tree = buildStaticTree(button, { mapHref: (href) => href });
    expect(tree?.element.tag).toBe("a");
    expect(tree?.element.attrs?.href).toBe("https://example.com");
    expect(tree?.className).toContain("frame-button");
  });

  it("rewrites asset references through the consumer's node transform", () => {
    const image = node("image", { id: "n-image", props: { src: "asset:asset-1", alt: "Shot" } });

    // Available asset: the consumer swapped in a deliverable URL.
    const resolved = buildStaticTree(image, {
      transformNode: (candidate) => ({
        ...candidate,
        props: { ...candidate.props, src: "./assets/asset-1.png" },
      }),
    });
    expect(resolved?.element.tag).toBe("img");
    expect(resolved?.element.attrs?.src).toBe("./assets/asset-1.png");
    expect(resolved?.element.attrs?.alt).toBe("Shot");

    // Untouched reference: the bytes are gone, so the recoverable state shows.
    const missing = buildStaticTree(image);
    expect(missing?.element.tag).toBe("div");
    expect(missing?.element.text).toBe("Linked image asset is missing");
  });

  it("shows the no-source placeholder for images without a usable source", () => {
    const empty = buildStaticTree(node("image", { id: "n-empty", props: { src: "" } }));
    expect(empty?.element.text).toBe("Image — no source set");

    const external = buildStaticTree(
      node("image", { id: "n-ext", props: { src: "https://example.com/a.png", alt: "" } }),
    );
    expect(external?.element.tag).toBe("img");
    expect(external?.element.attrs?.src).toBe("https://example.com/a.png");
  });

  it("builds page content in stored order", () => {
    const page = {
      ...createPageFixture(),
      root: {
        ...createRootNode("root-1"),
        children: [heading("n-1", "One"), heading("n-2", "Two"), heading("n-3", "Three")],
      },
    };
    expect(buildStaticPage(page).map((child) => child.element.text)).toEqual(["One", "Two", "Three"]);
  });

  it("keeps spacer nodes hidden from assistive technology", () => {
    const spacer = buildStaticTree(node("spacer", { id: "n-spacer" }));
    expect(spacer?.element.tag).toBe("div");
    expect(spacer?.element.attrs?.["aria-hidden"]).toBe("true");
  });
});

/** Page fixture: only the shape the static builder reads is significant. */
function createPageFixture(): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: createRootNode("root-1"),
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}
