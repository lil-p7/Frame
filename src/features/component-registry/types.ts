import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import type { FrameNode, StyleValue } from "@/features/document/model";
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
 * Central component definition (spec §12).
 *
 * One definition drives validation, insertion (Phase 4), canvas rendering,
 * inspector configuration (Phase 5), and export (Phase 10). Definitions are
 * pure data + render functions; they never mutate nodes.
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
  /** Fresh default styles for a new node. */
  createDefaultStyles: () => Record<string, StyleValue>;
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
