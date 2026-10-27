import type { FrameAsset, FrameNode, FramePage, FrameProject } from "@/features/document/model";
import { slugify } from "@/features/document/model";
import {
  buildStaticPage,
  type StaticTreeOptions,
} from "@/features/component-registry/staticTree";
import { resolveHref } from "@/features/document/navigation";
import {
  COMPONENT_BASE_CSS,
  PAGE_CLASS,
  SITE_RESET_CSS,
  pageStylesheet,
} from "@/features/document/stylesheet";
import { storageKeyFromSrc } from "@/features/assets/service";
import { jsxElement } from "@/features/export/generators/jsx";

/**
 * Standalone website generation (spec §23).
 *
 * Produces a self-contained React + Vite project from the document: page
 * components serialized from the shared static tree, one stylesheet built
 * from the structured styles (including breakpoint media queries), and the
 * uploaded images copied next to it. Nothing here imports Frame, and the
 * output contains no editor chrome.
 *
 * Generation is deterministic: the same document produces byte-identical
 * files (spec §17), which is why no timestamps or random names appear
 * anywhere in the output.
 */

/** A generated text file, path relative to the package root. */
export interface ExportTextFile {
  path: string;
  contents: string;
}

export interface GeneratedSite {
  /** Top-level folder of the package (also used for the download name). */
  rootFolder: string;
  files: ExportTextFile[];
}

/** Versions mirror the stack Frame itself is built and tested with. */
const DEPENDENCIES = { react: "^19.0.0", "react-dom": "^19.0.0" } as const;
const DEV_DEPENDENCIES = {
  "@types/react": "^19.1.2",
  "@types/react-dom": "^19.1.2",
  "@vitejs/plugin-react": "^4.4.1",
  typescript: "~5.8.3",
  vite: "^6.3.5",
} as const;

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Package folder name for a project, e.g. `portfolio-site`. */
export function siteFolder(project: FrameProject): string {
  return `${slugify(project.name)}-site`;
}

/**
 * Where a stored asset lands in the package. Names come from the asset's own
 * stable storage key, so repeated exports never rename a file (spec §17, §19).
 *
 * Files live under `public/`, which Vite copies to the site root as-is, so an
 * exported image is part of the built site without a build step knowing
 * about it.
 */
export function assetExportPath(asset: FrameAsset): string {
  const safeKey = asset.storageKey.replace(/[^A-Za-z0-9_-]/g, "-");
  const extension = IMAGE_EXTENSIONS[asset.mimeType];
  const relative = extension === undefined ? `assets/${safeKey}` : `assets/${safeKey}.${extension}`;
  return `public/${relative}`;
}

/**
 * The URL a page references a packaged asset by: the package path minus the
 * `public/` web root, kept relative on purpose so the built site resolves it
 * from any folder, subpath, or the filesystem (spec §19 "stable relative
 * paths").
 */
export function assetExportUrl(packagePath: string): string {
  return `./${packagePath.replace(/^public\//, "")}`;
}

/** Storage key → packaged relative path, for every asset of the project. */
export function assetPathsByStorageKey(project: FrameProject): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const asset of project.assets) {
    paths[asset.storageKey] = assetExportPath(asset);
  }
  return paths;
}

/**
 * Generated component name for a page (`home` → `HomePage`).
 *
 * Slugs come from stored (untrusted) data, so the result is always a valid
 * JavaScript identifier: a leading digit is prefixed, and an empty slug falls
 * back to `Page`.
 */
export function componentNameForPage(page: FramePage): string {
  const pascal = page.slug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (pascal === "") return "Page";
  // `404Page` is not an identifier; the prefix replaces the suffix in that case.
  return /^[0-9]/.test(pascal) ? `Page${pascal}` : `${pascal}Page`;
}

/**
 * Untrusted display text for generated comments and markdown: collapses lines
 * and neutralizes comment terminators so no name can end a doc block and emit
 * code (spec §23 "Security", §32).
 */
function displayName(value: string): string {
  return value.replace(/\*\//g, "* /").replace(/\s+/g, " ").trim();
}

/**
 * A stored destination as the exported site understands it: another page
 * becomes a hash route, anchors and external URLs stay as configured, and an
 * unsatisfiable destination becomes no link at all (spec §20).
 */
function exportHrefFor(project: FrameProject, href: string): string | null {
  const resolution = resolveHref(href, project.pages);
  switch (resolution.kind) {
    case "empty":
      return null;
    case "page":
      // A link to a page that no longer exists has no route to point at;
      // export validation reports it as a blocking issue (spec §20).
      return resolution.pageId === null ? null : `#/${resolution.slug}`;
    case "anchor":
      return `#${resolution.anchor}`;
    case "external":
      return resolution.href;
  }
}

/**
 * Stored node data as the exported site needs it: asset references become
 * relative URLs to the packaged file. A reference whose bytes are not part of
 * the package is emptied so the component renders its documented placeholder
 * instead of a broken image URL (export validation blocks that case before
 * generation).
 */
function rewriteAssetSrc(node: FrameNode, assetPaths: Record<string, string>): FrameNode {
  const key = storageKeyFromSrc(node.props.src);
  if (key === null) return node;
  const path = assetPaths[key];
  return { ...node, props: { ...node.props, src: path === undefined ? "" : assetExportUrl(path) } };
}

/** Static-tree options used by the exporter for a project. */
function exportTreeOptions(project: FrameProject): StaticTreeOptions {
  const assetPaths = assetPathsByStorageKey(project);
  return {
    transformNode: (node) => rewriteAssetSrc(node, assetPaths),
    mapHref: (href) => exportHrefFor(project, href),
  };
}

/** Generates every text file of the exported package. */
export function generateSite(project: FrameProject): GeneratedSite {
  const options = exportTreeOptions(project);
  // Component names are unique even for slugs that pascal-case identically.
  const usedNames = new Set<string>();
  const pageEntries = project.pages.map((page) => {
    const base = componentNameForPage(page);
    let componentName = base;
    let counter = 2;
    while (usedNames.has(componentName)) {
      componentName = `${base}${counter}`;
      counter += 1;
    }
    usedNames.add(componentName);
    return { page, componentName, fileName: `src/pages/${componentName}.tsx` };
  });

  const files: ExportTextFile[] = [
    { path: "package.json", contents: packageJson(project) },
    { path: "vite.config.ts", contents: VITE_CONFIG },
    { path: "tsconfig.json", contents: TSCONFIG },
    { path: "index.html", contents: indexHtml(project) },
    { path: "src/main.tsx", contents: MAIN_TSX },
    { path: "src/App.tsx", contents: appTsx(project, pageEntries) },
    { path: "src/styles/site.css", contents: siteCss(project) },
    { path: "README.md", contents: readme(project) },
  ];

  for (const entry of pageEntries) {
    files.push({
      path: entry.fileName,
      contents: pageComponent(entry.page, entry.componentName, options),
    });
  }

  return { rootFolder: siteFolder(project), files };
}

function packageJson(project: FrameProject): string {
  return `${JSON.stringify(
    {
      name: slugify(project.name),
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        typecheck: "tsc --noEmit",
      },
      dependencies: DEPENDENCIES,
      devDependencies: DEV_DEPENDENCIES,
    },
    null,
    2,
  )}\n`;
}

function indexHtml(project: FrameProject): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(project.name)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

/** Minimal HTML escaping for the title (the only document text in HTML). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteCss(project: FrameProject): string {
  const pageSheets = project.pages
    .map((page) => `/* Page: ${displayName(page.name)} */\n${pageStylesheet(page, "responsive")}`)
    .join("\n\n");
  return `${SITE_RESET_CSS}\n${COMPONENT_BASE_CSS}\n${pageSheets}\n`;
}

function pageComponent(
  page: FramePage,
  componentName: string,
  options: StaticTreeOptions,
): string {
  const tree = buildStaticPage(page, options);
  const body =
    tree.length === 0
      ? `      {/* This page has no components yet. */}`
      : tree.map((node) => jsxElement(node, 3)).join("\n");

  return `/**
 * ${displayName(page.name)} — generated by Frame from the page of the same name.
 * Edit the page in Frame and export again: re-exporting replaces this file.
 */
export default function ${componentName}() {
  return (
    <div className="${PAGE_CLASS}">
${body}
    </div>
  );
}
`;
}

function appTsx(
  project: FrameProject,
  pages: ReadonlyArray<{ page: FramePage; componentName: string; fileName: string }>,
): string {
  const imports = pages
    .map((entry) => `import ${entry.componentName} from "./pages/${entry.componentName}";`)
    .join("\n");

  const registry = pages
    .map(
      (entry) =>
        `  { slug: ${JSON.stringify(entry.page.slug)}, title: ${JSON.stringify(
          entry.page.settings.title || entry.page.name,
        )}, Page: ${entry.componentName} },`,
    )
    .join("\n");

  return `import { useEffect, useState, type ReactElement } from "react";
${imports}

interface SitePage {
  slug: string;
  title: string;
  Page: () => ReactElement;
}

/** Pages in the order they appear in Frame; the first one is the entry point. */
const PAGES: SitePage[] = [
${registry}
];

/**
 * \`#/<slug>\` selects a page. Section anchors such as \`#contact\` are left to
 * the browser so they keep working on the current page.
 */
function pageSlugFromHash(hash: string): string | null {
  if (!hash.startsWith("#/")) return null;
  const slug = hash.slice(2).replace(/\\/+$/, "");
  return slug === "" ? null : decodeURIComponent(slug);
}

/** ${displayName(project.name)} — generated by Frame. */
export function App() {
  const [slug, setSlug] = useState(() => pageSlugFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setSlug(pageSlugFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const active = PAGES.find((page) => page.slug === slug) ?? PAGES[0];

  useEffect(() => {
    if (active !== undefined) document.title = active.title;
  }, [active]);

  if (active === undefined) return null;
  const Page = active.Page;
  return <Page />;
}
`;
}

function readme(project: FrameProject): string {
  const pages = project.pages
    .map((page) => `- \`${displayName(page.slug)}\` — ${displayName(page.name)}`)
    .join("\n");
  return `# ${displayName(project.name)}

A standalone website exported from **Frame**. It is an independent React + Vite
project: Frame does not need to be installed, running, or connected for this
site to work.

## Run it

\`\`\`bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run typecheck  # TypeScript check
\`\`\`

## Pages

${pages}

Pages are addressed by hash route: \`index.html#/home\`, \`index.html#/about\`.
Links between pages use the same routes, so they work from any static host and
when the built \`dist/index.html\` is opened directly from disk. Section anchor
links such as \`#contact\` are left to the browser.

## Structure

\`\`\`
index.html
vite.config.ts
tsconfig.json
src/
  main.tsx          # mounts the site
  App.tsx           # page registry and hash routing
  pages/            # one component per Frame page
  styles/site.css   # reset, component base behavior, and page styles
public/assets/      # images uploaded in Frame
\`\`\`

Styles are generated from Frame's structured style model. Every component
carries a stable class (\`.fr-…\`); responsive overrides appear as media queries
for the 640px and 1024px breakpoints, matching the editor and preview.

## Editing

Editing these files by hand is possible, but the next export from Frame
replaces them. Make design changes in Frame and export again.

## Known limitations

- Text formatting is limited to the text Frame stores (single runs, line
  breaks); there is no rich-text markup in this export.
- Images are packaged from Frame's local asset storage; images referenced by
  an external URL are used as-is and must stay online.
- Hidden components are not exported, and locked components export exactly
  like unlocked ones.
`;
}

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * \`base: "./"\` keeps every asset URL relative, so the built site works from a
 * subfolder, a static host, or the filesystem. Bundles are written to
 * \`bundles/\` so Vite's own output never mixes with the exported images in
 * \`assets/\`.
 */
export default defineConfig({
  base: "./",
  build: { assetsDir: "bundles" },
  plugins: [react()],
});
`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noUncheckedIndexedAccess: true,
      noFallthroughCasesInSwitch: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["vite/client"],
    },
    include: ["src"],
  },
  null,
  2,
)}\n`;

const MAIN_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/site.css";

const container = document.getElementById("root");
if (container === null) throw new Error("The exported site is missing its #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
