import { z } from "zod";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { stringProp } from "@/features/component-registry/props";

/**
 * URL safety (spec §32): only relative paths, http(s), and data images are
 * accepted as image sources — never `javascript:` or other active schemes.
 */
function isSafeImageSource(value: string): boolean {
  if (value.trim() === "") return true; // empty = "no source set" yet
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("#")) return true;
  if (value.startsWith("data:image/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Image: configurable source and alt text with graceful missing state (spec §9B, §19). */
export const imageComponent = defineComponent({
  type: "image",
  label: "Image",
  category: "media",
  description: "Picture with alt text and configurable fit, size, and radius.",
  acceptsChildren: false,
  propSchema: z.object({
    src: z.string().max(2048).refine(isSafeImageSource, "Unsupported image source"),
    alt: z.string().max(300),
  }),
  defaultProps: { src: "", alt: "" },
  defaultStyles: () => ({ width: "100%", height: 240, borderRadius: 8 }),
  renderEditor: (node) => {
    const src = stringProp(node.props, "src", "");
    const alt = stringProp(node.props, "alt", "");
    const css = stylesToCss(node.styles);

    if (!isSafeImageSource(src) || src.trim() === "") {
      // Graceful missing-asset state — data is preserved, nothing fakes an image.
      return (
        <div
          role="img"
          aria-label={alt || "Image with no source set"}
          style={{
            ...css,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f4f4f5",
            color: "#71717a",
            fontSize: 12,
            border: "1px dashed #a1a1aa",
          }}
          data-component="image"
          data-testid="image-placeholder"
        >
          Image — no source set
        </div>
      );
    }
    return <img src={src} alt={alt} style={css} data-component="image" data-testid="image-node" />;
  },
});
