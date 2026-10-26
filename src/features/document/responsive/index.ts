import type {
  BreakpointId,
  FrameNode,
  StyleBreakpoint,
  StyleValue,
} from "@/features/document/model";

/**
 * Responsive style resolution (spec §16, §17).
 *
 * Base styles on a node are the desktop defaults. Each narrower breakpoint
 * carries **independent** overrides: the mobile range does not inherit the
 * tablet range, only the base record (spec §16 "Base values apply unless an
 * override exists"). Style overrides are stored structurally, never as CSS
 * text, and resolve through this one module so the editor, preview, and
 * exporter agree.
 */

/** Editor breakpoint boundaries (spec §16 consistent breakpoint system). */
export const MOBILE_MAX_WIDTH = 639;
export const TABLET_MIN_WIDTH = 640;
export const DESKTOP_MIN_WIDTH = 1024;

/** CSS media query for each override range — mutually exclusive by design. */
export const BREAKPOINT_MEDIA_QUERIES: Readonly<Record<BreakpointId, string>> = {
  tablet: `(min-width: ${TABLET_MIN_WIDTH}px) and (max-width: 1023.98px)`,
  mobile: `(max-width: 639.98px)`,
};

export const BREAKPOINT_LABELS: Readonly<Record<StyleBreakpoint, string>> = {
  base: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/** Range description shown in the inspector when editing a breakpoint. */
export const BREAKPOINT_RANGES: Readonly<Record<StyleBreakpoint, string>> = {
  base: `${DESKTOP_MIN_WIDTH}px and wider`,
  tablet: `${TABLET_MIN_WIDTH}–1023px`,
  mobile: `below ${TABLET_MIN_WIDTH}px`,
};

/** The breakpoint whose styles apply at a document viewport width. */
export function breakpointForWidth(width: number): StyleBreakpoint {
  if (!Number.isFinite(width)) return "base";
  if (width < TABLET_MIN_WIDTH) return "mobile";
  if (width < DESKTOP_MIN_WIDTH) return "tablet";
  return "base";
}

/** Breakpoint-specific overrides of a node, or an empty record. */
export function getBreakpointStyles(
  node: FrameNode,
  breakpoint: BreakpointId,
): Record<string, StyleValue> {
  return node.responsive?.[breakpoint] ?? {};
}

/**
 * The declarations that apply at `breakpoint`: base styles merged with that
 * breakpoint's overrides (never another breakpoint's).
 */
export function resolveNodeStyles(
  node: FrameNode,
  breakpoint: StyleBreakpoint,
): Record<string, StyleValue> {
  if (breakpoint === "base") return node.styles;
  const overrides = getBreakpointStyles(node, breakpoint);
  // No override: the base record *is* the resolved result (same reference).
  if (Object.keys(overrides).length === 0) return node.styles;
  return { ...node.styles, ...overrides };
}

/**
 * A shallow copy of `node` whose `styles` are resolved for `breakpoint`,
 * used by the renderers. The stored node is never mutated; the copy is only
 * a render-time view (children still resolve themselves).
 */
export function withResolvedStyles(node: FrameNode, breakpoint: StyleBreakpoint): FrameNode {
  if (breakpoint === "base") return node;
  return { ...node, styles: resolveNodeStyles(node, breakpoint) };
}

/** True when the breakpoint has at least one override on this node. */
export function hasBreakpointOverrides(node: FrameNode, breakpoint: BreakpointId): boolean {
  return Object.keys(getBreakpointStyles(node, breakpoint)).length > 0;
}
