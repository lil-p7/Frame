import type { FrameNode, FrameProject } from "@/features/document/model";
import { ROOT_NODE_TYPE } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { isSafeStyleValue } from "@/features/component-registry/styles";
import { validateProject } from "@/features/document/validation";
import { isBrokenPageHref } from "@/features/document/navigation";
import { walkVisibleNodes } from "@/features/document/traversal";
import { storageKeyFromSrc } from "@/features/assets/service";
import { isSafeHref } from "@/features/component-registry/definitions/interactive";
import { isSafeImageSource } from "@/features/component-registry/definitions/media";

/**
 * Export validation (spec §23 "Export validation", §32).
 *
 * Runs before anything is generated and reports what would prevent a
 * trustworthy export. Errors block the download; warnings are shown and
 * explained but do not block, because they describe states the document
 * renders deliberately (an image with no source yet, for example).
 *
 * The export never silently substitutes unrelated content, so an issue that
 * would change what the visitor sees is an error.
 */

export interface ExportReport {
  /** Blocking issues: the export cannot be generated. */
  errors: string[];
  /** Non-blocking issues the user should know about. */
  warnings: string[];
}

export function isExportable(report: ExportReport): boolean {
  return report.errors.length === 0;
}

/** One image reference found in the document, with its location. */
export interface AssetReference {
  storageKey: string;
  /** `Page "About" > Hero > Image` — used in issue messages. */
  location: string;
}

/** Raised when a package is requested for a project that cannot be exported. */
export class ExportBlockedError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(
      errors.length === 0
        ? "The project cannot be exported"
        : `The project cannot be exported: ${errors.join(" ")}`,
    );
    this.name = "ExportBlockedError";
    this.errors = errors;
  }
}

/**
 * Every asset reference the delivered site would contain. Hidden subtrees are
 * excluded: they are not rendered, so their images are neither required nor
 * exported (spec §9C).
 */
export function collectAssetReferences(project: FrameProject): AssetReference[] {
  const references: AssetReference[] = [];
  for (const page of project.pages) {
    walkVisibleNodes(page.root, (node) => {
      const key = storageKeyFromSrc(node.props.src);
      if (key !== null) {
        references.push({ storageKey: key, location: locate(page.name, page.root, node) });
      }
    });
  }
  return references;
}

/**
 * Validates a project for export.
 *
 * `availableAssetKeys` is the set of storage keys whose bytes could be read;
 * a referenced asset outside that set is a blocking error, because the
 * exported site would ship a broken image (spec §19, §23).
 */
export function validateForExport(
  project: FrameProject,
  availableAssetKeys: ReadonlySet<string>,
): ExportReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Structural truth first: unknown types, invalid props, unsafe styles, and
  // any other invariant the editor already enforces (spec §12).
  for (const issue of validateProject(project)) {
    errors.push(`${issue.path}: ${issue.message}`);
  }

  // Two pages sharing a slug would produce colliding routes and links.
  const slugs = new Map<string, string[]>();
  for (const page of project.pages) {
    slugs.set(page.slug, [...(slugs.get(page.slug) ?? []), page.name]);
  }
  for (const [slug, names] of slugs) {
    if (names.length > 1) {
      errors.push(`Pages ${names.map((name) => `"${name}"`).join(", ")} share the slug "${slug}".`);
    }
  }

  for (const page of project.pages) {
    if (!isSafeStyleValue(page.settings.backgroundColor)) {
      errors.push(`Page "${page.name}" has an unsafe background color.`);
    }
  }

  // Links and images are the destinations a visitor can actually reach.
  for (const page of project.pages) {
    walkVisibleNodes(page.root, (node) => {
      const definition = getComponent(node.type);
      if (definition === undefined) return; // already reported above
      const location = locate(page.name, page.root, node);
      validateLink(project, node, location, errors);
      validateImageSource(node, location, availableAssetKeys, errors, warnings);
    });
  }

  return { errors, warnings };
}

/** Link destinations must resolve for the exported site (spec §20, §23). */
function validateLink(
  project: FrameProject,
  node: FrameNode,
  location: string,
  errors: string[],
): void {
  if (typeof node.props.href !== "string") return;
  if (isBrokenPageHref(node.props.href, project.pages)) {
    errors.push(`${location}: the link targets a page that no longer exists.`);
    return;
  }
  if (!isSafeHref(node.props.href)) {
    errors.push(`${location}: the link destination is not a supported URL.`);
  }
}

/** Images must point at a packaged file, an external URL, or the placeholder. */
function validateImageSource(
  node: FrameNode,
  location: string,
  availableAssetKeys: ReadonlySet<string>,
  errors: string[],
  warnings: string[],
): void {
  if (typeof node.props.src !== "string") return;
  const src = node.props.src;
  const key = storageKeyFromSrc(src);

  if (key !== null) {
    if (!availableAssetKeys.has(key)) {
      // The record exists (or existed) but its bytes are gone: the exported
      // site would show the missing-image state (spec §19, §28).
      errors.push(`${location}: the image's stored file is missing — replace or remove it.`);
    }
    return;
  }
  if (src.trim() === "") {
    warnings.push(`${location}: no image source set — it exports the same placeholder the editor shows.`);
    return;
  }
  if (!isSafeImageSource(src)) {
    errors.push(`${location}: the image source is not a supported URL.`);
  }
}

/** `Page "About" > Hero > Image#id` — enough to find the component. */
function locate(pageName: string, root: FrameNode, target: FrameNode): string {
  const path: string[] = [];
  const walk = (node: FrameNode): boolean => {
    if (node.type !== ROOT_NODE_TYPE) path.push(`${node.name || node.type}#${node.id}`);
    if (node.id === target.id) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  walk(root);
  return `Page "${pageName}"${path.length === 0 ? "" : ` > ${path.join(" > ")}`}`;
}
