import type { FrameNode, FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import type { StaticElement } from "@/features/component-registry/types";
import { nodeClassName } from "@/features/document/stylesheet";

/**
 * Static document tree (spec §12 "Rendering architecture", §22, §23).
 *
 * Turns a page's component tree into a React-free description of the page as
 * it will be delivered: elements, attributes, text, and their generated
 * stylesheet classes. Preview renders this description to React nodes; the
 * exporter serializes the very same description to JSX source — one
 * interpretation, two consumers, no second renderer to drift.
 *
 * Editor chrome (selection wrappers, `data-component` hooks, drag handles)
 * exists only in the canvas and never appears here (spec §32).
 */

/** One rendered element plus its rendered children, in stored order. */
export interface StaticNode {
  /** Source node ID — used for React keys and, indirectly, the CSS class. */
  nodeId: string;
  element: StaticElement;
  /** Generated class for this node, merged with any element extras. */
  className: string;
  children: StaticNode[];
}

export interface StaticTreeOptions {
  /**
   * Rewrites stored node data for this consumer before it is interpreted —
   * asset references become object URLs (preview) or packaged paths (export).
   * The stored document is never modified.
   */
  transformNode?: (node: FrameNode) => FrameNode;
  /**
   * Maps a stored link destination (`#anchor`, `page:<slug>`, url) to this
   * consumer's href; null means "not a link" (no destination, or a target
   * that cannot be resolved here — spec §20).
   */
  mapHref?: (href: string) => string | null;
}

/** Default destination mapping: keep usable links, drop empty ones. */
function defaultMapHref(href: string): string | null {
  return href.trim() === "" ? null : href;
}

/**
 * Builds the static view of a node, or null when it must not be rendered
 * (hidden). Children are only rendered for components that accept them, so a
 * stray subtree in imported data cannot produce invalid markup.
 */
export function buildStaticTree(
  node: FrameNode,
  options: StaticTreeOptions = {},
): StaticNode | null {
  // Hidden components are editor metadata, not content (spec §9C).
  if (node.editor.hidden) return null;

  const definition = getComponent(node.type);
  const context = { mapHref: options.mapHref ?? defaultMapHref };
  const view = options.transformNode === undefined ? node : options.transformNode(node);

  if (definition === undefined) {
    return {
      nodeId: node.id,
      element: unknownComponentElement(node.type),
      className: [nodeClassName(node.id), "frame-placeholder"].join(" "),
      // Keep showing whatever the unknown component contained: no content
      // silently disappears from the page (spec §12).
      children: renderChildren(node, options),
    };
  }

  const element = definition.renderStatic(view, context);
  return {
    nodeId: node.id,
    element,
    className: [nodeClassName(node.id), element.className ?? ""].join(" ").trim(),
    children: definition.acceptsChildren ? renderChildren(node, options) : [],
  };
}

/** Rendered children of a node, skipping hidden subtrees. */
function renderChildren(node: FrameNode, options: StaticTreeOptions): StaticNode[] {
  const children: StaticNode[] = [];
  for (const child of node.children) {
    const built = buildStaticTree(child, options);
    if (built !== null) children.push(built);
  }
  return children;
}

/** Visible children of a page root — the page's content, in stored order. */
export function buildStaticPage(page: FramePage, options: StaticTreeOptions = {}): StaticNode[] {
  return renderChildren(page.root, options);
}

/**
 * Controlled fallback for unregistered types (spec §12): never rendered as
 * arbitrary HTML, and the original node data stays untouched. Export
 * validation refuses to export such a page, so the placeholder is a preview
 * state rather than something that ships.
 */
function unknownComponentElement(type: string): StaticElement {
  return {
    tag: "div",
    className: "frame-placeholder",
    attrs: { "data-frame-unknown": type },
    text: `Unknown component "${type}" — kept as-is so no data is lost.`,
  };
}
