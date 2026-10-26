import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";
import { resetHistory } from "@/features/editor/stores/historyStore";

function typedNode(id: string, name: string, type: string): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown type ${type}`);
  return { ...definition.createDefaultNode(), id, name };
}

async function seedProject(
  dbName: string,
  name: string,
  nodes: FrameNode[],
): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name });
  const page = project.pages[0];
  if (page === undefined) throw new Error("fixture broken: no initial page");
  page.root.children = nodes;
  await repository.saveProject(project);
  return project;
}

function renderEditor(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, { initialEntries: [`/editor/${projectId}`] });
  return render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
}

async function loadStored(dbName: string, name: string): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const projects = await repository.listProjects();
  const project = projects.find((candidate) => candidate.name === name);
  if (project === undefined) throw new Error(`fixture broken: ${name} not persisted`);
  return project;
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  resetHistory();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

function pageSelector(): HTMLElement {
  return screen.getByRole("combobox", { name: /current page/i });
}

async function openPageMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("page-menu-trigger"));
}

async function createPage(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await openPageMenu(user);
  await user.click(await screen.findByTestId("page-menu-new"));
  await user.type(screen.getByTestId("page-dialog-input"), name);
  await user.click(screen.getByTestId("page-name-submit"));
}

function rowByNodeId(nodeId: string): HTMLElement {
  const row = screen
    .getAllByTestId("layer-row")
    .find((candidate) => candidate.getAttribute("data-node-id") === nodeId);
  if (row === undefined) throw new Error(`layer row not found: ${nodeId}`);
  return row;
}

describe("multi-page projects (Phase 9, spec §20)", () => {
  it("creates a page, configures its settings, and persists both", async () => {
    const user = userEvent.setup();
    const dbName = "pages-create";
    const project = await seedProject(dbName, "Site", []);
    const firstRender = renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });
    expect(within(pageSelector()).getAllByRole("option")).toHaveLength(1);

    await createPage(user, "About");

    // The new page is selected, empty, and listed in the selector.
    await waitFor(() => expect(within(pageSelector()).getAllByRole("option")).toHaveLength(2));
    expect(pageSelector()).toHaveDisplayValue("About");
    expect(await screen.findByTestId("canvas-empty-state")).toBeInTheDocument();

    // Page settings (nothing selected) rename the page and set its title.
    expect(screen.getByTestId("page-settings")).toBeInTheDocument();
    await user.clear(screen.getByTestId("page-name-input"));
    await user.type(screen.getByTestId("page-name-input"), "About us{Enter}");
    await waitFor(() => expect(pageSelector()).toHaveDisplayValue("About us"));

    await user.clear(screen.getByTestId("page-title-input"));
    await user.type(screen.getByTestId("page-title-input"), "About us{Enter}");

    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages).toHaveLength(2);
      const about = stored.pages.find((page) => page.slug === "about");
      expect(about).toBeDefined();
      expect(about!.name).toBe("About us");
      expect(about!.settings.title).toBe("About us");
    });

    // Reopening the project restores both pages (acceptance criterion).
    firstRender.unmount();
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });
    expect(within(pageSelector()).getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("option").some((option) => option.textContent === "About us")).toBe(
      true,
    );
  });

  it("renames the current page from the menu with a validated name and slug", async () => {
    const user = userEvent.setup();
    const dbName = "pages-rename";
    const project = await seedProject(dbName, "Site", []);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });

    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-rename"));
    const dialog = await screen.findByTestId("page-name-dialog");
    const input = within(dialog).getByTestId("page-dialog-input");
    expect(input).toHaveValue("Site"); // prefilled with the current name

    await user.clear(input);
    await user.type(input, "Welcome aboard");
    await user.click(screen.getByTestId("page-name-submit"));

    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages[0]!.name).toBe("Welcome aboard");
    });
    expect(pageSelector()).toHaveDisplayValue("Welcome aboard");
    // Renaming keeps the URL stable; the slug is configured separately (§20).
    expect((await loadStored(dbName, "Site")).pages[0]!.slug).toBe("site");
    await user.clear(screen.getByTestId("page-slug-input"));
    await user.type(screen.getByTestId("page-slug-input"), "welcome{Enter}");
    await waitFor(async () => {
      expect((await loadStored(dbName, "Site")).pages[0]!.slug).toBe("welcome");
    });

    // Empty names are rejected inline without touching storage.
    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-rename"));
    await user.clear(await screen.findByTestId("page-dialog-input"));
    await user.click(screen.getByTestId("page-name-submit"));
    expect(await screen.findByText("Page name is required.")).toBeInTheDocument();
    expect((await loadStored(dbName, "Site")).pages[0]!.name).toBe("Welcome aboard");
  });

  it("duplicates a page with fresh IDs and keeps slugs unique", async () => {
    const user = userEvent.setup();
    const dbName = "pages-duplicate";
    const project = await seedProject(dbName, "Site", [
      typedNode("node-heading", "Heading", "heading"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });

    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-duplicate"));

    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages).toHaveLength(2);
    });
    const stored = await loadStored(dbName, "Site");
    const [original, copy] = stored.pages;
    expect(copy!.slug).not.toBe(original!.slug);
    expect(copy!.id).not.toBe(original!.id);
    // Component IDs are regenerated in the duplicate.
    expect(copy!.root.children[0]!.id).not.toBe(original!.root.children[0]!.id);
    expect(copy!.root.children[0]!.name).toBe("Heading");
  });

  it("reorders, deletes after confirmation, and refuses the last page", async () => {
    const user = userEvent.setup();
    const dbName = "pages-delete";
    const project = await seedProject(dbName, "Site", []);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });

    await createPage(user, "Second");
    await waitFor(() => expect(within(pageSelector()).getAllByRole("option")).toHaveLength(2));

    // Reorder the current (second) page up.
    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-up"));
    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages.map((page) => page.slug)).toEqual(["second", "site"]);
    });

    // Deletion asks for confirmation first.
    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-delete"));
    const dialog = await screen.findByTestId("page-delete-dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Second");
    // Still on disk until the confirmation is clicked.
    expect((await loadStored(dbName, "Site")).pages).toHaveLength(2);

    await user.click(screen.getByTestId("page-delete-confirm"));
    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages).toHaveLength(1);
      expect(stored.pages[0]!.slug).toBe("site");
    });

    // The last page cannot be deleted: the menu action is disabled.
    await openPageMenu(user);
    expect(await screen.findByTestId("page-menu-delete")).toHaveAttribute("aria-disabled", "true");
  });

  it("sets an internal link destination and reports deleted target pages", async () => {
    const user = userEvent.setup();
    const dbName = "pages-links";
    const project = await seedProject(dbName, "Site", [typedNode("node-button", "CTA", "button")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Site" });

    await createPage(user, "About");
    await waitFor(() => expect(within(pageSelector()).getAllByRole("option")).toHaveLength(2));

    // Back to the first page, select the button, choose the About page.
    await user.selectOptions(pageSelector(), project.pages[0]!.id);
    await user.click(rowByNodeId("node-button"));
    await user.selectOptions(screen.getByTestId("node-button-prop-href-page"), "page:about");

    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages[0]!.root.children[0]!.props.href).toBe("page:about");
    });

    // Delete the target page, then confirm the destination is reported.
    await user.selectOptions(pageSelector(), (await loadStored(dbName, "Site")).pages[1]!.id);
    await openPageMenu(user);
    await user.click(await screen.findByTestId("page-menu-delete"));
    await user.click(await screen.findByTestId("page-delete-confirm"));
    await waitFor(async () => {
      const stored = await loadStored(dbName, "Site");
      expect(stored.pages).toHaveLength(1);
    });

    await user.selectOptions(pageSelector(), project.pages[0]!.id);
    await user.click(rowByNodeId("node-button"));
    expect(await screen.findByTestId("node-button-prop-href-broken")).toBeInTheDocument();
    // The stored destination is untouched so it can be repaired or restored.
    const stored = await loadStored(dbName, "Site");
    expect(stored.pages[0]!.root.children[0]!.props.href).toBe("page:about");
  });
});
