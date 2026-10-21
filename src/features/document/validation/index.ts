import {
  ROOT_NODE_TYPE,
  type FrameNode,
  type FramePage,
  type FrameProject,
} from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { isValidStyleRecord } from "@/features/component-registry/styles";

/**
 * Document validation (spec §12 "Component tree invariants").
 *
 * Structural truth for what a valid tree is: root present and structural,
 * every non-root type registered, props satisfying their schema, children
 * only under containers that accept them (and allowed child types), unique
 * IDs, and only supported, safe style values.
 *
 * The command layer runs this on every produced document, so an invalid
 * tree cannot enter the editor through editing operations. Loading stays
 * permissive on purpose: unknown types render as a controlled fallback and
 * keep their data (spec §12), while `parseFrameProject` still rejects
 * structurally corrupt stored documents.
 */

export interface ValidationIssue {
  /** Human-readable location, e.g. `pages[0] > Section > Heading`. */
  path: string;
  message: string;
}

export class DocumentValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      issues.length === 0
        ? "Document is invalid"
        : `Invalid document: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    );
    this.name = "DocumentValidationError";
    this.issues = issues;
  }
}

/** Validates one page's component tree; returns every issue found. */
export function validatePage(page: FramePage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  if (page.name.trim().length === 0) {
    issues.push({ path: "page", message: "Page name is required" });
  }
  if (page.slug.trim().length === 0) {
    issues.push({ path: "page", message: "Page slug is required" });
  }

  if (page.root.type !== ROOT_NODE_TYPE) {
    issues.push({
      path: "root",
      message: `Page root must be of type "${ROOT_NODE_TYPE}" (got "${page.root.type}")`,
    });
  }

  const visit = (node: FrameNode, path: string, isRoot: boolean): void => {
    const label = `${node.name || node.type}#${node.id}`;
    const nodePath = path === "" ? label : `${path} > ${label}`;

    if (seenIds.has(node.id)) {
      issues.push({ path: nodePath, message: `Duplicate ID "${node.id}"` });
    }
    seenIds.add(node.id);

    if (typeof node.editor.hidden !== "boolean" || typeof node.editor.locked !== "boolean") {
      issues.push({ path: nodePath, message: "Editor metadata must be booleans" });
    }

    if (!isValidStyleRecord(node.styles)) {
      issues.push({
        path: nodePath,
        message: "Styles contain an unsupported property or an unsafe value",
      });
    }

    if (isRoot) {
      // Structural root: children are its purpose; props stay empty.
      for (const child of node.children) visit(child, nodePath, false);
      return;
    }

    const definition = getComponent(node.type);
    if (definition === undefined) {
      issues.push({ path: nodePath, message: `Unknown component type "${node.type}"` });
      // Still descend so downstream issues are reported too.
      for (const child of node.children) visit(child, nodePath, false);
      return;
    }

    if (!definition.validateProps(node.props)) {
      issues.push({ path: nodePath, message: `Invalid props for "${node.type}"` });
    }

    if (node.children.length > 0 && !definition.acceptsChildren) {
      issues.push({
        path: nodePath,
        message: `Component "${node.type}" does not accept children`,
      });
    }

    if (definition.allowedChildTypes !== null) {
      for (const child of node.children) {
        if (!definition.allowedChildTypes.includes(child.type)) {
          issues.push({
            path: `${nodePath} > ${child.type}`,
            message: `"${node.type}" does not allow children of type "${child.type}"`,
          });
        }
      }
    }

    for (const child of node.children) visit(child, nodePath, false);
  };

  visit(page.root, "", true);
  return issues;
}

/** Validates every page of a project (page-scoped paths prefixed). */
export function validateProject(project: FrameProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  project.pages.forEach((page, index) => {
    for (const issue of validatePage(page)) {
      issues.push({ ...issue, path: `pages[${index}] ${issue.path}` });
    }
  });
  return issues;
}

/** Throws `DocumentValidationError` when a page has any issue. */
export function assertValidPage(page: FramePage): void {
  const issues = validatePage(page);
  if (issues.length > 0) throw new DocumentValidationError(issues);
}

/** Throws `DocumentValidationError` when any page has an issue. */
export function assertValidProject(project: FrameProject): void {
  const issues = validateProject(project);
  if (issues.length > 0) throw new DocumentValidationError(issues);
}
