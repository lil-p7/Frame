import { describe, expect, it } from "vitest";
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  listProjectSummaries,
  renameProject,
} from "./projectService";
import type { FrameNode, FrameProject } from "@/features/document/model";
import type { CreateProjectInput, ProjectRepository } from "@/features/projects/types";
import { createId } from "@/lib/ids";
import { collectNodeIds } from "./testSupport";

/** In-memory adapter mirroring the Dexie persistence contract. */
function createMemoryRepository(
  initial: FrameProject[] = [],
): ProjectRepository & { data: FrameProject[]; assets: Map<string, unknown> } {
  const data = [...initial];
  const assets = new Map<string, unknown>();
  return {
    data,
    assets,
    putAsset(asset) {
      assets.set(asset.storageKey, asset.blob);
      return Promise.resolve();
    },
    getAssetBlob(storageKey) {
      return Promise.resolve((assets.get(storageKey) as Blob | undefined) ?? null);
    },
    deleteAsset(storageKey) {
      assets.delete(storageKey);
      return Promise.resolve();
    },
    listProjects() {
      return Promise.resolve([...data]);
    },
    getProject(id: string) {
      return Promise.resolve(data.find((project) => project.id === id) ?? null);
    },
    saveProject(project: FrameProject) {
      const index = data.findIndex((existing) => existing.id === project.id);
      if (index === -1) data.push(structuredClone(project));
      else data[index] = structuredClone(project);
      return Promise.resolve();
    },
    deleteProject(id: string) {
      const index = data.findIndex((project) => project.id === id);
      if (index !== -1) data.splice(index, 1);
      return Promise.resolve();
    },
  };
}

async function seedProject(
  repository: ProjectRepository,
  input: CreateProjectInput = { name: "Portfolio Website" },
): Promise<FrameProject> {
  return createProject(repository, input);
}

describe("projectService", () => {
  it("creates a project with one initial page and valid metadata", async () => {
    const repository = createMemoryRepository();
    const project = await seedProject(repository);

    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.slug).toBe("portfolio-website");
    // The page root container must exist and be the reserved root type.
    expect(project.pages[0]?.root.type).toBe("root");
    expect(project.pages[0]?.root.children).toEqual([]);
    expect(project.updatedAt).toBe(project.createdAt);
  });

  it("lists summaries with page counts", async () => {
    const repository = createMemoryRepository();
    await seedProject(repository, { name: "Alpha" });
    await seedProject(repository, { name: "Beta" });

    const summaries = await listProjectSummaries(repository);
    expect(summaries).toHaveLength(2);
    for (const summary of summaries) {
      expect(summary.corrupt).toBe(false);
      expect(summary.pageCount).toBe(1);
    }
  });

  it("flags corrupt records as summaries instead of throwing", async () => {
    const repository = createMemoryRepository();
    await seedProject(repository, { name: "Alpha" });
    repository.data.push({ id: createId(), name: "Broken" } as unknown as FrameProject);

    const summaries = await listProjectSummaries(repository);
    expect(summaries.find((summary) => summary.corrupt)).toBeDefined();
    expect(summaries.find((summary) => summary.corrupt)?.name).toBe("Broken");
  });

  it("renames a project and refreshes updatedAt", async () => {
    const repository = createMemoryRepository();
    const project = await seedProject(repository);

    const renamed = await renameProject(repository, project.id, "New Name");
    expect(renamed.name).toBe("New Name");
    expect(new Date(renamed.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(project.updatedAt).getTime(),
    );
    const reloaded = await getProject(repository, project.id);
    expect(reloaded?.name).toBe("New Name");
  });

  it("rejects empty rename", async () => {
    const repository = createMemoryRepository();
    const project = await seedProject(repository);

    await expect(renameProject(repository, project.id, "   ")).rejects.toThrow(
      /Project name is required/,
    );
  });

  it("duplicates regenerate every identity while preserving structure", async () => {
    const repository = createMemoryRepository();
    const source = await seedProject(repository, { name: "Portfolio Website" });

    const copy = await duplicateProject(repository, source.id);

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("Portfolio Website (Copy)");
    expect(copy.pages).toHaveLength(source.pages.length);
    for (const page of copy.pages) {
      expect(page.id).not.toBe(source.pages.find((original) => original.slug === page.slug)?.id);
    }

    // Every node ID in the copy must be fresh relative to the source.
    const sourceIds = source.pages.flatMap((page) => [
      page.id,
      page.root.id,
      ...collectNodeIds(page.root.children),
    ]);
    const copyIds = copy.pages.flatMap((page) => [
      page.id,
      page.root.id,
      ...collectNodeIds(page.root.children),
    ]);
    const overlap = copyIds.filter((id) => sourceIds.includes(id));
    expect(overlap).toEqual([]);
    expect(copyIds).toHaveLength(sourceIds.length);
  });

  it("deletes a project", async () => {
    const repository = createMemoryRepository();
    const project = await seedProject(repository);

    await deleteProject(repository, project.id);
    expect(await getProject(repository, project.id)).toBeNull();
  });

  it("copies assets when duplicating and releases them when deleting (§19)", async () => {
    const repository = createMemoryRepository();
    const project = await seedProject(repository);
    const image: FrameNode = {
      id: "node-image",
      type: "image",
      name: "Image",
      props: { src: "asset:asset-1", alt: "" },
      styles: {},
      children: [],
      editor: { hidden: false, locked: false },
    };
    const attached: FrameProject = {
      ...project,
      pages: [{ ...project.pages[0]!, root: { ...project.pages[0]!.root, children: [image] } }],
      assets: [{ id: "a1", name: "x.png", mimeType: "image/png", size: 4, storageKey: "asset-1" }],
    };
    await repository.saveProject(attached);
    await repository.putAsset({
      storageKey: "asset-1",
      mimeType: "image/png",
      blob: new Blob([new Uint8Array([1, 2, 3, 4])]),
    });

    // Duplicating owns fresh blobs and rewrites the copy's references.
    const copy = await duplicateProject(repository, attached.id);
    expect(copy.assets).toHaveLength(1);
    const copyKey = copy.assets[0]!.storageKey;
    expect(copyKey).not.toBe("asset-1");
    expect(repository.assets.has(copyKey)).toBe(true);
    expect(copy.pages[0]!.root.children[0]!.props.src).toBe(`asset:${copyKey}`);

    // Deleting the original releases only its own blobs.
    await deleteProject(repository, attached.id);
    expect(repository.assets.has("asset-1")).toBe(false);
    expect(repository.assets.has(copyKey)).toBe(true);
  });
});
