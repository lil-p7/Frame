import type { ComponentDefinition } from "@/features/component-registry/types";
import { COMPONENT_CATEGORIES } from "@/features/component-registry/types";
import { ROOT_NODE_TYPE } from "@/features/document/model";
import {
  containerComponent,
  gridComponent,
  sectionComponent,
  spacerComponent,
  stackComponent,
} from "@/features/component-registry/definitions/layout";
import {
  headingComponent,
  paragraphComponent,
  textComponent,
} from "@/features/component-registry/definitions/text";
import { imageComponent } from "@/features/component-registry/definitions/media";
import {
  buttonComponent,
  linkComponent,
} from "@/features/component-registry/definitions/interactive";
import {
  dividerComponent,
  footerComponent,
  heroComponent,
  navbarComponent,
} from "@/features/component-registry/definitions/structure";

/**
 * The single component registry (spec §9B, §12). The library, insertion,
 * validation, canvas rendering, inspector, and export all resolve types
 * through this map — definitions are never hardcoded in the UI.
 */
export const COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  // Layout
  sectionComponent,
  containerComponent,
  stackComponent,
  gridComponent,
  spacerComponent,
  // Text
  headingComponent,
  paragraphComponent,
  textComponent,
  // Media
  imageComponent,
  // Interactive
  buttonComponent,
  linkComponent,
  // Structure
  dividerComponent,
  navbarComponent,
  heroComponent,
  footerComponent,
];

const DEFINITIONS_BY_TYPE: ReadonlyMap<string, ComponentDefinition> = (() => {
  const map = new Map<string, ComponentDefinition>();
  for (const definition of COMPONENT_DEFINITIONS) {
    if (map.has(definition.type)) {
      throw new Error(`Duplicate component type "${definition.type}" in registry`);
    }
    if (!COMPONENT_CATEGORIES.includes(definition.category)) {
      throw new Error(`Component "${definition.type}" has unknown category`);
    }
    map.set(definition.type, definition);
  }
  return map;
})();

/** Resolves a registered definition, or undefined for unknown types. */
export function getComponent(type: string): ComponentDefinition | undefined {
  return DEFINITIONS_BY_TYPE.get(type);
}

export function isRegisteredType(type: string): boolean {
  return DEFINITIONS_BY_TYPE.has(type);
}

/** All definitions, optionally filtered by library category (Phase 4). */
export function listComponents(category?: ComponentDefinition["category"]): ComponentDefinition[] {
  return COMPONENT_DEFINITIONS.filter((def) => category === undefined || def.category === category);
}

/**
 * Whether a parent of `parentType` (or the page root) accepts a child of
 * `childType`, per its definition (spec §9A insertion rules, §15 drop-target
 * validation). Shared by click insertion and drag-and-drop resolution.
 */
export function parentAllowsChild(parentType: string, childType: string): boolean {
  if (parentType === ROOT_NODE_TYPE) return true;
  const definition = getComponent(parentType);
  if (definition === undefined || !definition.acceptsChildren) return false;
  return definition.allowedChildTypes === null || definition.allowedChildTypes.includes(childType);
}
