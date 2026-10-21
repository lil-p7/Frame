import { z } from "zod";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { booleanProp, stringProp } from "@/features/component-registry/props";

/**
 * Safe link destinations (spec §32): relative/# links, http(s), mailto, tel.
 * `javascript:` and other active schemes are rejected by the schema.
 */
export function isSafeHref(value: string): boolean {
  if (value.trim() === "") return false;
  if (!value.includes(":")) return true; // relative path, "#anchor", "/page"
  return /^(https?|mailto|tel):/i.test(value.trim());
}

const hrefSchema = z.string().max(2048).refine(isSafeHref, "Unsupported link destination");

/** Button: editable label + destination (spec §9B). */
export const buttonComponent = defineComponent({
  type: "button",
  label: "Button",
  category: "interactive",
  description: "Call-to-action button with an editable label and destination.",
  acceptsChildren: false,
  propSchema: z.object({ label: z.string().max(120), href: hrefSchema }),
  defaultProps: { label: "Button", href: "#" },
  defaultStyles: () => ({
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    borderWidth: 0,
    borderStyle: "solid",
    fontSize: 14,
    fontWeight: 600,
  }),
  renderEditor: (node) => (
    // Never navigates while editing: canvas clicks select, they don't follow.
    // `cursor` is defined renderer behavior, not a stored style (spec §17).
    <button
      type="button"
      style={{ cursor: "pointer", ...stylesToCss(node.styles) }}
      data-component="button"
      data-testid="button-node"
      onClick={(event) => event.preventDefault()}
    >
      {stringProp(node.props, "label", "Button")}
    </button>
  ),
});

/** Link: editable label + destination with optional new-tab behavior (spec §9B). */
export const linkComponent = defineComponent({
  type: "link",
  label: "Link",
  category: "interactive",
  description: "Inline link with an editable label and destination.",
  acceptsChildren: false,
  propSchema: z.object({
    label: z.string().max(120),
    href: hrefSchema,
    newTab: z.boolean(),
  }),
  defaultProps: { label: "Link", href: "#", newTab: false },
  defaultStyles: () => ({ color: "#2563eb", textDecoration: "underline", fontSize: 14 }),
  renderEditor: (node) => {
    const newTab = booleanProp(node.props, "newTab", false);
    return (
      <a
        href={stringProp(node.props, "href", "#")}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        style={stylesToCss(node.styles)}
        data-component="link"
        data-testid="link-node"
        // Editing never navigates; preview/export (Phase 10) enable real links.
        onClick={(event) => event.preventDefault()}
      >
        {stringProp(node.props, "label", "Link")}
      </a>
    );
  },
});
