import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import type { FrameNode, ResponsiveStyles, StyleValue } from "@/features/document/model";
import type { InspectorField } from "@/features/component-registry/inspector";

/** Library grouping (spec §9B): Layout, Text, Media, Interactive, Structure. */
export type ComponentCategory = "layout" | "text" | "media" | "interactive" | "structure";

export const COMPONENT_CATEGORIES: readonly ComponentCategory[] = [
  "layout",
  "text",
  "media",
  "interactive",
  "structure",
] as const;

/**
 * Structured static element (spec §12 `renderExport`).
 *
 * The React-free description of a component's own element: preview renders it
 * to React nodes and the exporter serializes it to JSX source, so both
 * consume exactly one interpretation of the component (spec §22, §23).
 * Styling is never part of this description — consumers apply the node's
 * generated class from the shared page stylesheet.
 */
export interface StaticElement {
  /** HTML tag name (`section`, `h1`, `a`, `img`, ...). */
  tag: string;
  /** Extra classes beyond the node's generated class (e.g. `frame-button`). */
  className?: string;
  /** Attributes with already-resolved values (href, src, alt, aria-*, ...). */
  attrs?: Record<string, string>;
  /** Leaf text content; null when the element wraps children instead. */
  text?: string | null;
  /** Self-closing element (`img`, `hr`): rendered with no children. */
  voidElement?: boolean;
}

/**
 * What a static renderer needs to turn stored data into deliverable markup.
 * `mapHref` resolves a stored destination into a real href for the consumer
 * (preview route or exported site); null means "not a link" (spec §20).
 */
export interface StaticRenderContext {
  mapHref: (href: string) => string | null;
}

/**
 * Central component definition (spec §12).
 *
 * One definition drives validation, insertion (Phase 4), canvas rendering,
 * inspector configuration (Phase 5), preview, and export (Phase 10).
 * Definitions are pure data + render functions; they never mutate nodes.
 */
export interface ComponentDefinition {
  /** Stable component type stored in `FrameNode.type`. */
  type: string;
  label: string;
  category: ComponentCategory;
  /** Short human description for tooltips in the library. */
  description: string;
  /** Library icon (spec §9B: every registered component declares an icon). */
  icon: LucideIcon;

  acceptsChildren: boolean;
  /**
   * Restricts which child types may appear under this component.
   * `null` = any registered type is allowed (when `acceptsChildren`).
   */
  allowedChildTypes: readonly string[] | null;

  /** Runtime schema for `FrameNode.props` of this type. */
  propSchema: z.ZodType;
  /** Fresh default props for a new node (never shared between nodes). */
  createDefaultProps: () => Record<string, unknown>;
  /** Fresh default styles for a new node (base/desktop record). */
  createDefaultStyles: () => Record<string, StyleValue>;
  /** Fresh default breakpoint overrides for a new node (spec §16). */
  createDefaultResponsiveStyles: () => ResponsiveStyles;
  /** Fresh default children (used by composite presets like Navbar). */
  createDefaultChildren: () => FrameNode[];

  validateProps: (props: unknown) => boolean;
  /** Builds a complete, valid node with a fresh unique ID. */
  createDefaultNode: () => FrameNode;

  /**
   * Editor-mode rendering of this component's own element.
   * `children` are the recursively rendered child views in stored order.
   * Editor overlays are added by the canvas, never by definitions.
   */
  renderEditor: (node: FrameNode, children: ReactNode) => ReactNode;

  /**
   * Preview/export rendering of this component's own element (spec §12
   * "Separate: editor rendering, preview rendering, export rendering").
   * Children are rendered by the tree builder in stored order, so this
   * describes only the component's element and its own attributes.
   */
  renderStatic: (node: FrameNode, context: StaticRenderContext) => StaticElement;

  /** Editor metadata (spec §9B): which actions this component allows. */
  canDuplicate: boolean;
  canDelete: boolean;
  canLock: boolean;

  /**
   * Inspector controls this component exposes (spec §11, §12: the registry
   * drives inspector configuration). The inspector renders sections only
   * from these declarations.
   */
  controls: readonly InspectorField[];
}
