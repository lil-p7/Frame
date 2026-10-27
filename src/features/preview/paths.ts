import type { FrameProject } from "@/features/document/model";
import { resolveHref } from "@/features/document/navigation";

/**
 * Preview URLs (spec §5C, §22).
 *
 * Kept in its own module so the editor toolbar, the preview route, and the
 * link mapper all build the same address.
 */

/** `/preview/:projectId/:pageId` for a project page. */
export function previewPath(projectId: string, pageId: string): string {
  return `/preview/${projectId}/${pageId}`;
}

/** `/editor/:projectId`. */
export function editorPath(projectId: string): string {
  return `/editor/${projectId}`;
}

/**
 * Resolves a stored link destination for preview: another page of the
 * project becomes an in-app preview route, external URLs and section
 * anchors stay as they are, and an empty destination — or a link to a page
 * that no longer exists — becomes no link at all (spec §20).
 */
export function previewHrefFor(project: FrameProject, href: string): string | null {
  const resolution = resolveHref(href, project.pages);
  switch (resolution.kind) {
    case "empty":
      return null;
    case "page":
      return resolution.pageId === null ? null : previewPath(project.id, resolution.pageId);
    case "anchor":
      return `#${resolution.anchor}`;
    case "external":
      return resolution.href;
  }
}
