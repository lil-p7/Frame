import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import {
  DEFAULT_LEFT_PANEL_WIDTH,
  resetEditorPreferences,
  useEditorStore,
} from "@/features/editor/stores/editorStore";

function makeNode(id: string, name: string, children: FrameNode[] = []): FrameNode {
  return makeTypedNode(id, name, "section", children);
}

/** Builds a node whose props satisfy the registered schema (spec §12). */
function makeTypedNode(
  id: string,
  name: string,
  type: string,
  children: FrameNode[] = [],
): FrameNode {
  return {
    id,
    type,
    name,
    props: getComponent(type)!.createDefaultProps(),
    styles: {},
    children,
    editor: { hidden: false, locked: false },
  };
}

/** Seeds a project whose first page contains a small component tree. */
async function seedProject(
  dbName: string,
  name: string,
  nodes: FrameNode[],
): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name });
  const page = project.pages[0];
  if (page === undefined) throw new Error("fixture broken: createProject made no page");
  page.root.children = nodes;
  await repository.saveProject(project);
  return project;
}

function renderEditor(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, {
    initialEntries: [`/editor/${projectId}`],
  });
  const utils = render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, utils };
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("EditorShell layout", () => {
  it("renders toolbar, sidebars, canvas, and status bar for a loaded project", async () => {
    const dbName = "shell-basic";
    const project = await seedProject(dbName, "Portfolio Website", [makeNode("node-hero", "Hero")]);
    renderEditor(dbName, project.id);

    expect(await screen.findByRole("button", { name: "Portfolio Website" })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Components and layers" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Properties inspector" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("editor-status-bar")).toHaveTextContent("1440px · 100%");
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    expect(screen.getByRole("combobox", { name: /current page/i })).toBeInTheDocument();
  });

  it("collapses the left sidebar and reopens it from the rail", async () => {
    const user = userEvent.setup();
    const dbName = "shell-collapse";
    const project = await seedProject(dbName, "Collapse Demo", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Collapse Demo" });
    const aside = screen.getByRole("complementary", { name: "Components and layers" });
    expect(aside).toHaveStyle({ width: `${DEFAULT_LEFT_PANEL_WIDTH}px` });

    await user.click(screen.getByRole("button", { name: "Collapse components and layers" }));
    expect(
      screen.queryByRole("complementary", { name: "Components and layers" }),
    ).not.toBeInTheDocument();
    // Canvas expands into the freed space (aside is gone, rail is shown).
    expect(screen.getByRole("button", { name: "Show components and layers" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show components and layers" }));
    expect(
      screen.getByRole("complementary", { name: "Components and layers" }),
    ).toBeInTheDocument();
  });

  it("collapses both sidebars when the window crosses into compact width", async () => {
    const dbName = "shell-responsive";
    const project = await seedProject(dbName, "Responsive Demo", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Responsive Demo" });
    expect(
      screen.getByRole("complementary", { name: "Components and layers" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Properties inspector" })).toBeInTheDocument();

    // First resize event just records the starting width.
    fireEvent(window, new Event("resize"));
    // Crossing 900px downward auto-collapses both panels to free the canvas.
    Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
    fireEvent(window, new Event("resize"));

    expect(
      screen.queryByRole("complementary", { name: "Components and layers" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Properties inspector" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show components and layers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show inspector" })).toBeInTheDocument();

    Object.defineProperty(window, "innerWidth", { value: 1366, configurable: true });
  });

  it("resizes panels from the keyboard within clamped bounds", async () => {
    const dbName = "shell-resize";
    const project = await seedProject(dbName, "Resize Demo", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Resize Demo" });
    const handle = screen.getByTestId("resize-left");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    const aside = screen.getByRole("complementary", { name: "Components and layers" });
    expect(aside).toHaveStyle({ width: `${DEFAULT_LEFT_PANEL_WIDTH + 8}px` });

    // Clamp: hammering further never exceeds the maximum.
    for (let i = 0; i < 60; i += 1) fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(aside).toHaveStyle({ width: "420px" });
  });
});

describe("viewport and zoom", () => {
  it("changes the document width per preset while zoom stays independent", async () => {
    const user = userEvent.setup();
    const dbName = "shell-viewport";
    const project = await seedProject(dbName, "Viewport Demo", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Viewport Demo" });
    const frame = screen.getByTestId("document-viewport");
    expect(frame).toHaveStyle({ width: "1440px" });

    await user.click(screen.getByRole("button", { name: /mobile viewport/i }));
    expect(frame).toHaveStyle({ width: "390px" });

    // Zoom the editor: the document keeps its CSS width (Phase 2 criterion).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("editor-status-bar")).toHaveTextContent("390px · 125%");
    expect(frame).toHaveStyle({ width: "390px" });

    await user.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    expect(screen.getByTestId("editor-status-bar")).toHaveTextContent("390px · 100%");
    expect(frame).toHaveStyle({ width: "390px" });
  });

  it("accepts a custom viewport width", async () => {
    const user = userEvent.setup();
    const dbName = "shell-custom-width";
    const project = await seedProject(dbName, "Custom Width", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Custom Width" });
    const input = screen.getByRole("spinbutton", { name: /custom viewport width/i });
    await user.clear(input);
    await user.type(input, "500");
    expect(screen.getByTestId("document-viewport")).toHaveStyle({ width: "500px" });
    // The desktop preset is no longer active once a custom width is used.
    expect(screen.getByRole("button", { name: /desktop viewport/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("selection", () => {
  async function renderWithTree() {
    const dbName = "shell-selection";
    const project = await seedProject(dbName, "Selection Demo", [
      makeNode("node-hero", "Hero", [makeNode("node-heading", "Heading")]),
      makeNode("node-footer", "Footer"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Selection Demo" });
    return project;
  }

  it("selects a canvas node and syncs layers, inspector, and breadcrumb", async () => {
    const user = userEvent.setup();
    await renderWithTree();

    const hero = document.querySelector('[data-testid="canvas-node"][data-node-id="node-hero"]')!;
    await user.click(hero);
    await waitFor(() => expect(hero).toHaveAttribute("data-selected", "true"));

    // Layer row reflects the same selection.
    const heroRow = screen
      .getAllByTestId("layer-row")
      .find((row) => row.textContent?.includes("Hero"))!;
    expect(heroRow).toHaveAttribute("aria-selected", "true");

    // Inspector shows the selected component.
    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Hero");

    // Breadcrumb in the status bar lets users select an ancestor.
    expect(screen.getByTestId("editor-status-bar")).toHaveTextContent("Selection Demo/Hero");
  });

  it("selects through the layer tree and clears when clicking empty canvas", async () => {
    const user = userEvent.setup();
    await renderWithTree();

    const footerRow = screen
      .getAllByTestId("layer-row")
      .find((row) => row.textContent?.includes("Footer"))!;
    await user.click(footerRow);
    const footerCanvas = document.querySelector(
      '[data-testid="canvas-node"][data-node-id="node-footer"]',
    )!;
    expect(footerCanvas).toHaveAttribute("data-selected", "true");
    // The layer row and the canvas node agree on the selection.
    expect(footerRow).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Footer");

    // Clicking empty canvas space clears the selection.
    await user.click(screen.getByTestId("canvas-workspace"));
    await waitFor(() => expect(screen.getByTestId("inspector-empty")).toBeInTheDocument());
    for (const node of document.querySelectorAll('[data-testid="canvas-node"]')) {
      expect(node).toHaveAttribute("data-selected", "false");
    }
  });
});

describe("project name and pages in the toolbar", () => {
  it("renames the project from the toolbar and persists it", async () => {
    const user = userEvent.setup();
    const dbName = "shell-rename";
    const project = await seedProject(dbName, "Old Name", []);
    renderEditor(dbName, project.id);

    await user.click(await screen.findByRole("button", { name: "Old Name" }));
    const input = screen.getByRole("textbox", { name: "Project name" });
    await user.clear(input);
    await user.type(input, "New Name{Enter}");

    expect(await screen.findByRole("button", { name: "New Name" })).toBeInTheDocument();
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");

    // Reopen the route from storage: the new name survived.
    renderEditor(dbName, project.id).utils.unmount();
    renderEditor(dbName, project.id);
    expect(await screen.findByRole("button", { name: "New Name" })).toBeInTheDocument();
  });

  it("keeps the draft and shows the error when the new name is empty", async () => {
    const user = userEvent.setup();
    const dbName = "shell-rename-invalid";
    const project = await seedProject(dbName, "Keep Me", []);
    renderEditor(dbName, project.id);

    await user.click(await screen.findByRole("button", { name: "Keep Me" }));
    const input = screen.getByRole("textbox", { name: "Project name" });
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("Project name is required.");
    expect(screen.getByRole("textbox", { name: "Project name" })).toBeInTheDocument();
  });
});

describe("component library and layer tree (Phase 4)", () => {
  function rowByNodeId(nodeId: string): HTMLElement {
    const row = screen
      .getAllByTestId("layer-row")
      .find((candidate) => candidate.getAttribute("data-node-id") === nodeId);
    if (row === undefined) throw new Error(`layer row not found: ${nodeId}`);
    return row;
  }

  async function openComponentsTab(sidebarLabel = "Components and layers") {
    const user = userEvent.setup();
    const sidebar = screen.getByRole("complementary", { name: sidebarLabel });
    await user.click(within(sidebar).getByRole("tab", { name: /components/i }));
    return sidebar;
  }

  it("inserts a component from the library, selects it, and persists it", async () => {
    const user = userEvent.setup();
    const dbName = "shell-library-insert";
    const project = await seedProject(dbName, "Library Insert", []);
    const firstRender = renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Library Insert" });

    await openComponentsTab();
    await user.click(screen.getByRole("button", { name: "Insert Section" }));

    // Canvas and layer tree both show the new node.
    const inserted = await waitFor(() => {
      const node = document.querySelector('[data-testid="canvas-node"][data-node-type="section"]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(inserted).toHaveAttribute("data-selected", "true");

    // The layer tree shows the new node too (switch back to the Layers tab).
    await user.click(screen.getByRole("tab", { name: /layers/i }));
    const row = await waitFor(() => {
      const found = screen
        .getAllByTestId("layer-row")
        .find((r) => r.querySelector('[data-testid="layer-row-name"]')?.textContent === "Section");
      expect(found).toBeDefined();
      return found as HTMLElement;
    });
    expect(row).toHaveAttribute("aria-selected", "true");
    // The inspector follows the inserted component (spec §9A).
    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Section");

    // Persistence: reopening the project shows the inserted section.
    firstRender.utils.unmount();
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Library Insert" });
    const rows = await screen.findAllByTestId("layer-row");
    expect(
      rows.some(
        (r) => r.querySelector('[data-testid="layer-row-name"]')?.textContent === "Section",
      ),
    ).toBe(true);
  });

  it("inserts beside a leaf selection under its parent, and respects container selection", async () => {
    const user = userEvent.setup();
    const dbName = "shell-insert-targets";
    const project = await seedProject(dbName, "Insert Targets", [
      // "heading" is a true leaf: inserting beside it exercises the
      // nearest-valid-parent rule, not nesting into the selection.
      makeNode("node-hero", "Hero", [makeTypedNode("node-heading", "Heading", "heading")]),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Insert Targets" });

    // With a leaf selected, the insert lands beside it (spec §9A).
    await user.click(rowByNodeId("node-heading"));
    await openComponentsTab();
    await user.click(screen.getByRole("button", { name: "Insert Paragraph" }));
    // Switch back to the Layers tab to inspect the document tree.
    await user.click(screen.getByRole("tab", { name: /layers/i }));
    const level3Rows = await waitFor(() => {
      const rows = screen
        .getAllByTestId("layer-row")
        .filter((r) => r.getAttribute("aria-level") === "3");
      expect(rows).toHaveLength(2);
      return rows.map((r) => r.querySelector('[data-testid="layer-row-name"]')?.textContent);
    });
    expect(level3Rows).toEqual(["Heading", "Paragraph"]);

    // When the selection is a container, the component becomes its child.
    await user.click(rowByNodeId("node-hero"));
    await openComponentsTab();
    await user.click(screen.getByRole("button", { name: "Insert Container" }));
    await user.click(screen.getByRole("tab", { name: /layers/i }));
    await waitFor(() => {
      const rows = screen
        .getAllByTestId("layer-row")
        .filter((r) => r.getAttribute("aria-level") === "3");
      expect(
        rows.map((r) => r.querySelector('[data-testid="layer-row-name"]')?.textContent),
      ).toEqual(["Heading", "Paragraph", "Container"]);
    });
  });

  it("renames a layer without touching its content and persists the rename", async () => {
    const user = userEvent.setup();
    const dbName = "shell-layer-rename";
    const project = await seedProject(dbName, "Layer Rename", [
      makeTypedNode("node-hero", "Hero", "stack", [
        makeTypedNode("node-heading", "Heading", "heading"),
      ]),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Rename" });

    await user.click(rowByNodeId("node-heading"));
    await user.click(within(rowByNodeId("node-heading")).getByTestId("layer-rename"));
    const input = screen.getByTestId("layer-rename-input");
    await user.clear(input);
    await user.type(input, "Intro heading{Enter}");

    // The rename lands once the command + save complete.
    await waitFor(() => expect(rowByNodeId("node-heading").textContent).toContain("Intro heading"));
    // The rendered content prop is untouched by a rename (spec §9C).
    expect(document.querySelector("[data-testid='canvas-document']")?.textContent).toContain(
      "Heading",
    );

    renderEditor(dbName, project.id).utils.unmount();
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Rename" });
    expect(
      (await screen.findAllByTestId("layer-row")).some(
        (r) => r.querySelector('[data-testid="layer-row-name"]')?.textContent === "Intro heading",
      ),
    ).toBe(true);
  });

  it("duplicates a layer with fresh IDs and selects the copy", async () => {
    const user = userEvent.setup();
    const dbName = "shell-layer-duplicate";
    const project = await seedProject(dbName, "Layer Duplicate", [makeNode("node-hero", "Hero")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Duplicate" });

    await user.click(rowByNodeId("node-hero"));
    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-duplicate"));

    const rows = await waitFor(() => {
      const matching = screen
        .getAllByTestId("layer-row")
        .filter((r) => r.getAttribute("aria-level") === "2");
      expect(matching).toHaveLength(2);
      return matching;
    });
    const ids = rows.map((r) => r.getAttribute("data-node-id"));
    expect(ids[0]).toBe("node-hero");
    expect(ids[1]).not.toBe("node-hero"); // fresh ID throughout the copied subtree
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });

  it("deletes a parent with its whole subtree and moves the selection to the parent safely", async () => {
    const user = userEvent.setup();
    const dbName = "shell-layer-delete";
    const project = await seedProject(dbName, "Layer Delete", [
      makeNode("node-hero", "Hero", [
        makeNode("node-heading", "Heading"),
        makeNode("node-footer", "Footer"),
      ]),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Delete" });

    // Delete the section's child subtree wholesale from a child selection.
    await user.click(rowByNodeId("node-heading"));
    await user.click(within(rowByNodeId("node-footer")).getByTestId("layer-delete"));

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("layer-row")
          .some((r) => r.getAttribute("data-node-id") === "node-footer"),
      ).toBe(false);
    });
    expect(
      document.querySelector('[data-testid="canvas-node"][data-node-id="node-footer"]'),
    ).toBeNull();
    // The heading selection was untouched — it is not inside the deleted subtree.
    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Heading");

    // Deleting the selection's own subtree parks the selection on the parent.
    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-delete"));
    await waitFor(() => expect(screen.getByTestId("inspector-empty")).toBeInTheDocument());
    expect(screen.getByTestId("inspector-empty")).toHaveTextContent("Nothing selected");
  });

  it("hides and shows a layer from the tree without destroying it", async () => {
    const user = userEvent.setup();
    const dbName = "shell-layer-visibility";
    const project = await seedProject(dbName, "Layer Visibility", [makeNode("node-hero", "Hero")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Visibility" });

    await user.click(rowByNodeId("node-hero"));
    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-visibility"));
    await waitFor(() => {
      expect(
        document.querySelector('[data-node-id="node-hero"][data-testid="canvas-node"]'),
      ).toBeNull(); // hidden on canvas (spec §9C)
    });
    expect(rowByNodeId("node-hero").getAttribute("aria-selected")).toBe("true");

    // Show again: identical node ID renders once more.
    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-visibility"));
    await waitFor(() => {
      expect(
        document.querySelector('[data-node-id="node-hero"][data-testid="canvas-node"]'),
      ).not.toBeNull();
    });
  });

  it("locks a component: canvas clicks ignore it, the layer tree still selects it", async () => {
    const user = userEvent.setup();
    const dbName = "shell-layer-lock";
    const project = await seedProject(dbName, "Layer Lock", [makeNode("node-hero", "Hero")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Layer Lock" });

    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-lock"));

    // Locked: canvas click does not select (spec §9C)…
    await user.click(
      document.querySelector('[data-testid="canvas-node"][data-node-id="node-hero"]')!,
    );
    expect(rowByNodeId("node-hero")).toHaveAttribute("aria-selected", "false");
    // …but the layer tree can still select it, where the unlock control lives.
    await user.click(rowByNodeId("node-hero"));
    expect(rowByNodeId("node-hero")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Hero");

    // Unlock restores ordinary canvas selection.
    await user.click(within(rowByNodeId("node-hero")).getByTestId("layer-lock"));
    await user.click(
      document.querySelector('[data-testid="canvas-node"][data-node-id="node-hero"]')!,
    );
    expect(rowByNodeId("node-hero")).toHaveAttribute("aria-selected", "true");
  });

  it("filters the library with the search field", async () => {
    const dbName = "shell-library-search";
    const project = await seedProject(dbName, "Library Search", []);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Library Search" });

    await openComponentsTab();
    expect(screen.getAllByTestId("library-item").length).toBeGreaterThan(10);

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Search components" }), "spacer");
    const visible = screen.getAllByTestId("library-item");
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveAttribute("data-component-type", "spacer");
  });
});
