import type { FrameNode, FramePage, StyleBreakpoint } from "@/features/document/model";
import { BREAKPOINT_MEDIA_QUERIES } from "@/features/document/responsive";
import { responsiveStyleRules, styleRulesToCss, type StyleRule } from "@/features/document/responsive/css";
import { walkVisibleNodes } from "@/features/document/traversal";
import { isSafeStyleValue } from "@/features/component-registry/styles";

/**
 * Page stylesheet generation (spec §16, §17 "CSS output").
 *
 * One stylesheet module feeds preview *and* export, so both surfaces render
 * from the same structured styles and cannot drift apart (spec §22):
 *
 * - `"responsive"` — base rules plus one media-query block per breakpoint
 *   that carries overrides. This is what the exported website ships, because
 *   a real browser decides which breakpoint applies while it scrolls.
 * - a single breakpoint — the declarations that apply at a preview viewport
 *   width, emitted unconditionally. Preview shows one chosen width at a
 *   time inside the app, where media queries would be evaluated against the
 *   browser window instead of the preview frame, so the breakpoint is
 *   resolved explicitly (the same resolution the canvas uses).
 *
 * Selectors are derived from node IDs, so identical documents always produce
 * identical CSS (spec §17: deterministic output, no random class names).
 */

/** Editing context accepted by the stylesheet generator. */
export type StylesheetMode = "responsive" | StyleBreakpoint;

/** Root wrapper class of a rendered page (carries the page background). */
export const PAGE_CLASS = "frame-page";

/**
 * CSS class for a node. Node IDs come from stored documents, which are
 * untrusted input (spec §32), so anything that is not safe inside a CSS
 * identifier is replaced rather than interpolated.
 */
export function nodeClassName(nodeId: string): string {
  const safe = nodeId.replace(/[^A-Za-z0-9_-]/g, "-");
  return `fr-${safe}`;
}

/** Selector for a node's rules. */
export function nodeSelector(nodeId: string): string {
  return `.${nodeClassName(nodeId)}`;
}

/** Page-level rule: the document background follows the page settings. */
function pageRootRules(page: FramePage): StyleRule[] {
  const background = page.settings.backgroundColor;
  if (!isSafeStyleValue(background)) return [];
  return [{ selector: `.${PAGE_CLASS}`, media: null, declarations: { "background-color": background } }];
}

/**
 * Every rule a page needs for `mode`, in document order. Hidden subtrees are
 * skipped: they are not rendered anywhere (spec §9C), so they get no CSS.
 */
export function pageStyleRules(page: FramePage, mode: StylesheetMode): StyleRule[] {
  const rules: StyleRule[] = pageRootRules(page);

  walkVisibleNodes(page.root, (node: FrameNode) => {
    const selector = nodeSelector(node.id);
    if (mode === "responsive") {
      rules.push(...responsiveStyleRules(node, selector));
      return;
    }
    rules.push(...unconditionalRulesForBreakpoint(node, selector, mode));
  });

  // Empty rules would serialize as empty blocks; they carry no information.
  return rules.filter((rule) => Object.keys(rule.declarations).length > 0);
}

/**
 * The declarations that apply at one breakpoint, with the media query
 * stripped. `responsiveStyleRules` emits the base rule first and skips
 * breakpoints without overrides, so falling back to the first rule is
 * exactly "base values apply unless an override exists" (spec §16).
 */
function unconditionalRulesForBreakpoint(
  node: FrameNode,
  selector: string,
  breakpoint: StyleBreakpoint,
): StyleRule[] {
  const rules = responsiveStyleRules(node, selector);
  const chosen =
    breakpoint === "base"
      ? rules[0]
      : (rules.find((rule) => rule.media === BREAKPOINT_MEDIA_QUERIES[breakpoint]) ?? rules[0]);
  return [{ selector, media: null, declarations: chosen?.declarations ?? {} }];
}

/** Deterministic CSS text for a page in the requested mode. */
export function pageStylesheet(page: FramePage, mode: StylesheetMode): string {
  return styleRulesToCss(pageStyleRules(page, mode));
}

/**
 * Component-level base styles used by *both* preview and export (spec §22
 * "share the same style semantics"). These are rendering rules with no
 * stored-style equivalent: layout behavior of elements whose delivered tag
 * differs from the editor's, and the placeholder states.
 */
export const COMPONENT_BASE_CSS = `/* Frame component base behavior (shared by preview and export). */
.${PAGE_CLASS} {
  min-height: 100vh;
}

/* Buttons are delivered as links so they can perform their action. */
.frame-button {
  display: inline-block;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

/* Dividers draw their top edge only, like the editor canvas. */
.frame-divider {
  height: 0;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
}

/* Controlled states for images (spec §19, §28). */
.frame-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 12px;
  background-color: #f4f4f5;
  color: #71717a;
  font-size: 12px;
  border: 1px dashed #a1a1aa;
}
`;

/**
 * Document reset for the exported site only.
 *
 * The editor canvas renders inside the Frame application, whose Tailwind
 * preflight already resets margins, borders, heading sizes, and replaced
 * elements. The exported site has no such stylesheet, so the parts that
 * affect layout are mirrored here; without them the same document would lay
 * out differently outside Frame (spec §22 preview/export fidelity).
 * Source: Tailwind CSS v4 preflight, restricted to document-relevant rules.
 */
export const SITE_RESET_CSS = `/* Base reset mirroring the Frame editor canvas defaults. */
*,
::after,
::before {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
}

html {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

body {
  font-family: inherit;
}

hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

a {
  color: inherit;
  text-decoration: inherit;
}

img,
svg,
video,
canvas {
  display: block;
  vertical-align: middle;
}

img,
video {
  max-width: 100%;
  height: auto;
}
`;
