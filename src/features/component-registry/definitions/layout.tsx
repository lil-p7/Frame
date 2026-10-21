import { createElement } from "react";
import { z } from "zod";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { enumProp } from "@/features/component-registry/props";

const SECTION_TAGS = ["section", "header", "footer", "nav", "main", "aside"] as const;

/** Section: semantic container with configurable tag (spec §9B). */
export const sectionComponent = defineComponent({
  type: "section",
  label: "Section",
  category: "layout",
  description: "Semantic section container that groups page content.",
  acceptsChildren: true,
  propSchema: z.object({ tag: z.enum(SECTION_TAGS) }),
  defaultProps: { tag: "section" },
  defaultStyles: () => ({ padding: 24, minHeight: 96 }),
  renderEditor: (node, children) => {
    const tag = enumProp(node.props, "tag", SECTION_TAGS, "section");
    return createElement(
      tag,
      { style: stylesToCss(node.styles), "data-component": "section" },
      children,
    );
  },
});

/** Container: groups content with a configurable max width (spec §9B). */
export const containerComponent = defineComponent({
  type: "container",
  label: "Container",
  category: "layout",
  description: "Centers and bounds content with a maximum width.",
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    maxWidth: 1080,
    marginLeft: "auto",
    marginRight: "auto",
    padding: 16,
  }),
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="container">
      {children}
    </div>
  ),
});

/** Stack: flex row/column arrangement (spec §9B). Direction lives in styles. */
export const stackComponent = defineComponent({
  type: "stack",
  label: "Stack",
  category: "layout",
  description: "Arranges children in a row or column with gap and alignment.",
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({ display: "flex", flexDirection: "column", gap: 16 }),
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="stack">
      {children}
    </div>
  ),
});

/** Grid: fixed-column grid layout (spec §9B). Columns live in styles. */
export const gridComponent = defineComponent({
  type: "grid",
  label: "Grid",
  category: "layout",
  description: "Arranges children in columns and rows.",
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  }),
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="grid">
      {children}
    </div>
  ),
});

/** Spacer: intentional spacing between siblings (spec §9B). */
export const spacerComponent = defineComponent({
  type: "spacer",
  label: "Spacer",
  category: "layout",
  description: "Adds intentional empty space between siblings.",
  acceptsChildren: false,
  propSchema: z.object({}),
  defaultStyles: () => ({ height: 24 }),
  renderEditor: (node) => (
    <div
      aria-hidden="true"
      style={stylesToCss(node.styles)}
      data-component="spacer"
      data-testid="spacer-node"
    />
  ),
});
