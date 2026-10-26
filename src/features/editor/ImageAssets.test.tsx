import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
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
import { storageKeyFromSrc } from "@/features/assets/service";

function imageNode(id: string, src = ""): FrameNode {
  const definition = getComponent("image")!;
  return {
    ...definition.createDefaultNode(),
    id,
    props: { ...definition.createDefaultProps(), src },
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

async function loadStoredPage(dbName: string, name: string) {
  const repository = new DexieProjectRepository(dbName);
  const projects = await repository.listProjects();
  const project = projects.find((candidate) => candidate.name === name);
  if (project === undefined) throw new Error(`fixture broken: ${name} not persisted`);
  const page = project.pages[0];
  if (page === undefined) throw new Error(`fixture broken: ${name} has no pages`);
  return page;
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  resetHistory();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

function rowByNodeId(nodeId: string): HTMLElement {
  const row = screen
    .getAllByTestId("layer-row")
    .find((candidate) => candidate.getAttribute("data-node-id") === nodeId);
  if (row === undefined) throw new Error(`layer row not found: ${nodeId}`);
  return row;
}

function canvasSrc(): string | null {
  const img = document.querySelector('[data-testid="image-node"]');
  return img?.getAttribute("src") ?? null;
}

describe("image assets (Phase 9, spec §19)", () => {
  it("uploads a local image, renders it, and survives a reload", async () => {
    const user = userEvent.setup();
    const dbName = "asset-upload";
    const project = await seedProject(dbName, "Asset Upload", [imageNode("node-image")]);
    const firstRender = renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Asset Upload" });
    await user.click(rowByNodeId("node-image"));

    const file = new File([new Uint8Array([1, 2, 3, 4])], "photo.png", { type: "image/png" });
    await user.upload(screen.getByTestId("node-image-prop-src-upload"), file);

    // The canvas renders the stored blob as an object URL.
    await waitFor(() => expect(canvasSrc()).toMatch(/^blob:/));

    // The document stores a stable asset reference, not the object URL, and
    // the component keeps its ID.
    const stored = await waitFor(
      async () => {
        const candidate = await loadStoredPage(dbName, "Asset Upload");
        expect(candidate.root.children[0]!.props.src).toMatch(/^asset:/);
        return candidate;
      },
      { timeout: 3000 },
    );
    const src = stored.root.children[0]!.props.src;
    const key = storageKeyFromSrc(src);
    expect(key).not.toBeNull();
    expect(stored.root.children[0]!.id).toBe("node-image");

    const repository = new DexieProjectRepository(dbName);
    const raw = await repository.getProject(project.id);
    expect(raw?.assets).toHaveLength(1);
    expect(raw?.assets[0]?.storageKey).toBe(key);
    expect(await repository.getAssetBlob(key!)).not.toBeNull();

    // Reload the editor: the image is restored from storage (§19).
    firstRender.unmount();
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Asset Upload" });
    await waitFor(() => expect(canvasSrc()).toMatch(/^blob:/));
  });

  it("replacing the image keeps the component ID and stores a new asset", async () => {
    const user = userEvent.setup();
    const dbName = "asset-replace";
    const project = await seedProject(dbName, "Asset Replace", [imageNode("node-image")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Asset Replace" });
    await user.click(rowByNodeId("node-image"));

    await user.upload(
      screen.getByTestId("node-image-prop-src-upload"),
      new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
    );
    await waitFor(() => expect(canvasSrc()).toMatch(/^blob:/));
    const firstKey = storageKeyFromSrc(
      (await loadStoredPage(dbName, "Asset Replace")).root.children[0]!.props.src,
    );

    // Replace: the button label switches once an asset is attached.
    await user.upload(
      screen.getByTestId("node-image-prop-src-upload"),
      new File([new Uint8Array([9, 9])], "two.png", { type: "image/png" }),
    );
    const stored = await waitFor(
      async () => {
        const candidate = await loadStoredPage(dbName, "Asset Replace");
        const nextKey = storageKeyFromSrc(candidate.root.children[0]!.props.src);
        expect(nextKey).not.toBe(firstKey);
        return candidate;
      },
      { timeout: 3000 },
    );

    expect(stored.root.children[0]!.id).toBe("node-image"); // same component
    const raw = await new DexieProjectRepository(dbName).getProject(project.id);
    expect(raw?.assets).toHaveLength(2);
  });

  it("rejects unsupported files without touching the document", async () => {
    const user = userEvent.setup();
    const dbName = "asset-invalid";
    const project = await seedProject(dbName, "Asset Invalid", [imageNode("node-image")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Asset Invalid" });
    await user.click(rowByNodeId("node-image"));

    await user.upload(
      screen.getByTestId("node-image-prop-src-upload"),
      new File(["<script>1</script>"], "evil.txt", { type: "text/plain" }),
    );

    // Give the queued command a moment, then confirm nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const stored = await loadStoredPage(dbName, "Asset Invalid");
    expect(stored.root.children[0]!.props.src).toBe("");
    const raw = await new DexieProjectRepository(dbName).getProject(project.id);
    expect(raw?.assets).toHaveLength(0);
    expect(canvasSrc()).toBeNull();
  });

  it("shows a recoverable state when a referenced asset is missing", async () => {
    const user = userEvent.setup();
    const dbName = "asset-missing";
    const project = await seedProject(dbName, "Asset Missing", [
      imageNode("node-image", "asset:asset-does-not-exist"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Asset Missing" });

    // Controlled fallback, with the stored reference preserved for repair.
    expect(await screen.findByTestId("image-missing")).toBeInTheDocument();
    const row = screen
      .getAllByTestId("layer-row")
      .find((candidate) => candidate.getAttribute("data-node-id") === "node-image");
    await user.click(row!);
    expect(await screen.findByTestId("node-image-prop-src-input")).toHaveValue(
      "asset:asset-does-not-exist",
    );
  });
});
