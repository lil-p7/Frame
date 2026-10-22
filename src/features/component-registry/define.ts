import type { FrameNode, StyleValue } from "@/features/document/model";
import { createId } from "@/lib/ids";
import type { InspectorField } from "@/features/component-registry/inspector";
import type { ComponentDefinition } from "@/features/component-registry/types";

/**
 * Registration helper: assembles a `ComponentDefinition` from declarative
 * parts, guaranteeing every generated node has a fresh unique ID, cloned
 * default props (never shared between nodes), and editor metadata.
 */
export interface ComponentSpec {
  type: string;
  label: string;
  category: ComponentDefinition["category"];
  description: string;
  /** Library icon shown in the Components tab and layer tree (Phase 4). */
  icon: ComponentDefinition["icon"];
  acceptsChildren: boolean;
  allowedChildTypes?: readonly string[] | null;
  propSchema: ComponentDefinition["propSchema"];
  defaultProps?: Record<string, unknown>;
  defaultStyles?: () => Record<string, StyleValue>;
  /** Defaults for composite presets (Navbar/Hero/Footer). */
  defaultChildren?: () => FrameNode[];
  renderEditor: ComponentDefinition["renderEditor"];
  /** Inspector field declarations; rendered section-by-section by the inspector. */
  controls?: readonly InspectorField[];
  canDuplicate?: boolean;
  canDelete?: boolean;
  canLock?: boolean;
}

export function defineComponent(spec: ComponentSpec): ComponentDefinition {
  const allowedChildTypes = spec.acceptsChildren ? (spec.allowedChildTypes ?? null) : null;

  const definition: ComponentDefinition = {
    type: spec.type,
    label: spec.label,
    category: spec.category,
    description: spec.description,
    icon: spec.icon,
    acceptsChildren: spec.acceptsChildren,
    allowedChildTypes,
    propSchema: spec.propSchema,
    createDefaultProps: () => structuredClone(spec.defaultProps ?? {}),
    createDefaultStyles: () => (spec.defaultStyles ? spec.defaultStyles() : {}),
    createDefaultChildren: () =>
      spec.acceptsChildren && spec.defaultChildren ? spec.defaultChildren() : [],
    validateProps: (props) => spec.propSchema.safeParse(props).success,
    // Closure over `definition` is only invoked after initialization.
    createDefaultNode: () => buildNode(definition),
    renderEditor: spec.renderEditor,
    controls: spec.controls ?? [],
    canDuplicate: spec.canDuplicate ?? true,
    canDelete: spec.canDelete ?? true,
    canLock: spec.canLock ?? true,
  };

  return definition;
}

/** Builds a complete node from a definition (used by presets and creation). */
export function buildNode(definition: ComponentDefinition): FrameNode {
  return {
    id: createId(),
    type: definition.type,
    name: definition.label,
    props: definition.createDefaultProps(),
    styles: definition.createDefaultStyles(),
    children: definition.createDefaultChildren(),
    editor: { hidden: false, locked: false },
  };
}
