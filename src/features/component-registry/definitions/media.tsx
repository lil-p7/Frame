import { Image } from "lucide-react";
import type { CSSProperties } from "react";
import { z } from "zod";
import { field } from "@/features/component-registry/inspector";
import { defineComponent } from "@/features/component-registry/define";
import { stylesToCss } from "@/features/component-registry/styles";
import { stringProp } from "@/features/component-registry/props";
import type { StaticElement } from "@/features/component-registry/types";
import { ASSET_SRC_PREFIX, storageKeyFromSrc } from "@/features/assets/service";

/**
 * URL safety (spec §32): only relative paths, http(s), data images, and
 * stored assets are accepted as image sources — never `javascript:` or other
 * active schemes.
 */
export function isSafeImageSource(value: string): boolean {
  if (value.trim() === "") return true; // empty = "no source set" yet
  if (value.startsWith(ASSET_SRC_PREFIX)) return true; // uploaded asset reference
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
  icon: Image,
  acceptsChildren: false,
  propSchema: z.object({
    src: z.string().max(2048).refine(isSafeImageSource, "Unsupported image source"),
    alt: z.string().max(300),
  }),
  defaultProps: { src: "", alt: "" },
  defaultStyles: () => ({ width: "100%", height: 240, borderRadius: 8 }),
  controls: [
    field.propAsset("src", "Image"),
    field.propText("alt", "Alt text"),
    field.styleUnit("width", "Width"),
    field.styleUnit("height", "Height"),
    field.styleUnit("borderRadius", "Corner radius"),
  ],
  renderEditor: (node) => {
    const src = stringProp(node.props, "src", "");
    const alt = stringProp(node.props, "alt", "");
    const css = stylesToCss(node.styles);

    if (storageKeyFromSrc(src) !== null) {
      // The canvas hands renderers resolved object URLs for assets that
      // exist, so an unresolved `asset:` reference means the asset is gone:
      // show a recoverable state and keep the stored data untouched (§19).
      return (
        <div
          role="img"
          aria-label={alt || "Missing image asset"}
          style={missingAssetStyle(css)}
          data-component="image"
          data-testid="image-missing"
        >
          Linked image asset is missing
        </div>
      );
    }

    if (src.trim() === "" || (!isSafeImageSource(src) && !src.startsWith("blob:"))) {
      // Graceful missing-asset state — data is preserved, nothing fakes an image.
      // `blob:` URLs are render-time object URLs produced by the editor for
      // stored assets; they are never accepted by the prop schema (§19).
      return (
        <div
          role="img"
          aria-label={alt || "Image with no source set"}
          style={missingAssetStyle(css)}
          data-component="image"
          data-testid="image-placeholder"
        >
          Image — no source set
        </div>
      );
    }
    return <img src={src} alt={alt} style={css} data-component="image" data-testid="image-node" />;
  },
  /**
   * Delivered markup keeps the same two recoverable states as the canvas
   * (spec §19, §28): by the time a static renderer runs, every *available*
   * asset reference has been rewritten to a real URL by the consumer, so a
   * surviving `asset:` reference means the bytes are gone.
   */
  renderStatic: (node) => {
    const src = stringProp(node.props, "src", "");
    const alt = stringProp(node.props, "alt", "");
    if (storageKeyFromSrc(src) !== null) return missingImageElement(alt);
    if (src.trim() === "" || !isSafeImageSource(src)) return placeholderImageElement(alt);
    return { tag: "img", attrs: { src, alt }, voidElement: true };
  },
});

/** Missing stored asset (the reference is kept in the document). */
function missingImageElement(alt: string): StaticElement {
  return {
    tag: "div",
    className: "frame-placeholder",
    attrs: { "data-frame-placeholder": "image", "aria-label": alt || "Missing image asset" },
    text: "Linked image asset is missing",
  };
}

/** No source set yet — the same neutral placeholder the editor shows. */
function placeholderImageElement(alt: string): StaticElement {
  return {
    tag: "div",
    className: "frame-placeholder",
    attrs: { "data-frame-placeholder": "image", "aria-label": alt || "Image with no source set" },
    text: "Image — no source set",
  };
}

/** Shared visual treatment for the two controlled missing-image states. */
function missingAssetStyle(css: ReturnType<typeof stylesToCss>): CSSProperties {
  return {
    ...css,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f5",
    color: "#71717a",
    fontSize: 12,
    border: "1px dashed #a1a1aa",
  };
}
