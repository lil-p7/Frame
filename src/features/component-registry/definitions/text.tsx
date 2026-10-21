import { createElement } from "react";
import { z } from "zod";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { numberProp, stringProp } from "@/features/component-registry/props";

/** Heading: H1–H6 with editable text (spec §9B). */
export const headingComponent = defineComponent({
  type: "heading",
  label: "Heading",
  category: "text",
  description: "Section heading from H1 to H6 with editable text.",
  acceptsChildren: false,
  propSchema: z.object({
    level: z.number().int().min(1).max(6),
    text: z.string().max(500),
  }),
  defaultProps: { level: 2, text: "Heading" },
  defaultStyles: () => ({ margin: 0 }),
  renderEditor: (node) => {
    const level = numberProp(node.props, "level", 2);
    const text = stringProp(node.props, "text", "");
    const tag = `h${Math.min(6, Math.max(1, Math.round(level)))}`;
    return createElement(
      tag,
      { style: stylesToCss(node.styles), "data-component": "heading" },
      text,
    );
  },
});

/** Paragraph: editable running text (spec §9B). */
export const paragraphComponent = defineComponent({
  type: "paragraph",
  label: "Paragraph",
  category: "text",
  description: "Editable paragraph of running text.",
  acceptsChildren: false,
  propSchema: z.object({ text: z.string().max(2000) }),
  defaultProps: { text: "Paragraph text" },
  defaultStyles: () => ({ margin: 0 }),
  renderEditor: (node) => (
    <p style={stylesToCss(node.styles)} data-component="paragraph">
      {stringProp(node.props, "text", "")}
    </p>
  ),
});

/** Text: general inline text element (spec §9B). */
export const textComponent = defineComponent({
  type: "text",
  label: "Text",
  category: "text",
  description: "General-purpose inline text element.",
  acceptsChildren: false,
  propSchema: z.object({ text: z.string().max(500) }),
  defaultProps: { text: "Text" },
  defaultStyles: () => ({}),
  renderEditor: (node) => (
    <span style={stylesToCss(node.styles)} data-component="text">
      {stringProp(node.props, "text", "")}
    </span>
  ),
});
