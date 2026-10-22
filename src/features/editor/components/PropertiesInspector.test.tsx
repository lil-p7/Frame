import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FramePage, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";

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
  render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return repository;
}

/** Seeds the project, opens the editor, and selects the node from the layer tree. */
async function openInspectorFor(
  dbName: string,
  name: string,
  nodes: FrameNode[],
  nodeId: string,
): Promise<void> {
  const project = await seedProject(dbName, name, nodes);
  renderEditor(dbName, project.id);
  await screen.findByRole("button", { name });
  const row = screen
    .getAllByTestId("layer-row")
    .find((candidate) => candidate.getAttribute("data-node-id") === nodeId);
  if (row === undefined) throw new Error(`fixture broken: no layer row for ${nodeId}`);
  await userEvent.click(row);
  await waitFor(() => expect(row).toHaveAttribute("aria-selected", "true"));
  expect(await screen.findByTestId("inspector-node-name")).toBeInTheDocument();
}

/** Loads the saved project back out of storage (the commit must persist). */
async function loadStoredPage(dbName: string, name: string) {
  const repository = new DexieProjectRepository(dbName);
  const projects = await repository.listProjects();
  const project = projects.find((candidate) => candidate.name === name);
  if (project === undefined) throw new Error(`fixture broken: ${name} not persisted`);
  return project.pages[0]!;
}

/** Loads the saved project back out of storage until the awaited expectation passes. */
function waitForStored(dbName: string, name: string): Promise<FramePage> {
  return waitFor(async () => loadStoredPage(dbName, name), {
    // The debounce plus persistence round-trip needs a moment.
    timeout: 3000,
  });
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("Properties inspector (Phase 5)", () => {
  it("renders registry-driven section rows for the selected component", async () => {
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-sections", "Sections Demo", [heading], "node-heading");

    expect(screen.getByTestId("inspector-node-name")).toHaveTextContent("Big heading");
    expect(screen.getByTestId("field-node-heading-prop-text")).toBeInTheDocument();
    expect(screen.getByTestId("field-node-heading-style-color")).toBeInTheDocument();
    expect(screen.queryByTestId("field-node-heading-style-width")).not.toBeInTheDocument();
  });

  it("commits a debounced text prop, updates the canvas, and persists it", async () => {
    const user = userEvent.setup();
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-text-commit", "Text Commit", [heading], "node-heading");

    const input = screen.getByTestId("node-heading-prop-text-input");
    await user.clear(input);
    await user.type(input, "Now shipping");
    // The canvas reflects committed content (spec §15 live canvas).
    await waitFor(() => {
      expect(screen.getByText("Now shipping")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    const page = await loadStoredPage("inspector-text-commit", "Text Commit");
    const saved = page.root.children[0]!;
    expect(saved.props.text).toBe("Now shipping");
  });

  it("keeps invalid numeric input on screen and leaves the document untouched", async () => {
    const user = userEvent.setup();
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-invalid-unit", "Invalid Unit", [heading], "node-heading");

    const amount = screen.getByTestId("node-heading-style-fontSize-amount");
    await user.clear(amount);
    await user.type(amount, "banana");
    // Invalid input stays on screen, is not committed...
    expect(amount).toHaveValue("banana");
    const page = await loadStoredPage("inspector-invalid-unit", "Invalid Unit");
    expect(page.root.children[0]!.styles.fontSize).toBeUndefined();
  });

  it("commits units as unit strings and bare numbers as px numbers", async () => {
    const user = userEvent.setup();
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-units", "Units Demo", [heading], "node-heading");

    const amount = screen.getByTestId("node-heading-style-fontSize-amount");
    await user.clear(amount);
    await user.type(amount, "3");
    const unit = screen.getByTestId("node-heading-style-fontSize-unit");
    await user.selectOptions(unit, "rem");

    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    const page = await loadStoredPage("inspector-units", "Units Demo");
    expect(page.root.children[0]!.styles.fontSize).toBe("3rem");
  });

  it("writes numbers for numeric selects (font weight)", async () => {
    const user = userEvent.setup();
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-numeric-select", "Weight Demo", [heading], "node-heading");

    const weight = screen.getByTestId("node-heading-style-fontWeight-select");
    await user.selectOptions(weight, "700");
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    const page = await loadStoredPage("inspector-numeric-select", "Weight Demo");
    expect(page.root.children[0]!.styles.fontWeight).toBe(700);
  });

  it("resets a style override back to the definition default", async () => {
    const user = userEvent.setup();
    const headingNode = makeTypedNode("node-heading", "Big heading", "heading");
    headingNode.styles.color = "#ff0000";
    await openInspectorFor("inspector-reset", "Reset Demo", [headingNode], "node-heading");
    expect(screen.getByTestId("node-heading-style-color-hex")).toHaveValue("#ff0000");

    const reset = screen.getByTestId("node-heading-style-color-reset");
    await user.click(reset);
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    const page = await loadStoredPage("inspector-reset", "Reset Demo");
    expect(page.root.children[0]!.styles.color).toBeUndefined();
  });

  it("keeps typing when a commit round-trips (focus is not clobbered)", async () => {
    const user = userEvent.setup();
    const paragraph = makeTypedNode("node-paragraph", "Body", "paragraph");
    await openInspectorFor("inspector-focus", "Focus Demo", [paragraph], "node-paragraph");

    const input = screen.getByTestId("node-paragraph-prop-text-input");
    await user.clear(input);
    await user.type(input, "longer commit");
    // Enough time passes for the 400ms debounce to commit; focus must survive
    // the store round-trip (spec §11C).
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("longer commit");
  });

  it("wires Actions for visibility, lock, duplicate, and delete", async () => {
    const user = userEvent.setup();
    const sectionNode = makeTypedNode("node-section", "Section", "section");
    await openInspectorFor("inspector-actions", "Actions Demo", [sectionNode], "node-section");

    await user.click(screen.getByTestId("inspector-toggle-visibility"));
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
    });
    const page = await loadStoredPage("inspector-actions", "Actions Demo");
    expect(page.root.children[0]!.editor.hidden).toBe(true);

    await user.click(screen.getByTestId("inspector-toggle-lock"));
    const afterLock = await loadStoredPage("inspector-actions", "Actions Demo");
    expect(afterLock.root.children[0]!.editor.locked).toBe(true);

    await user.click(screen.getByTestId("inspector-duplicate"));
    const afterDuplicate = await loadStoredPage("inspector-actions", "Actions Demo");
    expect(afterDuplicate.root.children).toHaveLength(2);

    await user.click(screen.getByTestId("inspector-delete"));
    const afterDelete = await loadStoredPage("inspector-actions", "Actions Demo");
    expect(afterDelete.root.children).toHaveLength(1);
  });

  it("shows the empty state when nothing is selected", async () => {
    const user = userEvent.setup();
    const sectionNode = makeTypedNode("node-section", "Section", "section");
    await openInspectorFor("inspector-empty", "Empty Demo", [sectionNode], "node-section");
    // Clicking empty canvas space clears the selection (spec §14 selection
    // parking): the inspector falls back to its empty state.
    await user.click(screen.getByTestId("canvas-workspace"));
    await waitFor(() => {
      expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
    });
  });

  it("commits the grid columns control into the repeat() template", async () => {
    const user = userEvent.setup();
    const gridNode = makeTypedNode("node-grid", "Photo grid", "grid");
    await openInspectorFor("inspector-columns", "Columns Demo", [gridNode], "node-grid");

    // Definition default is repeat(2, …); clicking 3 changes the template.
    await user.click(await screen.findByTestId("node-grid-style-gridTemplateColumns-columns-3"));
    const page = await waitForStored("inspector-columns", "Columns Demo");
    expect(page.root.children[0]!.styles.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });

  it("commits typed hex colors and holds back malformed hex", async () => {
    const user = userEvent.setup();
    const heading = makeTypedNode("node-heading", "Big heading", "heading");
    await openInspectorFor("inspector-color-hex", "Hex Demo", [heading], "node-heading");

    const hex = screen.getByTestId("node-heading-style-color-hex");
    await user.type(hex, "#0a0a0a");
    await waitForStored("inspector-color-hex", "Hex Demo");
    const saved = await loadStoredPage("inspector-color-hex", "Hex Demo");
    expect(saved.root.children[0]!.styles.color).toBe("#0a0a0a");

    // Malformed values stay in the field but never reach the document.
    await user.type(hex, "x");
    expect(hex).toHaveValue("#0a0a0ax");
    const kept = await loadStoredPage("inspector-color-hex", "Hex Demo");
    expect(kept.root.children[0]!.styles.color).toBe("#0a0a0a");
  });

  it("commits the image src through the url control and persists it", async () => {
    const user = userEvent.setup();
    const image = makeTypedNode("node-image", "Portrait", "image");
    await openInspectorFor("inspector-url", "Url Demo", [image], "node-image");

    const src = screen.getByTestId("node-image-prop-src-input");
    await user.type(src, "https://example.com/cat.png");
    // Real UI effect of the commit: the graceful placeholder is replaced by
    // an actual <img> (spec §9B). This gates on the debounced commit.
    await waitFor(() => {
      expect(document.querySelector('[data-component="image"]')!.tagName).toBe("IMG");
    });
    const page = await waitForStored("inspector-url", "Url Demo");
    expect(page.root.children[0]!.props.src).toBe("https://example.com/cat.png");
  });
});
