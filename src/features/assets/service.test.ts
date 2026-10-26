import { describe, expect, it } from "vitest";
import {
  AssetValidationError,
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_MAX_ASSET_BYTES,
  assetSrcFor,
  resolveNodeAssetSrc,
  storageKeyFromSrc,
  storeImageAsset,
  validateImageFile,
} from "@/features/assets/service";
import type { AssetRepository, StoredAsset } from "@/features/assets/types";
import type { FrameNode } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";

function memoryAssets(): AssetRepository & { stored: Map<string, StoredAsset> } {
  const stored = new Map<string, StoredAsset>();
  return {
    stored,
    putAsset: (asset) => {
      stored.set(asset.storageKey, asset);
      return Promise.resolve();
    },
    getAssetBlob: (storageKey) => Promise.resolve(stored.get(storageKey)?.blob ?? null),
    deleteAsset: (storageKey) => {
      stored.delete(storageKey);
      return Promise.resolve();
    },
  };
}

function imageFile(name: string, type: string, size = 128): File {
  return new File([new Uint8Array(size)], name, { type });
}

function imageNode(): FrameNode {
  return getComponent("image")!.createDefaultNode();
}

describe("image upload validation (spec §19)", () => {
  it("accepts supported images and rejects unsupported or empty files", () => {
    expect(() => validateImageFile(imageFile("a.png", "image/png"))).not.toThrow();
    for (const type of ALLOWED_IMAGE_MIME_TYPES) {
      expect(() => validateImageFile(imageFile("a.bin", type))).not.toThrow();
    }
    expect(() => validateImageFile(imageFile("a.svg", "image/svg+xml"))).toThrow(
      AssetValidationError,
    );
    expect(() => validateImageFile(imageFile("a.txt", "text/plain"))).toThrow(
      /Unsupported image type/,
    );
    expect(() => validateImageFile(imageFile("empty.png", "image/png", 0))).toThrow(/empty/);
  });

  it("enforces the configurable size limit", () => {
    const file = imageFile("big.png", "image/png", 2048);
    expect(() => validateImageFile(file, { maxBytes: 1024 })).toThrow(/too large/);
    expect(DEFAULT_MAX_ASSET_BYTES).toBeGreaterThan(0);
    expect(() => validateImageFile(file, { maxBytes: 4096 })).not.toThrow();
  });

  it("stores bytes and returns a stable asset record", async () => {
    const repository = memoryAssets();
    const asset = await storeImageAsset(repository, imageFile("photo.png", "image/png"));

    expect(asset.name).toBe("photo.png");
    expect(asset.mimeType).toBe("image/png");
    expect(asset.storageKey).toMatch(/^asset-/);
    expect(repository.stored.has(asset.storageKey)).toBe(true);
    expect((await repository.getAssetBlob(asset.storageKey))?.size).toBe(128);

    // Rejections never write a blob.
    await expect(storeImageAsset(repository, imageFile("a.txt", "text/plain"))).rejects.toThrow(
      AssetValidationError,
    );
    expect(repository.stored.size).toBe(1);
  });
});

describe("asset references (spec §19)", () => {
  it("round-trips storage keys through the document reference", () => {
    const key = "asset-abc";
    expect(assetSrcFor(key)).toBe("asset:asset-abc");
    expect(storageKeyFromSrc(assetSrcFor(key))).toBe(key);
    expect(storageKeyFromSrc("https://example.com/a.png")).toBeNull();
    expect(storageKeyFromSrc("asset:")).toBeNull();
    expect(storageKeyFromSrc(undefined)).toBeNull();
  });

  it("resolves a stored reference to its object URL without mutating the node", () => {
    const node = imageNode();
    const src = assetSrcFor("asset-1");
    const withAsset = { ...node, props: { ...node.props, src } };

    const resolved = resolveNodeAssetSrc(withAsset, { "asset-1": "blob:frame/1" });
    expect(resolved.props.src).toBe("blob:frame/1");
    expect(withAsset.props.src).toBe(src); // stored document untouched

    // Missing assets stay unresolved so the renderer shows its fallback.
    expect(resolveNodeAssetSrc(withAsset, {})).toBe(withAsset);
    // External URLs pass through untouched.
    const external = { ...node, props: { ...node.props, src: "https://example.com/a.png" } };
    expect(resolveNodeAssetSrc(external, { "asset-1": "blob:frame/1" })).toBe(external);
  });
});
