import { zipSync } from "fflate";
import type { FrameProject } from "@/features/document/model";
import type { ProjectRepository } from "@/features/projects/types";
import { assetPathsByStorageKey, generateSite } from "@/features/export/generators/site";
import {
  ExportBlockedError,
  collectAssetReferences,
  isExportable,
  validateForExport,
  type ExportReport,
} from "@/features/export/validation";

/**
 * Export service (spec §23, §31).
 *
 * Validation and packaging share one asset walk, so the files that ship are
 * exactly the ones that were checked: referenced images are read from local
 * storage, copied into the package, and referenced by relative path. A
 * project that cannot be exported reliably is refused instead of being
 * exported with silent substitutions.
 */

export interface ExportPackage {
  blob: Blob;
  fileName: string;
  /** Files in the archive, excluding the packaged images. */
  fileCount: number;
  assetCount: number;
}

/** Reads which of the project's referenced assets are actually available. */
export async function availableAssetKeys(
  project: FrameProject,
  repository: ProjectRepository,
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const reference of collectAssetReferences(project)) {
    if (keys.has(reference.storageKey)) continue;
    try {
      const blob = await repository.getAssetBlob(reference.storageKey);
      if (blob !== null) keys.add(reference.storageKey);
    } catch {
      // A read failure is a missing asset for export purposes: reported as a
      // blocking issue rather than crashing the dialog.
    }
  }
  return keys;
}

/** Validation report for the export dialog. */
export async function reportForExport(
  project: FrameProject,
  repository: ProjectRepository,
): Promise<ExportReport> {
  const available = await availableAssetKeys(project, repository);
  return validateForExport(project, available);
}

/**
 * Builds the downloadable package: generated site files plus the uploaded
 * images, zipped under the project's own folder name.
 *
 * Throws `ExportBlockedError` when validation still finds blocking issues
 * (the caller validates first; this is the enforcement point).
 */
export async function buildExportPackage(
  project: FrameProject,
  repository: ProjectRepository,
): Promise<ExportPackage> {
  const site = generateSite(project);
  const available = await availableAssetKeys(project, repository);
  const report = validateForExport(project, available);
  if (!isExportable(report)) throw new ExportBlockedError(report.errors);

  const encoder = new TextEncoder();
  const archive: Record<string, Uint8Array> = {};
  const root = site.rootFolder;

  for (const file of site.files) {
    archive[`${root}/${file.path}`] = encoder.encode(file.contents);
  }

  let assetCount = 0;
  // Only assets the delivered pages reference are packaged; unreferenced
  // records stay in Frame and nothing is written twice.
  const assetPaths = assetPathsByStorageKey(project);
  for (const reference of collectAssetReferences(project)) {
    const path = assetPaths[reference.storageKey];
    // No record for the reference: validation already reported it as missing.
    if (path === undefined) continue;
    const entry = `${root}/${path}`;
    if (archive[entry] !== undefined) continue;
    const blob = await repository.getAssetBlob(reference.storageKey);
    if (blob === null) continue;
    archive[entry] = await readBlobBytes(blob);
    assetCount += 1;
  }

  const zipped = zipSync(archive);
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    fileName: `${root}.zip`,
    fileCount: site.files.length,
    assetCount,
  };
}

/**
 * Reads a blob's bytes.
 *
 * `Blob.arrayBuffer` is the direct path where it exists; the `FileReader`
 * fallback covers environments that only implement the older API. Blobs that
 * arrive from storage are not always instances of the current realm's `Blob`
 * (IndexedDB deserialization, test DOMs), which is why the check is on the
 * method rather than on the constructor.
 */
export function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error("The stored file could not be read."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("The stored file could not be read."));
    reader.readAsArrayBuffer(blob);
  });
}

/** Downloads a generated package. Kept separate so tests can inject a spy. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL once the browser has taken the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
