import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/services/projectService";
import { STARTERS, starterPages } from "@/features/projects/services/starters";
import type { ProjectRepository, StarterId } from "@/features/projects/types";
import type { FrameProject } from "@/features/document/model";
import { validateProject } from "@/features/document/validation";
import { collectAssetReferences, validateForExport } from "@/features/export/validation";
import { PAGE_HREF_PREFIX, resolveHref } from "@/features/document/navigation";
import { walkNodes } from "@/features/document/traversal";
import { collectNodeIds } from "@/features/projects/services/testSupport";

/**
 * Phase 11 "Create a polished demo project" (spec §35) with the §6 starter
 * templates: every offered starter must produce a document the editor
 * accepts and the exporter will ship — real components, unique IDs, unique
 * slugs, and links that actually resolve.
 */

function stubRepository(): { repository: ProjectRepository; saved: FrameProject[] } {
  const saved: FrameProject[] = [];
  const repository: ProjectRepository = {
    listProjects: () => Promise.resolve([...saved]),
    getProject: (id) => Promise.resolve(saved.find((project) => project.id === id) ?? null),
    saveProject: (project) => {
      const index = saved.findIndex((existing) => existing.id === project.id);
      if (index === -1) saved.push(project);
      else saved[index] = project;
      return Promise.resolve();
    },
    deleteProject: () => Promise.resolve(),
    putAsset: () => Promise.resolve(),
    getAssetBlob: () => Promise.resolve(null),
    deleteAsset: () => Promise.resolve(),
  };
  return { repository, saved };
}

async function createWithStarter(
  starter: StarterId | undefined,
  name = "Studio Site",
): Promise<FrameProject> {
  const { repository } = stubRepository();
  return createProject(repository, { name, ...(starter ? { starter } : {}) });
}

/** Every stored `href` in the project. */
function collectHrefs(project: FrameProject): string[] {
  const hrefs: string[] = [];
  for (const page of project.pages) {
    walkNodes(page.root, (node) => {
      const href = node.props.href;
      if (typeof href === "string") hrefs.push(href);
    });
  }
  return hrefs;
}

const starterIds = STARTERS.map((starter) => starter.id);

describe("starter templates (Phase 11, spec §6)", () => {
  it("offers exactly the starters that are implemented", () => {
    expect(starterIds).toEqual(["blank", "landing", "portfolio"]);
    for (const id of starterIds) {
      expect(() => starterPages(id, "Any Name")).not.toThrow();
    }
  });

  it.each(starterIds)("the %s starter produces a valid, exportable project", async (starter) => {
    const project = await createWithStarter(starter);

    expect(validateProject(project)).toEqual([]);

    // IDs are unique across the whole project, not just within a page (§12).
    const ids = collectNodeIds(project.pages.map((page) => page.root));
    expect(new Set(ids).size).toBe(ids.length);

    // Slugs are unique so routes and links never collide (§20).
    const slugs = project.pages.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => slug.length > 0)).toBe(true);

    // A starter project must survive export validation untouched: no missing
    // assets, no broken links, no unknown components.
    const assetKeys = new Set(
      collectAssetReferences(project).map((reference) => reference.storageKey),
    );
    const report = validateForExport(project, assetKeys);
    expect(report.errors).toEqual([]);
  });

  it("keeps the blank starter empty by default", async () => {
    const project = await createWithStarter(undefined);
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]?.root.children).toEqual([]);

    // Omitting the starter behaves exactly like naming it.
    const explicit = await createWithStarter("blank");
    expect(explicit.pages).toHaveLength(1);
    expect(explicit.pages[0]?.root.children).toEqual([]);
  });

  it("builds the landing starter as one complete page", async () => {
    const project = await createWithStarter("landing");
    expect(project.pages).toHaveLength(1);

    const page = project.pages[0];
    expect(page?.root.children.length).toBeGreaterThanOrEqual(5);

    // The composition is recognizable: navbar, hero, features, CTA, footer.
    const types = page?.root.children.map((node) => node.type) ?? [];
    expect(types).toContain("navbar");
    expect(types).toContain("hero");
    expect(types).toContain("footer");

    // The calls to action are genuinely functional (mailto works anywhere).
    expect(collectHrefs(project).some((href) => href.startsWith("mailto:"))).toBe(true);
  });

  it("links the portfolio starter's two pages to each other", async () => {
    const project = await createWithStarter("portfolio");
    expect(project.pages).toHaveLength(2);

    const internal = collectHrefs(project).filter((href) =>
      href.startsWith(PAGE_HREF_PREFIX),
    );
    // Navbar, hero, and closing CTA on both pages point at real pages.
    expect(internal.length).toBeGreaterThanOrEqual(3);

    for (const href of internal) {
      const resolution = resolveHref(href, project.pages);
      expect(resolution.kind).toBe("page");
      if (resolution.kind !== "page") continue;
      expect(resolution.pageId).not.toBeNull();
    }

    // Both directions: each page links to the other one.
    const [home, about] = project.pages;
    expect(collectHrefs({ ...project, pages: [home!] }).join(" ")).toContain(
      `page:${about?.slug}`,
    );
    expect(collectHrefs({ ...project, pages: [about!] }).join(" ")).toContain(
      `page:${home?.slug}`,
    );
  });

  it("never collides with a project literally named \"About\"", async () => {
    const project = await createWithStarter("portfolio", "About");
    const slugs = project.pages.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(validateProject(project)).toEqual([]);
  });
});
