import { Heading, Pilcrow, Type } from "lucide-react";
import { createElement } from "react";
import { z } from "zod";
import {
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  TEXT_DECORATION_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
  field,
} from "@/features/component-registry/inspector";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { numberProp, stringProp } from "@/features/component-registry/props";

/** Heading: H1–H6 with editable text (spec §9B). */
export const headingComponent = defineComponent({
  type: "heading",
  label: "Heading",
  category: "text",
  description: "Section heading from H1 to H6 with editable text.",
  icon: Heading,
  acceptsChildren: false,
  propSchema: z.object({
    level: z.number().int().min(1).max(6),
    text: z.string().max(500),
  }),
  defaultProps: { level: 2, text: "Heading" },
  defaultStyles: () => ({ margin: 0 }),
  controls: [
    field.propNumericSelect(
      "level",
      "Level",
      [1, 2, 3, 4, 5, 6].map((level) => ({
        value: String(level),
        label: `H${level}`,
      })),
    ),
    field.propText("text", "Text"),
    field.styleSelect("fontFamily", "Font family", FONT_FAMILY_OPTIONS),
    field.styleUnit("fontSize", "Font size"),
    field.styleNumericSelect("fontWeight", "Weight", FONT_WEIGHT_OPTIONS),
    field.styleNumber("lineHeight", "Line height"),
    field.styleNumber("letterSpacing", "Letter spacing"),
    field.styleSelect("textAlign", "Alignment", TEXT_ALIGN_OPTIONS),
    field.styleColor("color", "Text color"),
  ],
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
  icon: Pilcrow,
  acceptsChildren: false,
  propSchema: z.object({ text: z.string().max(2000) }),
  defaultProps: { text: "Paragraph text" },
  defaultStyles: () => ({ margin: 0 }),
  controls: [
    field.propTextarea("text", "Text"),
    field.styleSelect("fontFamily", "Font family", FONT_FAMILY_OPTIONS),
    field.styleUnit("fontSize", "Font size"),
    field.styleNumericSelect("fontWeight", "Weight", FONT_WEIGHT_OPTIONS),
    field.styleNumber("lineHeight", "Line height"),
    field.styleNumber("letterSpacing", "Letter spacing"),
    field.styleSelect("textAlign", "Alignment", TEXT_ALIGN_OPTIONS),
    field.styleColor("color", "Text color"),
  ],
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
  icon: Type,
  acceptsChildren: false,
  propSchema: z.object({ text: z.string().max(500) }),
  defaultProps: { text: "Text" },
  defaultStyles: () => ({}),
  controls: [
    field.propText("text", "Text"),
    field.styleUnit("fontSize", "Font size"),
    field.styleNumericSelect("fontWeight", "Weight", FONT_WEIGHT_OPTIONS),
    field.styleColor("color", "Text color"),
    field.styleSelect("textAlign", "Alignment", TEXT_ALIGN_OPTIONS),
    field.styleSelect("textTransform", "Transform", TEXT_TRANSFORM_OPTIONS),
    field.styleSelect("textDecoration", "Decoration", TEXT_DECORATION_OPTIONS),
  ],
  renderEditor: (node) => (
    <span style={stylesToCss(node.styles)} data-component="text">
      {stringProp(node.props, "text", "")}
    </span>
  ),
});
