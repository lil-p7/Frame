import { Minus, PanelBottom, PanelsTopLeft, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { z } from "zod";
import { ALIGN_ITEMS_OPTIONS, field } from "@/features/component-registry/inspector";
import type { FrameNode, StyleValue } from "@/features/document/model";
import { buildNode, defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import type { ComponentDefinition } from "@/features/component-registry/types";
import { stackComponent } from "@/features/component-registry/definitions/layout";
import {
  headingComponent,
  paragraphComponent,
  textComponent,
} from "@/features/component-registry/definitions/text";
import {
  buttonComponent,
  linkComponent,
} from "@/features/component-registry/definitions/interactive";

/** Divider: horizontal rule with structured border styling (spec §9B). */
export const dividerComponent = defineComponent({
  type: "divider",
  label: "Divider",
  category: "structure",
  description: "Horizontal separator line with configurable thickness and color.",
  icon: Minus,
  acceptsChildren: false,
  propSchema: z.object({}),
  defaultStyles: () => ({
    width: "100%",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#d4d4d8",
  }),
  controls: [
    field.styleUnit("width", "Width"),
    field.styleUnit("borderWidth", "Thickness"),
    field.styleColor("borderColor", "Color"),
    field.styleUnit("marginTop", "Top margin"),
    field.styleUnit("marginBottom", "Bottom margin"),
  ],
  renderEditor: (node) => {
    const css = stylesToCss(node.styles) as Record<string, string | number | undefined>;
    const { borderWidth, borderStyle, borderColor, ...rest } = css;
    // The divider draws only its top edge — the defined renderer behavior
    // for the structured border keys (spec §17).
    const style: CSSProperties = {
      ...rest,
      borderTopWidth: borderWidth ?? 1,
      borderTopStyle: asBorderStyle(borderStyle),
      borderTopColor: typeof borderColor === "string" ? borderColor : "#d4d4d8",
    };
    return <hr style={style} data-component="divider" data-testid="divider-node" />;
  },
});

const BORDER_STYLES = [
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
] as const;

/** Whitelist-narrows a stored border-style value to the CSS literal type. */
function asBorderStyle(value: string | number | undefined): CSSProperties["borderTopStyle"] {
  if (typeof value === "string" && (BORDER_STYLES as readonly string[]).includes(value)) {
    return value as (typeof BORDER_STYLES)[number];
  }
  return "solid";
}

/** Helper: fresh node of a definition with property/style/name overrides. */
function nodeOf(
  definition: ComponentDefinition,
  overrides: {
    props?: Record<string, unknown>;
    styles?: Record<string, StyleValue>;
    name?: string;
    children?: FrameNode[];
  } = {},
): FrameNode {
  const node = buildNode(definition);
  if (overrides.props) Object.assign(node.props, overrides.props);
  if (overrides.styles) Object.assign(node.styles, overrides.styles);
  if (overrides.name) node.name = overrides.name;
  if (overrides.children) node.children = overrides.children;
  return node;
}

/**
 * Navbar preset (spec §9B): a decomposable composition of supported
 * primitives — every child is an ordinary editable component, never an
 * opaque block.
 */
export const navbarComponent = defineComponent({
  type: "navbar",
  label: "Navbar",
  category: "structure",
  description: "Top navigation bar composed of an editable heading and links.",
  icon: PanelsTopLeft,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    backgroundColor: "#ffffff",
  }),
  controls: [
    field.styleSelect("alignItems", "Align items", ALIGN_ITEMS_OPTIONS),
    field.styleUnit("gap", "Gap"),
    field.styleUnit("padding", "Padding"),
    field.styleColor("backgroundColor", "Background"),
  ],
  defaultChildren: () => [
    nodeOf(headingComponent, {
      props: { level: 3, text: "Brand" },
      styles: { margin: 0, fontSize: 20 },
      name: "Brand",
    }),
    nodeOf(stackComponent, {
      styles: { display: "flex", flexDirection: "row", gap: 16, alignItems: "center" },
      name: "Nav links",
      children: [
        nodeOf(linkComponent, { props: { label: "Work", href: "#work" }, name: "Work" }),
        nodeOf(linkComponent, { props: { label: "About", href: "#about" }, name: "About" }),
      ],
    }),
  ],
  renderEditor: (node, children) => (
    <nav style={stylesToCss(node.styles)} data-component="navbar" data-testid="navbar-node">
      {children}
    </nav>
  ),
});

/** Hero preset: decomposable headline + copy + call to action (spec §9B). */
export const heroComponent = defineComponent({
  type: "hero",
  label: "Hero",
  category: "structure",
  description: "Introductory hero block composed of editable text and a button.",
  icon: Sparkles,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    padding: 64,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#ffffff",
  }),
  controls: [
    field.styleUnit("padding", "Padding"),
    field.styleUnit("minHeight", "Min height"),
    field.styleUnit("gap", "Gap"),
    field.styleColor("backgroundColor", "Background"),
    field.styleColor("color", "Text color"),
  ],
  defaultChildren: () => [
    nodeOf(headingComponent, {
      props: { level: 1, text: "Build something worth showing" },
      styles: { margin: 0, fontSize: 40 },
      name: "Hero heading",
    }),
    nodeOf(paragraphComponent, {
      props: { text: "Introduce what this page offers in one clear sentence." },
      name: "Hero copy",
    }),
    nodeOf(buttonComponent, { props: { label: "Get started", href: "#" }, name: "Hero action" }),
  ],
  renderEditor: (node, children) => (
    <section style={stylesToCss(node.styles)} data-component="hero" data-testid="hero-node">
      {children}
    </section>
  ),
});

/** Footer preset: decomposable footer with text and links (spec §9B). */
export const footerComponent = defineComponent({
  type: "footer",
  label: "Footer",
  category: "structure",
  description: "Page footer composed of editable text and links.",
  icon: PanelBottom,
  acceptsChildren: true,
  propSchema: z.object({}),
  defaultStyles: () => ({
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fafafa",
  }),
  controls: [
    field.styleUnit("padding", "Padding"),
    field.styleUnit("gap", "Gap"),
    field.styleSelect("alignItems", "Align items", ALIGN_ITEMS_OPTIONS),
    field.styleColor("backgroundColor", "Background"),
    field.styleColor("color", "Text color"),
  ],
  defaultChildren: () => [
    nodeOf(textComponent, { props: { text: "© 2026 Your name" }, name: "Copyright" }),
    nodeOf(stackComponent, {
      styles: { display: "flex", flexDirection: "row", gap: 16 },
      name: "Footer links",
      children: [
        nodeOf(linkComponent, { props: { label: "Privacy", href: "#privacy" }, name: "Privacy" }),
        nodeOf(linkComponent, { props: { label: "Contact", href: "#contact" }, name: "Contact" }),
      ],
    }),
  ],
  renderEditor: (node, children) => (
    <footer style={stylesToCss(node.styles)} data-component="footer" data-testid="footer-node">
      {children}
    </footer>
  ),
});
