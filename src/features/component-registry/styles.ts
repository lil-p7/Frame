import type { CSSProperties } from "react";
import type { StyleValue } from "@/features/document/model";

/**
 * Structured style model (spec §17): only these CSS properties are supported
 * initially. Anything else is rejected by style commands so the editor never
 * stores a property with no defined renderer or exporter behavior.
 */
export const SUPPORTED_STYLE_KEYS = [
  // Layout
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "flexWrap",
  "gap",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "gridTemplateColumns",
  "overflow",
  // Spacing
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  // Typography
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "textTransform",
  // Appearance
  "color",
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "borderRadius",
  "opacity",
  "boxShadow",
] as const;

const SUPPORTED_STYLE_KEY_SET: ReadonlySet<string> = new Set(SUPPORTED_STYLE_KEYS);

export function isSupportedStyleKey(key: string): boolean {
  return SUPPORTED_STYLE_KEY_SET.has(key);
}

/**
 * Rejects values that could smuggle executable content into a page
 * (spec §17, §32): `javascript:` URLs, CSS `expression()`, and markup.
 * `null` is valid — it clears an override.
 */
export function isSafeStyleValue(value: StyleValue): boolean {
  if (value === null) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const lowered = value.toLowerCase().trim();
  return (
    !lowered.includes("javascript:") &&
    !lowered.includes("expression(") &&
    !lowered.includes("<script") &&
    !lowered.includes("url(javascript")
  );
}

/** Validates a whole style record against the supported key/value rules. */
export function isValidStyleRecord(styles: Record<string, StyleValue>): boolean {
  for (const [key, value] of Object.entries(styles)) {
    if (!isSupportedStyleKey(key)) return false;
    if (!isSafeStyleValue(value)) return false;
  }
  return true;
}

/**
 * Converts a stored style record into React inline styles.
 * `null` values (override removals) are omitted. Values are already
 * validated by the command layer; this is a display-time conversion.
 */
export function stylesToCss(styles: Record<string, StyleValue>): CSSProperties {
  const css: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (value === null || !isSupportedStyleKey(key)) continue;
    if (!isSafeStyleValue(value)) continue;
    css[key] = value;
  }
  return css;
}
