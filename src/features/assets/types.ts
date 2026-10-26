/**
 * Local asset storage (spec §19): image bytes live in an IndexedDB asset
 * store keyed by a stable `storageKey`; the document only ever references
 * that key (`asset:<storageKey>`), never a temporary object URL (§19 export
 * rules).
 */
export interface StoredAsset {
  storageKey: string;
  mimeType: string;
  blob: Blob;
}

export interface AssetRepository {
  putAsset(asset: StoredAsset): Promise<void>;
  getAssetBlob(storageKey: string): Promise<Blob | null>;
  deleteAsset(storageKey: string): Promise<void>;
}
