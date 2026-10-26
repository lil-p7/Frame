import type { FramePage } from "@/features/document/model";

/**
 * Internal navigation targets (spec §20 "Navigation").
 *
 * A destination can be an external URL, a section anchor (`#hero`), or
 * another page in the same project as `page:<slug>`. Resolution happens
 * wherever links are interpreted (editor hints now, preview/export next),
 * so a deleted page is reported as broken instead of silently linking
 * nowhere (§20 "Handle links to deleted pages gracefully").
 */

export const PAGE_HREF_PREFIX = "page:";

export type LinkResolution =
  | { kind: "empty" }
  | { kind: "anchor"; anchor: string }
  | { kind: "external"; href: string }
  /** `pageId` is null when the referenced page no longer exists. */
  | { kind: "page"; slug: string; pageId: string | null };

/** The stored destination for another page in this project. */
export function hrefForPage(page: FramePage): string {
  return `${PAGE_HREF_PREFIX}${page.slug}`;
}

/** Classifies a stored destination against the project's pages. */
export function resolveHref(href: string, pages: readonly FramePage[]): LinkResolution {
  const trimmed = href.trim();
  if (trimmed === "") return { kind: "empty" };
  if (trimmed.startsWith(PAGE_HREF_PREFIX)) {
    const slug = trimmed.slice(PAGE_HREF_PREFIX.length);
    const target = pages.find((page) => page.slug === slug);
    return { kind: "page", slug, pageId: target?.id ?? null };
  }
  if (trimmed.startsWith("#")) return { kind: "anchor", anchor: trimmed.slice(1) };
  return { kind: "external", href: trimmed };
}

/** True when a stored destination points at a page that no longer exists. */
export function isBrokenPageHref(href: string, pages: readonly FramePage[]): boolean {
  const resolution = resolveHref(href, pages);
  return resolution.kind === "page" && resolution.pageId === null;
}
