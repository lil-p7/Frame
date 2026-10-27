import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FramePage, FrameProject } from "@/features/document/model";
import { createRootNode } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";
import { previewPath } from "@/features/preview/paths";

function node(
  type: string,
  overrides: { id: string; props?: Record<string, unknown>; children?: FrameNode[]; hidden?: boolean },
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

function page(
  name: string,
  slug: string,
  children: FrameNode[],
  settings: Partial<FramePage["settings"]> = {},
): FramePage {
  return {
    id: `page-${slug}`,
    name,
    slug,
    root: { ...createRootNode(`root-${slug}`), children },
    settings: { title: name, backgroundColor: "#f8fafc", ...settings },
  };
}

/** Seeds a two-page project with a grid that has a mobile override. */
async function seedProject(dbName: string, name: string): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name });
  const home = page(
    "Home",
    "home",
    [
      node("grid", {
        id: "n-grid",
        children: [
          node("heading", { id: "n-heading", props: { text: "Home heading" } }),
          node("button", { id: "n-button", props: { label: "Go to About", href: "page:about" } }),
          node("text", { id: "n-hidden", props: { text: "Hidden note" }, hidden: true }),
        ],
      }),
    ],
    { title: "Home title", backgroundColor: "#f8fafc" },
  );
  const about = page("About", "about", [
    node("heading", { id: "n-about", props: { text: "About heading" } }),
  ], { title: "About title" });

  project.pages = [home, about];
  await repository.saveProject(project);
  return project;
}

function renderPreview(dbName: string, path: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, router };
}

function previewStyleSheet(): string {
  return document.querySelector('[data-testid="preview-viewport"] style')?.textContent ?? "";
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("preview mode (spec §22)", () => {
  it("renders the page without any editor chrome", async () => {
    const dbName = "preview-basic";
    const project = await seedProject(dbName, "Preview Basic");
    renderPreview(dbName, previewPath(project.id, "page-home"));

    const page = await screen.findByTestId("preview-page");
    expect(page).toHaveTextContent("Home heading");
    expect(page).toHaveTextContent("Go to About");
    // Hidden components are not delivered (spec §9C).
    expect(page).not.toHaveTextContent("Hidden note");

    // No editor surfaces: no canvas wrappers, inspector, toolbar, or status bar.
    expect(screen.queryByTestId("canvas-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-node")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inspector-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("save-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editor-status-bar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-component]").length).toBe(0);
  });

  it("offers a return-to-editor action and uses the page title", async () => {
    const dbName = "preview-chrome";
    const project = await seedProject(dbName, "Preview Chrome");
    renderPreview(dbName, previewPath(project.id, "page-home"));

    await screen.findByTestId("preview-page");
    expect(screen.getByTestId("back-to-editor")).toHaveAttribute(
      "href",
      `/editor/${project.id}`,
    );
    expect(screen.getByTestId("preview-page-name")).toHaveTextContent("Home");
    await waitFor(() => expect(document.title).toBe("Home title — Preview Chrome"));
  });

  it("navigates between project pages from a link on the page", async () => {
    const user = userEvent.setup();
    const dbName = "preview-navigation";
    const project = await seedProject(dbName, "Preview Navigation");
    renderPreview(dbName, previewPath(project.id, "page-home"));

    const pageContent = await screen.findByTestId("preview-page");
    const aboutLink = await screen.findByRole("link", { name: "Go to About" });
    // Internal destinations become in-app preview routes (spec §20).
    expect(aboutLink).toHaveAttribute("href", previewPath(project.id, "page-about"));

    await user.click(aboutLink);
    await waitFor(() => expect(screen.getByTestId("preview-page-name")).toHaveTextContent("About"));
    expect(pageContent).toHaveTextContent("About heading");
  });

  it("renders the breakpoint that applies at the selected viewport width", async () => {
    const user = userEvent.setup();
    const dbName = "preview-viewport";
    const project = await seedProject(dbName, "Preview Viewport");
    renderPreview(dbName, previewPath(project.id, "page-home"));

    await screen.findByTestId("preview-page");
    const viewport = screen.getByTestId("preview-viewport");
    expect(viewport).toHaveAttribute("data-width", "1440");
    // Responsive CSS is resolved for the previewed width instead of relying on
    // media queries that would measure the browser window (spec §16).
    expect(previewStyleSheet()).toContain("repeat(2, minmax(0, 1fr))");
    expect(previewStyleSheet()).not.toContain("@media");

    await user.click(screen.getByRole("button", { name: /mobile viewport/i }));
    expect(viewport).toHaveAttribute("data-width", "390");
    expect(previewStyleSheet()).toContain("repeat(1, minmax(0, 1fr))");
    expect(previewStyleSheet()).not.toContain("@media");

    // The page background follows the document settings.
    expect(previewStyleSheet()).toContain("background-color: #f8fafc;");
  });

  it("switches pages from the preview page selector", async () => {
    const user = userEvent.setup();
    const dbName = "preview-page-select";
    const project = await seedProject(dbName, "Preview Page Select");
    const { router } = renderPreview(dbName, previewPath(project.id, "page-home"));

    await screen.findByTestId("preview-page");
    await user.selectOptions(screen.getByRole("combobox", { name: "Preview page" }), "page-about");

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(previewPath(project.id, "page-about")),
    );
    expect(screen.getByTestId("preview-page")).toHaveTextContent("About heading");
  });

  it("recovers gracefully from a missing project or page", async () => {
    const dbName = "preview-missing";
    const project = await seedProject(dbName, "Preview Missing");
    renderPreview(dbName, previewPath("does-not-exist", "page-home"));
    expect(await screen.findByText("Project not found")).toBeInTheDocument();

    renderPreview(dbName, previewPath(project.id, "page-gone"));
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preview the first page" })).toHaveAttribute(
      "href",
      previewPath(project.id, "page-home"),
    );
  });
});
