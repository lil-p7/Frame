import { Box, Grid3x3, List, MoveVertical, RectangleHorizontal } from "lucide-react";
import { createElement } from "react";
import { z } from "zod";
import {
  ALIGN_ITEMS_OPTIONS,
  DISPLAY_OPTIONS,
  FLEX_DIRECTION_OPTIONS,
  FLEX_WRAP_OPTIONS,
  JUSTIFY_CONTENT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  field,
} from "@/features/component-registry/inspector";
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
  icon: RectangleHorizontal,
  acceptsChildren: true,
  propSchema: z.object({ tag: z.enum(SECTION_TAGS) }),
  defaultProps: { tag: "section" },
  defaultStyles: () => ({ padding: 24, minHeight: 96 }),
  controls: [
    field.propSelect(
      "tag",
      "Semantic type",
      SECTION_TAGS.map((tag) => ({
        value: tag,
        label: tag.charAt(0).toUpperCase() + tag.slice(1),
      })),
    ),
    field.styleUnit("padding", "Padding"),
    field.styleUnit("width", "Width"),
    field.styleUnit("minHeight", "Min height"),
    field.styleSelect("textAlign", "Text alignment", TEXT_ALIGN_OPTIONS),
    field.styleColor("backgroundColor", "Background"),
  ],
  renderEditor: (node, children) => {
    const tag = enumProp(node.props, "tag", SECTION_TAGS, "section");
    return createElement(
      tag,
      { style: stylesToCss(node.styles), "data-component": "section" },
      children,
    );
  },
  renderStatic: (node) => ({ tag: enumProp(node.props, "tag", SECTION_TAGS, "section") }),
});

/** Container: groups content with a configurable max width (spec §9B). */
export const containerComponent = defineComponent({
  type: "container",
  label: "Container",
  category: "layout",
  description: "Centers and bounds content with a maximum width.",
  icon: Box,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    maxWidth: 1080,
    marginLeft: "auto",
    marginRight: "auto",
    padding: 16,
  }),
  controls: [
    field.styleUnit("width", "Width"),
    field.styleUnit("maxWidth", "Max width"),
    field.styleUnit("padding", "Padding"),
    field.styleUnit("gap", "Gap"),
    field.styleSelect("alignItems", "Align children", ALIGN_ITEMS_OPTIONS),
    field.styleSelect("justifyContent", "Justify", JUSTIFY_CONTENT_OPTIONS),
    field.styleColor("backgroundColor", "Background"),
  ],
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="container">
      {children}
    </div>
  ),
  renderStatic: () => ({ tag: "div" }),
});

/** Stack: flex row/column arrangement (spec §9B). Direction lives in styles. */
export const stackComponent = defineComponent({
  type: "stack",
  label: "Stack",
  category: "layout",
  description: "Arranges children in a row or column with gap and alignment.",
  icon: List,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({ display: "flex", flexDirection: "column", gap: 16 }),
  controls: [
    field.styleSelect("flexDirection", "Direction", FLEX_DIRECTION_OPTIONS),
    field.styleSelect("alignItems", "Align children", ALIGN_ITEMS_OPTIONS),
    field.styleSelect("justifyContent", "Justify", JUSTIFY_CONTENT_OPTIONS),
    field.styleSelect("flexWrap", "Wrapping", FLEX_WRAP_OPTIONS),
    field.styleUnit("gap", "Gap"),
    field.styleUnit("padding", "Padding"),
    field.styleSelect("display", "Display mode", DISPLAY_OPTIONS),
  ],
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="stack">
      {children}
    </div>
  ),
  renderStatic: () => ({ tag: "div" }),
});

/** Grid: fixed-column grid layout (spec §9B). Columns live in styles. */
export const gridComponent = defineComponent({
  type: "grid",
  label: "Grid",
  category: "layout",
  description: "Arranges children in columns and rows.",
  icon: Grid3x3,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  }),
  // One column on phones: grids respond predictably (spec §16).
  defaultResponsiveStyles: () => ({
    mobile: { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" },
  }),
  controls: [
    field.styleColumns("gridTemplateColumns", "Columns"),
    field.styleUnit("gap", "Gap"),
    field.styleUnit("padding", "Padding"),
    field.styleColor("backgroundColor", "Background"),
  ],
  renderEditor: (node, children) => (
    <div style={stylesToCss(node.styles)} data-component="grid">
      {children}
    </div>
  ),
  renderStatic: () => ({ tag: "div" }),
});

/** Spacer: intentional spacing between siblings (spec §9B). */
export const spacerComponent = defineComponent({
  type: "spacer",
  label: "Spacer",
  category: "layout",
  description: "Adds intentional empty space between siblings.",
  icon: MoveVertical,
  acceptsChildren: false,
  propSchema: z.object({}),
  defaultStyles: () => ({ height: 24 }),
  controls: [field.styleUnit("height", "Height"), field.styleUnit("width", "Width")],
  renderEditor: (node) => (
    <div
      aria-hidden="true"
      style={stylesToCss(node.styles)}
      data-component="spacer"
      data-testid="spacer-node"
    />
  ),
  // Spacing only: hidden from assistive technology in delivered markup too.
  renderStatic: () => ({ tag: "div", attrs: { "aria-hidden": "true" } }),
});
