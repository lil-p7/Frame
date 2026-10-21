import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import {
  DEFAULT_LEFT_PANEL_WIDTH,
  resetEditorPreferences,
  useEditorStore,
} from "@/features/editor/stores/editorStore";

function makeNode(id: string, name: string, children: FrameNode[] = []): FrameNode {
  return {
    id,
    type: "section",
    name,
    props: {},
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
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
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
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

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

  it("offers an honest component library state instead of fake items", async () => {
    const user = userEvent.setup();
    const dbName = "shell-components-tab";
    const project = await seedProject(dbName, "Tabs Demo", []);
    renderEditor(dbName, project.id);

    await screen.findByRole("button", { name: "Tabs Demo" });
    const sidebar = screen.getByRole("complementary", { name: "Components and layers" });
    await user.click(within(sidebar).getByRole("tab", { name: /components/i }));
    expect(within(sidebar).getByText(/nothing would work yet/i)).toBeInTheDocument();
    // No button inside the library pretends to insert a component.
    expect(within(sidebar).queryByRole("button", { name: /layout|text|media/i })).toBeNull();
  });
});
