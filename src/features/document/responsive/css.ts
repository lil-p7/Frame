import type { FrameNode, StyleValue } from "@/features/document/model";
import { RESPONSIVE_BREAKPOINTS } from "@/features/document/model";
import {
  BREAKPOINT_MEDIA_QUERIES,
  getBreakpointStyles,
  resolveNodeStyles,
} from "@/features/document/responsive";
import { SUPPORTED_STYLE_KEYS, isSafeStyleValue } from "@/features/component-registry/styles";

/**
 * Responsive CSS generation (spec §16 "Generate valid responsive CSS",
 * §17 "CSS output").
 *
 * Produces structured rules first — base declarations plus one media-query
 * block per breakpoint that has overrides — then serializes deterministically.
 * Selectors are supplied by the caller so output stays stable: the same
 * document and selector produce the same CSS (spec §17).
 *
 * The editor renders through `resolveNodeStyles`, and these rules are built
 * from the same resolved declarations, so exported CSS matches the canvas.
 */

export interface StyleRule {
  selector: string;
  /** Media query for breakpoint rules; null for the base rule. */
  media: string | null;
  /** CSS declarations (kebab-case properties, serialized values). */
  declarations: Record<string, string>;
}

/** React treats these as unitless numbers; every other numeric value is px. */
const UNITLESS_STYLE_KEYS: ReadonlySet<string> = new Set([
  "opacity",
  "fontWeight",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
  "zIndex",
  "gridColumn",
  "gridRow",
]);

const SUPPORTED_KEYS: ReadonlySet<string> = new Set(SUPPORTED_STYLE_KEYS);

/** camelCase style key → kebab-case CSS property (`borderRadius` → `border-radius`). */
export function cssPropertyName(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Serializes a stored style value for CSS text (`24` → `24px`). */
export function cssPropertyValue(key: string, value: StyleValue): string | null {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return UNITLESS_STYLE_KEYS.has(key) ? String(value) : `${value}px`;
  }
  return value;
}

function declarationRecord(styles: Record<string, StyleValue>): Record<string, string> {
  const declarations: Record<string, string> = {};
  // Object.entries order follows insertion; sort for deterministic output.
  for (const key of Object.keys(styles).sort()) {
    if (!SUPPORTED_KEYS.has(key)) continue;
    const value = styles[key] ?? null;
    // The same safety rule the editor's inline styles obey (§17, §32): a
    // value that could smuggle executable content never reaches CSS text.
    if (!isSafeStyleValue(value)) continue;
    const serialized = cssPropertyValue(key, value);
    if (serialized === null) continue;
    declarations[cssPropertyName(key)] = serialized;
  }
  return declarations;
}

/**
 * Rules for one node: the base record always, plus a media-query rule for
 * each breakpoint that carries overrides.
 */
export function responsiveStyleRules(node: FrameNode, selector: string): StyleRule[] {
  const rules: StyleRule[] = [
    { selector, media: null, declarations: declarationRecord(resolveNodeStyles(node, "base")) },
  ];

  for (const breakpoint of RESPONSIVE_BREAKPOINTS) {
    if (Object.keys(getBreakpointStyles(node, breakpoint)).length === 0) continue;
    rules.push({
      selector,
      media: BREAKPOINT_MEDIA_QUERIES[breakpoint],
      declarations: declarationRecord(resolveNodeStyles(node, breakpoint)),
    });
  }
  return rules;
}

/** Serializes structured rules to CSS text with deterministic ordering. */
export function styleRulesToCss(rules: readonly StyleRule[]): string {
  return rules
    .map((rule) => {
      const body = Object.entries(rule.declarations)
        .map(([property, value]) => `  ${property}: ${value};`)
        .join("\n");
      const block = `${rule.selector} {\n${body}\n}`;
      return rule.media === null ? block : `@media ${rule.media} {\n${indent(block)}\n}`;
    })
    .join("\n\n");
}

/** Convenience: one node's complete responsive CSS. */
export function responsiveCssForNode(node: FrameNode, selector: string): string {
  return styleRulesToCss(responsiveStyleRules(node, selector));
}

function indent(block: string): string {
  return block
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
