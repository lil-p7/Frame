import "fake-indexeddb/auto";
import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { FrameNode } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import {
  buildExportPackage,
  readBlobBytes,
  reportForExport,
} from "@/features/export/services/exportService";
import { ExportBlockedError } from "@/features/export/validation";

function node(
  type: string,
  overrides: { id: string; props?: Record<string, unknown>; hidden?: boolean },
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    id: overrides.id,
    props: { ...base.props, ...(overrides.props ?? {}) },
    children: [],
    editor: { hidden: overrides.hidden ?? false, locked: false },
  };
}

/**
 * Seeds a project with page content and uploaded image bytes.
 *
 * The asset records are written through the real repository, but the bytes
 * are handed back as genuine `Blob`s: jsdom's IndexedDB shim deserializes
 * stored blobs into plain objects, while a browser returns real `Blob`s, so
 * the read path is exercised with the same kind of value the browser
 * provides. Missing records still return null, which is what the validation
 * test below relies on.
 */
async function seed(
  dbName: string,
  nodes: FrameNode[],
  uploads: Array<{ storageKey: string; name: string; bytes: number[] }> = [],
): Promise<{ repository: DexieProjectRepository; project: Awaited<ReturnType<typeof createProject>> }> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name: "Portfolio Website" });
  const page = project.pages[0];
  if (page === undefined) throw new Error("fixture broken: project has no page");
  page.root.children = nodes;
  project.assets = uploads.map((upload, index) => ({
    id: `record-${index}`,
    name: upload.name,
    mimeType: "image/png",
    size: upload.bytes.length,
    storageKey: upload.storageKey,
  }));
  for (const upload of uploads) {
    await repository.putAsset({
      storageKey: upload.storageKey,
      mimeType: "image/png",
      blob: new Blob([new Uint8Array(upload.bytes)], { type: "image/png" }),
    });
  }
  await repository.saveProject(project);

  const storedRead = repository.getAssetBlob.bind(repository);
  vi.spyOn(repository, "getAssetBlob").mockImplementation(async (storageKey: string) => {
    const upload = uploads.find((candidate) => candidate.storageKey === storageKey);
    if (upload === undefined) return null;
    const stored = await storedRead(storageKey);
    if (stored === null) return null;
    return new Blob([new Uint8Array(upload.bytes)], { type: "image/png" });
  });

  return { repository, project };
}

function decode(entry: Uint8Array): string {
  return new TextDecoder().decode(entry);
}

describe("export service (spec §23, §31)", () => {
  it("packages the generated site with its referenced images", async () => {
    const { repository, project } = await seed(
      "export-package",
      [
        node("section", { id: "n-section" }),
        node("image", { id: "n-image", props: { src: "asset:asset-photo", alt: "Photo" } }),
      ],
      [{ storageKey: "asset-photo", name: "photo.png", bytes: [1, 2, 3, 4] }],
    );

    const report = await reportForExport(project, repository);
    expect(report.errors).toEqual([]);

    const built = await buildExportPackage(project, repository);
    expect(built.fileName).toBe("portfolio-website-site.zip");
    expect(built.assetCount).toBe(1);
    expect(built.blob.type).toBe("application/zip");

    const entries = unzipSync(await readBlobBytes(built.blob));
    const paths = Object.keys(entries).sort();
    expect(paths).toContain("portfolio-website-site/package.json");
    expect(paths).toContain("portfolio-website-site/src/App.tsx");
    expect(paths).toContain("portfolio-website-site/src/pages/PortfolioWebsitePage.tsx");
    // Images land under `public/`, which Vite copies to the built site root.
    expect(paths).toContain("portfolio-website-site/public/assets/asset-photo.png");

    // The image bytes survive the round trip, not just their name.
    expect(
      Array.from(entries["portfolio-website-site/public/assets/asset-photo.png"]!),
    ).toEqual([1, 2, 3, 4]);

    // The page source points at the packaged file, and the archive opens.
    const home = decode(entries["portfolio-website-site/src/pages/PortfolioWebsitePage.tsx"]!);
    expect(home).toContain('src={"./assets/asset-photo.png"}');
    expect(decode(entries["portfolio-website-site/package.json"]!)).toContain(
      '"name": "portfolio-website"',
    );
  });

  it("refuses to export while a referenced image is missing", async () => {
    const { repository, project } = await seed("export-missing-asset", [
      node("image", { id: "n-image", props: { src: "asset:asset-gone", alt: "Gone" } }),
    ]);

    const report = await reportForExport(project, repository);
    expect(report.errors.join(" ")).toContain("stored file is missing");

    await expect(buildExportPackage(project, repository)).rejects.toBeInstanceOf(ExportBlockedError);
  });

  it("packages only the assets the delivered pages reference", async () => {
    const { repository, project } = await seed(
      "export-unused-asset",
      [
        node("image", { id: "n-used", props: { src: "asset:asset-used", alt: "Used" } }),
        node("image", { id: "n-hidden", props: { src: "asset:asset-hidden" }, hidden: true }),
      ],
      [
        { storageKey: "asset-used", name: "used.png", bytes: [7] },
        { storageKey: "asset-hidden", name: "hidden.png", bytes: [8] },
      ],
    );

    const built = await buildExportPackage(project, repository);
    const entries = unzipSync(await readBlobBytes(built.blob));
    const paths = Object.keys(entries);
    expect(paths).toContain("portfolio-website-site/public/assets/asset-used.png");
    // Hidden components are not rendered, so their images stay out (§9C).
    expect(paths.some((path) => path.includes("asset-hidden"))).toBe(false);
    expect(built.assetCount).toBe(1);
  });
});
