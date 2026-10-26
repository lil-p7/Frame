import type { FrameAsset, FrameNode } from "@/features/document/model";
import type { AssetRepository } from "@/features/assets/types";
import { createId } from "@/lib/ids";

/**
 * Local image upload workflow (spec §19): validate type and size, store the
 * bytes in the asset store, and produce a stable asset record. The document
 * references the asset by `asset:<storageKey>` — never by object URL — so
 * references survive reloads and export can package the real file (§19).
 */

/** Formats Frame accepts as uploads (§19 "a defined set of image formats"). */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

/**
 * SVG is deliberately excluded: it is an XML document that can carry
 * scripts, and spec §32 forbids content that could execute code (§19).
 */
export const DEFAULT_MAX_ASSET_BYTES = 5 * 1024 * 1024;

/** Prefix used in document props to reference a stored asset. */
export const ASSET_SRC_PREFIX = "asset:";

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetValidationError";
  }
}

export interface ImageFile {
  name: string;
  type: string;
  size: number;
}

export interface UploadOptions {
  allowedTypes?: readonly string[];
  maxBytes?: number;
}

/** Throws `AssetValidationError` with a user-facing message when invalid. */
export function validateImageFile(file: ImageFile, options: UploadOptions = {}): void {
  const allowedTypes = options.allowedTypes ?? ALLOWED_IMAGE_MIME_TYPES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ASSET_BYTES;

  if (file.size <= 0) {
    throw new AssetValidationError("That file is empty — choose an image to upload.");
  }
  if (!allowedTypes.includes(file.type)) {
    const pretty = allowedTypes.map((type) => type.replace("image/", "").toUpperCase()).join(", ");
    throw new AssetValidationError(
      `Unsupported image type ${file.type || "unknown"} — use ${pretty}.`,
    );
  }
  if (file.size > maxBytes) {
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
    throw new AssetValidationError(`That image is too large — keep it under ${limitMb} MB.`);
  }
}

/** The document reference for a stored asset. */
export function assetSrcFor(storageKey: string): string {
  return `${ASSET_SRC_PREFIX}${storageKey}`;
}

/** The storage key a document reference points at, or null if not one. */
export function storageKeyFromSrc(src: unknown): string | null {
  if (typeof src !== "string" || !src.startsWith(ASSET_SRC_PREFIX)) return null;
  const key = src.slice(ASSET_SRC_PREFIX.length);
  return key.length > 0 ? key : null;
}

/**
 * A render-time view of `node` whose `src` is swapped for the stored asset's
 * object URL. Nodes without an asset reference — or whose asset is missing —
 * are returned untouched so the renderer can show its recoverable state.
 */
export function resolveNodeAssetSrc(
  node: FrameNode,
  assetUrls: Readonly<Record<string, string>>,
): FrameNode {
  const key = storageKeyFromSrc(node.props.src);
  if (key === null) return node;
  const url = assetUrls[key];
  if (url === undefined) return node; // missing asset → renderer fallback
  return { ...node, props: { ...node.props, src: url } };
}

/**
 * Validates and stores an image file, returning its asset record.
 * Throws `AssetValidationError` (bad file) or `PersistenceError` (storage).
 */
export async function storeImageAsset(
  repository: AssetRepository,
  file: File,
  options: UploadOptions = {},
): Promise<FrameAsset> {
  validateImageFile(file, options);

  const storageKey = `asset-${createId()}`;
  const blob = file.slice(0, file.size, file.type);
  await repository.putAsset({ storageKey, mimeType: file.type, blob });

  return {
    id: createId(),
    name: file.name || "image",
    mimeType: file.type,
    size: file.size,
    storageKey,
  };
}
