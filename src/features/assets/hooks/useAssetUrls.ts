import { useEffect, useRef, useState } from "react";
import type { FrameAsset } from "@/features/document/model";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * Object-URL lifecycle for a project's image assets (spec §19: "safe object
 * URL lifecycle management").
 *
 * URLs are created lazily from stored blobs, cached per storage key so a save
 * re-render never revokes a URL an `<img>` is using, pruned when an asset
 * leaves the project, and revoked when the editor unmounts. Missing blobs
 * simply stay out of the map so renderers show their recoverable state.
 */
export function useAssetUrls(
  repository: ProjectRepository,
  assets: readonly FrameAsset[],
): Record<string, string> {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const assetsKey = assets.map((asset) => asset.storageKey).join("|");

  useEffect(() => {
    let cancelled = false;
    const present = new Set(assets.map((asset) => asset.storageKey));

    void (async () => {
      const next = new Map(cacheRef.current);
      for (const asset of assets) {
        if (next.has(asset.storageKey)) continue;
        try {
          const blob = await repository.getAssetBlob(asset.storageKey);
          if (blob !== null) {
            next.set(asset.storageKey, URL.createObjectURL(blob));
          }
        } catch {
          // Load failure degrades to the missing-asset state, never a crash.
        }
      }
      // Prune keys that left the project so their URLs are released.
      for (const key of [...next.keys()]) {
        if (!present.has(key)) {
          URL.revokeObjectURL(next.get(key)!);
          next.delete(key);
        }
      }
      if (cancelled) return;
      cacheRef.current = next;
      setUrls(Object.fromEntries(next));
    })();

    return () => {
      cancelled = true;
    };
    // `assetsKey` keeps identity stable across saves that don't change keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived key
  }, [assetsKey, repository]);

  // Release every object URL when the editor unmounts.
  useEffect(
    () => () => {
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current = new Map();
    },
    [],
  );

  return urls;
}
