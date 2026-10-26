import { describe, expect, it } from "vitest";
import { createRootNode, type FramePage } from "@/features/document/model";
import {
  PAGE_HREF_PREFIX,
  hrefForPage,
  isBrokenPageHref,
  resolveHref,
} from "@/features/document/navigation";
import { isSafeHref } from "@/features/component-registry/definitions/interactive";

function page(id: string, slug: string): FramePage {
  return {
    id,
    name: slug,
    slug,
    root: createRootNode(`root-${id}`),
    settings: { title: slug, backgroundColor: "#ffffff" },
  };
}

const pages = [page("page-home", "home"), page("page-about", "about")];

describe("link destinations (spec §20)", () => {
  it("classifies external, anchor, empty, and internal destinations", () => {
    expect(resolveHref("https://example.com", pages)).toEqual({
      kind: "external",
      href: "https://example.com",
    });
    expect(resolveHref("#work", pages)).toEqual({ kind: "anchor", anchor: "work" });
    expect(resolveHref("", pages)).toEqual({ kind: "empty" });
    expect(resolveHref(hrefForPage(pages[1]!), pages)).toEqual({
      kind: "page",
      slug: "about",
      pageId: "page-about",
    });
    expect(hrefForPage(pages[1]!)).toBe(`${PAGE_HREF_PREFIX}about`);
  });

  it("reports a deleted target page instead of linking nowhere", () => {
    expect(resolveHref("page:missing", pages)).toEqual({
      kind: "page",
      slug: "missing",
      pageId: null,
    });
    expect(isBrokenPageHref("page:missing", pages)).toBe(true);
    expect(isBrokenPageHref("page:home", pages)).toBe(false);
    expect(isBrokenPageHref("https://example.com", pages)).toBe(false);
  });

  it("accepts internal page links while rejecting active URL schemes", () => {
    expect(isSafeHref("page:about")).toBe(true);
    expect(isSafeHref("#section")).toBe(true);
    expect(isSafeHref("/docs")).toBe(true);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("mailto:hi@example.com")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});
