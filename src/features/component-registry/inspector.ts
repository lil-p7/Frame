import type { StyleValue } from "@/features/document/model";

/**
 * Inspector control model (spec §11, §12 "the same registry … drives the
 * inspector configuration").
 *
 * Definitions declare the fields they support; the properties inspector
 * renders strictly from these declarations and never hardcodes a component
 * type. The section of a style field is derived from its key so a style key
 * always lands in the same section (spec §17 property groups).
 */

export type InspectorSection =
  "content" | "layout" | "typography" | "appearance" | "spacing" | "advanced";

/** Inspector field for a `props` value. */
export interface PropField {
  target: "prop";
  /** Key of `FrameNode.props`. */
  key: string;
  label: string;
  control: FieldControl;
}

/** Inspector field for one supported style key (spec §17). */
export interface StyleField {
  target: "style";
  /** Key of `FrameNode.styles` (must be in `SUPPORTED_STYLE_KEYS`). */
  key: string;
  label: string;
  control: FieldControl;
}

export type InspectorField = PropField | StyleField;

export interface SelectOption {
  value: string;
  label: string;
}

export type FieldControl =
  /** Single-line text; commits debounced, on Enter, and on blur. */
  | { type: "text" }
  /** Multi-line text (paragraphs), same commit behavior. */
  | { type: "textarea" }
  /** Text validated by the prop schema (safe URLs, src/alt lengths). */
  | { type: "url" }
  /** Image source: text input plus local upload/replace/remove actions. */
  | { type: "asset" }
  /** Destination: text input plus a picker for this project's pages (§20). */
  | { type: "link" }
  /** Plain number, optionally bounded (prop fields). */
  | { type: "number"; min?: number; max?: number; integer?: boolean; step?: number }
  /** Bounded 0–1 fraction rendered with quick presets. */
  | { type: "opacity" }
  /** Fixed option list; `numeric` writes numbers instead of strings. */
  | { type: "select"; options: readonly SelectOption[]; numeric?: boolean }
  /** Color: native picker + validated hex text (spec §11D). */
  | { type: "color" }
  /** Number with a unit (px / % / rem per spec §11E). */
  | { type: "unit"; units: readonly string[] }
  /** Grid column count → `repeat(n, minmax(0, 1fr))`. */
  | { type: "columns" };

/** Rendered section order (spec §11 initial sections). */
export const INSPECTOR_SECTIONS: readonly InspectorSection[] = [
  "content",
  "layout",
  "typography",
  "appearance",
  "spacing",
  "advanced",
];

const LAYOUT_STYLE_KEYS: ReadonlySet<string> = new Set([
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "flexWrap",
  "gap",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "gridTemplateColumns",
  "overflow",
]);

const TYPOGRAPHY_STYLE_KEYS: ReadonlySet<string> = new Set([
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "textTransform",
]);

const APPEARANCE_STYLE_KEYS: ReadonlySet<string> = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "borderRadius",
  "opacity",
  "boxShadow",
]);

/**
 * Section for one declared field. `color` intentionally lives in Appearance
 * (§11D: "text color where applicable") rather than duplicating it into
 * Typography.
 */
export function sectionForField(field: InspectorField): InspectorSection {
  if (field.target === "prop") return "content";
  if (LAYOUT_STYLE_KEYS.has(field.key)) return "layout";
  if (TYPOGRAPHY_STYLE_KEYS.has(field.key)) return "typography";
  if (APPEARANCE_STYLE_KEYS.has(field.key)) return "appearance";
  if (field.key.startsWith("padding") || field.key.startsWith("margin")) return "spacing";
  return "advanced";
}

/** True when the definition has any declared field in `section`. */
export function hasSection(fields: readonly InspectorField[], section: InspectorSection): boolean {
  return fields.some((field) => sectionForField(field) === section);
}

/** Returns the declared fields of a section, already filtered. */
export function fieldsForSection(
  fields: readonly InspectorField[],
  section: InspectorSection,
): InspectorField[] {
  return fields.filter((field) => sectionForField(field) === section);
}

// ---------------------------------------------------------------------------
// Shared option sets (§9B, §11: visual controls instead of raw CSS values)
// ---------------------------------------------------------------------------

export const FLEX_DIRECTION_OPTIONS = [
  { value: "row", label: "Row" },
  { value: "column", label: "Column" },
  { value: "row-reverse", label: "Row reversed" },
  { value: "column-reverse", label: "Column reversed" },
] as const satisfies readonly SelectOption[];

export const ALIGN_ITEMS_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
] as const satisfies readonly SelectOption[];

export const JUSTIFY_CONTENT_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Space between" },
  { value: "space-around", label: "Space around" },
  { value: "space-evenly", label: "Space evenly" },
] as const satisfies readonly SelectOption[];

export const FLEX_WRAP_OPTIONS = [
  { value: "nowrap", label: "No wrap" },
  { value: "wrap", label: "Wrap" },
  { value: "wrap-reverse", label: "Wrap reversed" },
] as const satisfies readonly SelectOption[];

export const DISPLAY_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
  { value: "grid", label: "Grid" },
] as const satisfies readonly SelectOption[];

export const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "auto", label: "Auto" },
  { value: "scroll", label: "Scroll" },
] as const satisfies readonly SelectOption[];

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justified" },
] as const satisfies readonly SelectOption[];

export const FONT_FAMILY_OPTIONS = [
  { value: "system-ui, sans-serif", label: "System UI" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "'Comic Sans MS', cursive", label: "Handwriting" },
  { value: "ui-monospace, 'Courier New', monospace", label: "Monospace" },
] as const satisfies readonly SelectOption[];

export const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra bold" },
] as const satisfies readonly SelectOption[];

export const TEXT_DECORATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "underline", label: "Underline" },
  { value: "line-through", label: "Strikethrough" },
] as const satisfies readonly SelectOption[];

export const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "capitalize", label: "Capitalize" },
] as const satisfies readonly SelectOption[];

export const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
  { value: "none", label: "None" },
] as const satisfies readonly SelectOption[];

/** Spacing/size units (spec §11E initial units). */
export const UNIT_OPTIONS = ["px", "%", "rem"] as const;

// ---------------------------------------------------------------------------
// Value parsing for editable style values
// ---------------------------------------------------------------------------

export interface UnitValue {
  amount: string;
  unit: string;
}

/**
 * Parses a stored style value into the unit editor's parts. Bare numbers are
 * px (React renders numeric px); unit strings keep their suffix.
 */
export function parseUnitValue(value: StyleValue | undefined): UnitValue {
  if (typeof value === "number") return { amount: String(value), unit: "px" };
  if (typeof value !== "string") return { amount: "", unit: "px" };
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(px|%|rem|em|vh|vw)?$/i);
  if (match === null) return { amount: value, unit: "px" };
  const unit = match[2]?.toLowerCase() ?? "px";
  return { amount: match[1] ?? "", unit: unit === "" ? "px" : unit };
}

/**
 * Serializes the unit editor's parts back into a style value: bare numbers
 * stay numbers for px/unitless so defaults and exports remain canonical.
 */
export function serializeUnitValue(value: UnitValue): StyleValue | null {
  const amount = value.amount.trim();
  if (amount === "") return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(amount)) return null;
  if (value.unit === "px") return Number(amount);
  return `${amount}${value.unit}`;
}

/** Well-formed hex color allowed into the document (§11D "never malformed"). */
export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

/** Safely proposes a picker-friendly value for `<input type="color">`. */
export function colorPickerValue(value: StyleValue | undefined): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (
    typeof value === "string" &&
    /^#[0-9a-f]{3}$/i.test(value) // e.g. #abc → #aabbcc
  ) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return "#000000";
}

/** Reads the column count out of a `repeat(n, …)` grid template. */
export function parseGridColumns(value: StyleValue | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^repeat\(\s*(\d+)\s*,/);
  return match === null ? null : Number(match[1]);
}

// ---------------------------------------------------------------------------
// Declaration helpers (keep the definition files terse)
// ---------------------------------------------------------------------------

function prop(key: string, label: string, control: FieldControl): PropField {
  return { target: "prop", key, label, control };
}

function style(key: string, label: string, control: FieldControl): StyleField {
  return { target: "style", key, label, control };
}

export const field = {
  /** Single-line prop text (heading/button/link labels). */
  propText: (key: string, label: string) => prop(key, label, { type: "text" }),
  /** Multi-line prop text (paragraphs). */
  propTextarea: (key: string, label: string) => prop(key, label, { type: "textarea" }),
  /** Schema-validated URL-ish prop text (image src, href). */
  propUrl: (key: string, label: string) => prop(key, label, { type: "url" }),
  /** Image source with upload/replace/remove actions (spec §19). */
  propAsset: (key: string, label: string) => prop(key, label, { type: "asset" }),
  /** Link destination with the project page picker (spec §20 navigation). */
  propLink: (key: string, label: string) => prop(key, label, { type: "link" }),
  /** Prop select (heading level, section tag). */
  propSelect: (key: string, label: string, options: readonly SelectOption[]) =>
    prop(key, label, { type: "select", options }),
  /** Prop select that writes numbers (heading level). */
  propNumericSelect: (key: string, label: string, options: readonly SelectOption[]) =>
    prop(key, label, { type: "select", options, numeric: true }),
  /** Style select (layout/flex/typography enums). */
  styleSelect: (key: string, label: string, options: readonly SelectOption[]) =>
    style(key, label, { type: "select", options }),
  /** Numeric style select (fontWeight). */
  styleNumericSelect: (key: string, label: string, options: readonly SelectOption[]) =>
    style(key, label, { type: "select", options, numeric: true }),
  /** Number-with-unit style (sizes, spacing, gap). */
  styleUnit: (key: string, label: string, units: readonly string[] = UNIT_OPTIONS) =>
    style(key, label, { type: "unit", units }),
  /** Unitless/plain number style (lineHeight, letterSpacing). */
  styleNumber: (key: string, label: string) => style(key, label, { type: "unit", units: [""] }),
  /** Color style via picker + hex text. */
  styleColor: (key: string, label: string) => style(key, label, { type: "color" }),
  /** Opacity style with 0–1 bounds. */
  styleOpacity: (key: string) => style(key, "Opacity", { type: "opacity" }),
  /** Grid columns control. */
  styleColumns: (key: string, label: string) => style(key, label, { type: "columns" }),
} as const;
