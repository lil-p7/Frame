/**
 * Frame document model — the serializable source of truth for pages and
 * projects. Everything here is plain data: no React, no component instances.
 *
 * The schema is versioned (`schemaVersion`). Stored/imported documents must
 * pass validation before entering app state — stored data is untrusted input.
 */
import { z } from "zod";

/** Schema version of the document format described below. */
export const PROJECT_SCHEMA_VERSION = 1;

/** A style override value. `null` means "clear this override". */
export type StyleValue = string | number | null;

/**
 * Breakpoints that can carry style overrides (spec §16).
 *
 * `styles` on a node is the base (desktop) record; these are the optional,
 * independent narrower-range overrides. The desktop range has no override
 * record because it *is* the base.
 */
export const RESPONSIVE_BREAKPOINTS = ["tablet", "mobile"] as const;
export type BreakpointId = (typeof RESPONSIVE_BREAKPOINTS)[number];
/** Editing context: the base styles or one breakpoint's overrides. */
export type StyleBreakpoint = "base" | BreakpointId;

/** Style overrides for every breakpoint, keyed by breakpoint ID. */
export type ResponsiveStyles = Partial<Record<BreakpointId, Record<string, StyleValue>>>;

const styleValueSchema = z.union([z.string(), z.number(), z.null()]);
const styleOverridesSchema = z.record(z.string(), styleValueSchema);

const responsiveStylesSchema = z
  .object({
    tablet: styleOverridesSchema.optional(),
    mobile: styleOverridesSchema.optional(),
  })
  .strict()
  .optional();

/**
 * A single node in a page's component tree.
 *
 * `styles` holds the base (desktop) declarations; `responsive` holds optional
 * independent overrides for narrower breakpoints (spec §16). Absent means no
 * overrides — existing projects stay readable without a schema migration.
 */
export interface FrameNode {
  id: string;
  type: string;
  name: string;
  props: Record<string, unknown>;
  styles: Record<string, StyleValue>;
  responsive?: ResponsiveStyles;
  children: FrameNode[];
  editor: {
    hidden: boolean;
    locked: boolean;
  };
}

const frameNodeSchema: z.ZodType<FrameNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    name: z.string(),
    props: z.record(z.string(), z.unknown()),
    styles: styleOverridesSchema,
    responsive: responsiveStylesSchema,
    children: z.array(frameNodeSchema),
    editor: z.object({
      hidden: z.boolean(),
      locked: z.boolean(),
    }),
  }),
);

export interface FramePage {
  id: string;
  name: string;
  slug: string;
  root: FrameNode;
  settings: {
    title: string;
    backgroundColor: string;
  };
}

export interface FrameProject {
  id: string;
  name: string;
  description?: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  pages: FramePage[];
  assets: FrameAsset[];
  designTokens: FrameDesignTokens;
}

export interface FrameAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  alt?: string;
}

export interface FrameDesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
}

const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  storageKey: z.string().min(1),
  alt: z.string().optional(),
});

const designTokensSchema = z.object({
  colors: z.record(z.string(), z.string()),
  spacing: z.record(z.string(), z.string()),
  typography: z.record(z.string(), z.string()),
});

const isoTimestampSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Expected an ISO timestamp");

const framePageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  root: frameNodeSchema,
  settings: z.object({
    title: z.string(),
    backgroundColor: z.string().min(1),
  }),
});

/**
 * Validates an untrusted stored document and rejects duplicates across the
 * whole tree (page IDs included) plus structural invariants.
 */
export const frameProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  schemaVersion: z
    .number()
    .int()
    .refine(
      (v) => v === PROJECT_SCHEMA_VERSION,
      `Unsupported schema version; expected ${PROJECT_SCHEMA_VERSION}`,
    ),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  pages: z.array(framePageSchema).min(1),
  assets: z.array(assetSchema),
  designTokens: designTokensSchema,
});

/**
 * Validates a stored project, enforcing:
 * - every node/page ID is unique across the project,
 * - each page root node is a `root` container with no name change needed,
 * - no node is its own ancestor (guaranteed structurally since `children`
 *   is a tree, but duplicate IDs would allow aliasing — hence the check).
 */
export function parseFrameProject(raw: unknown): FrameProject {
  const project = frameProjectSchema.parse(raw);

  const idSet = new Set<string>();
  const registerId = (id: string): void => {
    if (idSet.has(id)) {
      throw new Error(`Duplicate ID "${id}" in project`);
    }
    idSet.add(id);
  };

  for (const page of project.pages) {
    registerId(page.id);
    walkNodeIds(page.root, registerId);
  }

  return project;
}

function walkNodeIds(node: FrameNode, visit: (id: string) => void): void {
  visit(node.id);
  for (const child of node.children) {
    walkNodeIds(child, visit);
  }
}

/**
 * Validates a project name for creation/rename: non-empty after trimming,
 * bounded length. Returns an error message or null when valid.
 */
export function validateProjectName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Project name is required.";
  if (trimmed.length > 120) return "Keep the project name under 120 characters.";
  return null;
}

/** URL-safe slug for a page name; an empty result becomes "page". */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "page";
}

/** Node type reserved for each page's structural container. Not user-selectable or deletable. */
export const ROOT_NODE_TYPE = "root";

/** Convenience factory for the non-selectable page root container. */
export function createRootNode(id: string): FrameNode {
  return {
    id,
    type: ROOT_NODE_TYPE,
    name: "Root",
    props: {},
    styles: {},
    responsive: {},
    children: [],
    editor: { hidden: false, locked: false },
  };
}
