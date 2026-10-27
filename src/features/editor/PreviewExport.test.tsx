import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";
import { resetHistory } from "@/features/editor/stores/historyStore";
import { resetClipboard } from "@/features/editor/stores/clipboardStore";
import { assetSrcFor } from "@/features/assets/service";

function node(
  type: string,
  overrides: { id: string; props?: Record<string, unknown>; children?: FrameNode[] },
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    id: overrides.id,
    props: { ...base.props, ...(overrides.props ?? {}) },
    children: overrides.children ?? [],
  };
}

async function seedProject(
  dbName: string,
  name: string,
  nodes: FrameNode[],
  assets: FrameProject["assets"] = [],
): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name });
  const page = project.pages[0];
  if (page === undefined) throw new Error("fixture broken: project has no page");
  page.root.children = nodes;
  project.assets = assets;
  await repository.saveProject(project);
  return project;
}

function renderEditor(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, { initialEntries: [`/editor/${projectId}`] });
  const utils = render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, router, utils };
}

function rowByNodeId(nodeId: string): HTMLElement {
  const row = screen
    .getAllByTestId("layer-row")
    .find((candidate) => candidate.getAttribute("data-node-id") === nodeId);
  if (row === undefined) throw new Error(`layer row not found: ${nodeId}`);
  return row;
}

async function storedPage(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const project = await repository.getProject(projectId);
  if (project === null) throw new Error("fixture broken: project vanished");
  return project.pages[0]!;
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  resetHistory();
  resetClipboard();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("preview from the editor (spec §8, §22)", () => {
  it("opens preview mode with the document the user is editing", async () => {
    const user = userEvent.setup();
    const dbName = "editor-preview";
    const project = await seedProject(dbName, "Preview From Editor", [
      node("heading", { id: "n-heading", props: { text: "Draft heading" } }),
    ]);
    const { router } = renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Preview From Editor" });

    // Edit the text, then leave for preview immediately: pending commands are
    // flushed before navigating, so the preview shows the edited document.
    await user.click(rowByNodeId("n-heading"));
    const input = screen.getByTestId("n-heading-prop-text-input");
    await user.clear(input);
    await user.type(input, "Final heading");
    await user.click(screen.getByTestId("preview-button"));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/preview/${project.id}/${project.pages[0]!.id}`),
    );
    const preview = await screen.findByTestId("preview-page");
    expect(preview).toHaveTextContent("Final heading");
    // Editor chrome is gone; the preview offers the way back.
    expect(screen.queryByTestId("save-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("back-to-editor")).toHaveAttribute("href", `/editor/${project.id}`);

    // The edit was persisted before navigation.
    await waitFor(async () =>
      expect((await storedPage(dbName, project.id)).root.children[0]?.props.text).toBe(
        "Final heading",
      ),
    );
  });
});

describe("export from the editor (spec §8, §23)", () => {
  it("validates the project, then downloads a zip package", async () => {
    const user = userEvent.setup();
    const dbName = "editor-export";
    const project = await seedProject(dbName, "Export From Editor", [
      node("heading", { id: "n-heading", props: { text: "Exported heading" } }),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Export From Editor" });

    // jsdom cannot download; capture the anchor that the download uses.
    const downloads: Array<{ href: string; fileName: string }> = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push({ href: this.href, fileName: this.download });
      });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");

    await user.click(screen.getByTestId("export-button"));
    const dialog = await screen.findByTestId("export-dialog");
    await waitFor(() =>
      expect(within(dialog).getByTestId("export-validation-ready")).toBeInTheDocument(),
    );
    expect(within(dialog).getByText("React + Vite website (ZIP archive)")).toBeInTheDocument();

    await user.click(within(dialog).getByTestId("export-confirm"));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.fileName).toBe("export-from-editor-site.zip");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);
    expect(await within(dialog).findByText(/Downloaded/)).toBeInTheDocument();

    clickSpy.mockRestore();
    createObjectUrl.mockRestore();
  });

  it("explains blocking issues instead of exporting an incomplete site", async () => {
    const user = userEvent.setup();
    const dbName = "editor-export-blocked";
    const project = await seedProject(
      dbName,
      "Export Blocked",
      [
        node("image", {
          id: "n-image",
          props: { src: assetSrcFor("asset-missing"), alt: "Gone" },
        }),
      ],
      [
        {
          id: "record-1",
          name: "gone.png",
          mimeType: "image/png",
          size: 4,
          storageKey: "asset-missing",
        },
      ],
    );
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Export Blocked" });

    await user.click(screen.getByTestId("export-button"));
    const dialog = await screen.findByTestId("export-dialog");

    const errors = await within(dialog).findByTestId("export-errors");
    expect(errors).toHaveTextContent("stored file is missing");
    expect(within(dialog).getByTestId("export-confirm")).toBeDisabled();
  });
});
