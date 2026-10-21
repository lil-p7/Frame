import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { FrameNode, FramePage } from "@/features/document/model";
import { createRootNode } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { CanvasWorkspace } from "@/features/editor/components/CanvasWorkspace";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";

function nodeOfType(type: string, overrides: Partial<FrameNode> = {}): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown type ${type}`);
  return { ...definition.createDefaultNode(), ...overrides };
}

function pageWith(children: FrameNode[]): FramePage {
  return {
    id: "page-1",
    name: "Home",
    slug: "home",
    root: { ...createRootNode("root"), children },
    settings: { title: "Home", backgroundColor: "#ffffff" },
  };
}

function renderWorkspace(page: FramePage) {
  return render(<CanvasWorkspace page={page} scrollerRef={createRef<HTMLDivElement>()} />);
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("components render from the document model (Phase 3 acceptance)", () => {
  it("renders text components with their stored props", () => {
    const heading = nodeOfType("heading", { props: { level: 1, text: "Welcome" } });
    const paragraph = nodeOfType("paragraph", { props: { text: "Body copy here." } });
    const text = nodeOfType("text", { props: { text: "inline note" } });
    renderWorkspace(pageWith([heading, paragraph, text]));

    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Body copy here.")).toBeInTheDocument();
    expect(screen.getByText("inline note")).toBeInTheDocument();
  });

  it("renders interactive components without navigating the editor", () => {
    const button = nodeOfType("button", { props: { label: "Join now", href: "#join" } });
    const link = nodeOfType("link", { props: { label: "Docs", href: "https://example.com" } });
    renderWorkspace(pageWith([button, link]));

    expect(screen.getByRole("button", { name: "Join now" })).toBeInTheDocument();
    const anchor = screen.getByRole("link", { name: "Docs" });
    expect(anchor).toHaveAttribute("href", "https://example.com");
  });

  it("renders layout containers and their children in stored order", () => {
    const stack = nodeOfType("stack");
    const first = nodeOfType("heading", { props: { level: 3, text: "First" } });
    const second = nodeOfType("paragraph", { props: { text: "Second" } });
    stack.children = [first, second];
    renderWorkspace(pageWith([stack]));

    const document_ = screen.getByTestId("canvas-document");
    const positions = ["First", "Second"].map((text) => document_.textContent!.indexOf(text));
    expect(positions[0]).toBeGreaterThan(-1);
    expect(positions[1]).toBeGreaterThan(positions[0]!);
  });

  it("renders composite presets decomposed into editable children", () => {
    const hero = nodeOfType("hero");
    renderWorkspace(pageWith([hero]));

    expect(screen.getByTestId("hero-node")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
  });

  it("gives every rendered node a stable ID on its wrapper", () => {
    const section = nodeOfType("section");
    renderWorkspace(pageWith([section]));

    const wrapper = document.querySelector(`[data-node-id="${section.id}"]`);
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("data-testid", "canvas-node");
    expect(wrapper).toHaveAttribute("data-node-type", "section");
  });
});

describe("controlled fallbacks and safety", () => {
  it("shows a controlled fallback for unknown types and preserves the data", () => {
    const unknown: FrameNode = {
      id: "legacy-1",
      type: "legacy-widget",
      name: "Legacy",
      props: { anything: true },
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    };
    renderWorkspace(pageWith([unknown]));

    expect(screen.getByTestId("unknown-component")).toHaveTextContent("legacy-widget");
    // The node data is still present — nothing destroyed or replaced it.
    expect(document.querySelector('[data-node-id="legacy-1"]')).not.toBeNull();
  });

  it("hides hidden components and renders the image placeholder without a source", () => {
    const hidden = nodeOfType("heading", { props: { level: 2, text: "Secret" } });
    hidden.editor = { hidden: true, locked: false };
    const image = nodeOfType("image", { props: { src: "", alt: "" } });
    renderWorkspace(pageWith([hidden, image]));

    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
  });

  it("renders a real image element for a valid source", () => {
    const image = nodeOfType("image", {
      props: { src: "https://example.com/pic.png", alt: "A picture" },
    });
    renderWorkspace(pageWith([image]));

    const img = screen.getByTestId("image-node");
    expect(img).toHaveAttribute("src", "https://example.com/pic.png");
    expect(img).toHaveAttribute("alt", "A picture");
  });
});

describe("selection on the rendered canvas", () => {
  it("selects on click and clears when clicking empty canvas space", async () => {
    const user = userEvent.setup();
    const section = nodeOfType("section");
    renderWorkspace(pageWith([section]));

    const wrapper = document.querySelector(`[data-node-id="${section.id}"]`)!;
    await user.click(wrapper);
    expect(wrapper).toHaveAttribute("data-selected", "true");
    expect(useEditorStore.getState().selectedNodeId).toBe(section.id);

    await user.click(screen.getByTestId("canvas-workspace"));
    expect(wrapper).toHaveAttribute("data-selected", "false");
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });

  it("locked components ignore ordinary canvas clicks", async () => {
    const user = userEvent.setup();
    const locked = nodeOfType("section", {
      editor: { hidden: false, locked: true },
    });
    renderWorkspace(pageWith([locked]));

    await user.click(document.querySelector(`[data-node-id="${locked.id}"]`)!);
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });
});
