import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  type FrameAsset,
  type FrameNode,
  type FramePage,
  type FrameProject,
} from "@/features/document/model";
import { COMPONENT_DEFINITIONS, getComponent } from "@/features/component-registry/registry";
import {
  assetExportPath,
  assetExportUrl,
  componentNameForPage,
  generateSite,
  siteFolder,
} from "@/features/export/generators/site";

function node(
  type: string,
  overrides: { id: string; props?: Record<string, unknown>; children?: FrameNode[] } = {
    id: `n-${type}`,
  },
): FrameNode {
  const base = getComponent(type)!.createDefaultNode();
  return {
    ...base,
    id: overrides.id,
    props: { ...base.props, ...(overrides.props ?? {}) },
    children: overrides.children ?? [],
  };
}

function page(name: string, slug: string, children: FrameNode[]): FramePage {
  return {
    id: `page-${slug}`,
    name,
    slug,
    root: { ...createRootNode(`root-${slug}`), children },
    settings: { title: `${name} title`, backgroundColor: "#0b1220" },
  };
}

function project(
  pages: FramePage[],
  assets: FrameAsset[] = [],
  name = "Portfolio Website",
): FrameProject {
  return {
    id: "project-1",
    name,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pages,
    assets,
    designTokens: { colors: {}, spacing: {}, typography: {} },
  };
}

function fileContents(contents: ReadonlyArray<{ path: string; contents: string }>, path: string): string {
  const file = contents.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`expected generated file ${path}`);
  return file.contents;
}

const imageAsset: FrameAsset = {
  id: "record-1",
  name: "photo.png",
  mimeType: "image/png",
  size: 4,
  storageKey: "asset-abc",
};

describe("site package layout (spec §23)", () => {
  it("generates the documented package structure and one component per page", () => {
    const site = generateSite(
      project([
        page("Home", "home", [node("hero", { id: "n-hero" })], ),
        page("About", "about", [node("heading", { id: "n-heading", props: { text: "About" } })]),
      ]),
    );

    expect(site.rootFolder).toBe("portfolio-website-site");
    expect(site.files.map((file) => file.path)).toEqual([
      "package.json",
      "vite.config.ts",
      "tsconfig.json",
      "index.html",
      "src/main.tsx",
      "src/App.tsx",
      "src/styles/site.css",
      "README.md",
      "src/pages/HomePage.tsx",
      "src/pages/AboutPage.tsx",
    ]);
  });

  it("names the package after the project and scripts that work standalone", () => {
    const manifest = JSON.parse(
      fileContents(generateSite(project([page("Home", "home", [])])).files, "package.json"),
    ) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(manifest.name).toBe("portfolio-website");
    expect(manifest.scripts.build).toBe("vite build");
    expect(manifest.dependencies.react).toBeDefined();
    expect(manifest.devDependencies.vite).toBeDefined();
  });

  it("registers every page in the app shell with hash routes", () => {
    const app = fileContents(
      generateSite(
        project([
          page("Home", "home", []),
          page("My Work", "my-work", []),
        ]),
      ).files,
      "src/App.tsx",
    );
    expect(app).toContain('import HomePage from "./pages/HomePage";');
    expect(app).toContain('import MyWorkPage from "./pages/MyWorkPage";');
    expect(app).toContain('{ slug: "home", title: "Home title", Page: HomePage },');
    expect(app).toContain('{ slug: "my-work", title: "My Work title", Page: MyWorkPage },');
  });

  it("is deterministic: repeated exports are byte-identical", () => {
    const build = () =>
      generateSite(
        project([
          page("Home", "home", [node("section", { id: "n-section" })]),
          page("About", "about", []),
        ]),
      );
    expect(build()).toEqual(build());
  });
});

describe("delivered markup (spec §22, §23)", () => {
  it("emits document text only as escaped string literals", () => {
    const nasty = 'Quotes " and <script>alert(1)</script> & more';
    const home = fileContents(
      generateSite(
        project([page("Home", "home", [node("heading", { id: "n-h", props: { text: nasty } })])]),
      ).files,
      "src/pages/HomePage.tsx",
    );
    expect(home).toContain(`<h2 className={"fr-n-h"}>{${JSON.stringify(nasty)}}</h2>`);
    // The page wrapper carries the documented page class and nothing else.
    expect(home).toContain('<div className="frame-page">');
  });

  it("rewrites a stored asset reference to its packaged relative path", () => {
    const home = fileContents(
      generateSite(
        project(
          [
            page("Home", "home", [
              node("image", { id: "n-image", props: { src: "asset:asset-abc", alt: "A photo" } }),
            ]),
          ],
          [imageAsset],
        ),
      ).files,
      "src/pages/HomePage.tsx",
    );
    expect(home).toContain('<img className={"fr-n-image"} src={"./assets/asset-abc.png"} alt={"A photo"} />');
    // Package path keeps the file under `public/` (Vite's web root); the page
    // URL is relative to the built site instead.
    expect(assetExportPath(imageAsset)).toBe("public/assets/asset-abc.png");
    expect(assetExportUrl("public/assets/asset-abc.png")).toBe("./assets/asset-abc.png");
  });

  it("maps links to hash routes, anchors, and external URLs", () => {
    const home = fileContents(
      generateSite(
        project([
          page("Home", "home", [
            node("button", { id: "n-internal", props: { label: "About", href: "page:about" } }),
            node("link", { id: "n-anchor", props: { label: "Work", href: "#work" } }),
            node("link", { id: "n-external", props: { label: "Mail", href: "https://example.com" } }),
          ]),
          page("About", "about", []),
        ]),
      ).files,
      "src/pages/HomePage.tsx",
    );
    expect(home).toContain('href={"#/about"}>{"About"}</a>');
    expect(home).toContain('href={"#work"}>{"Work"}</a>');
    expect(home).toContain('href={"https://example.com"}>{"Mail"}</a>');
  });

  it("carries no editor-only markup or classes", () => {
    const site = generateSite(
      project([page("Home", "home", [node("hero", { id: "n-hero" }), node("divider", { id: "n-div" })])]),
    );
    const all = site.files.map((file) => file.contents).join("\n");
    for (const leak of ["data-component", "data-selected", "data-testid", "canvas-node", "frame-accent", "dangerouslySetInnerHTML"]) {
      expect(all).not.toContain(leak);
    }
  });

  it("builds a stylesheet with the page rules and their breakpoint media queries", () => {
    const css = fileContents(
      generateSite(
        project([page("Home", "home", [node("grid", { id: "n-grid" }), node("divider", { id: "n-div" })])]),
      ).files,
      "src/styles/site.css",
    );
    expect(css).toContain(".frame-page {");
    expect(css).toContain("background-color: #0b1220;");
    expect(css).toContain(".fr-n-grid {");
    expect(css).toContain("@media (max-width: 639.98px)");
    expect(css).toContain(".frame-divider {");
  });

  it("exports every registered component type without a fallback placeholder", () => {
    const everyType = COMPONENT_DEFINITIONS.map((definition) => node(definition.type));
    const site = generateSite(project([page("Home", "home", everyType)]));
    const home = fileContents(site.files, "src/pages/HomePage.tsx");

    for (const tag of ["<section", "<div", "<h2", "<p", "<span", "<nav", "<footer", "<hr", "<a"]) {
      expect(home).toContain(tag);
    }
    expect(home).toContain('className={"fr-n-spacer"} aria-hidden={"true"}');
    // Defaults that need a destination or a source render their documented state.
    expect(home).toContain("frame-button");
    expect(home).toContain("frame-placeholder");
    expect(home).not.toContain("data-frame-unknown");
  });

  it("documents the exported site in its README", () => {
    const readme = fileContents(
      generateSite(project([page("Home", "home", []), page("About", "about", [])])).files,
      "README.md",
    );
    expect(readme).toContain("# Portfolio Website");
    expect(readme).toContain("npm install");
    expect(readme).toContain("- `about` — About");
    expect(readme).toContain("index.html#/about");
  });
});

describe("package naming", () => {
  it("derives folder and component names from the project and page slugs", () => {
    expect(siteFolder(project([page("Home", "home", [])], [], "My Great Site"))).toBe("my-great-site-site");
    expect(componentNameForPage(page("My Work", "my-work", []))).toBe("MyWorkPage");
    // Slugs are untrusted: the generated name is always a valid identifier.
    expect(componentNameForPage(page("404", "404", []))).toBe("Page404");
    expect(componentNameForPage(page("Empty", "---", []))).toBe("Page");
  });

  it("neutralizes names that would break out of generated comments", () => {
    const hostile = project([page("Home */ throw new Error(1); /*", "home", [])], [], "Site */ x");
    const site = generateSite(hostile);

    // Every generated comment carries the neutralized name: a name must never
    // be able to close the comment and emit code (spec §23, §32).
    expect(fileContents(site.files, "src/App.tsx")).toContain("/** Site * / x — generated by Frame. */");
    expect(fileContents(site.files, "src/pages/HomePage.tsx")).toContain(
      "* Home * / throw new Error(1); /* — generated by Frame",
    );
    expect(fileContents(site.files, "src/styles/site.css")).toContain(
      "/* Page: Home * / throw new Error(1); /* */",
    );
    expect(fileContents(site.files, "README.md")).toContain("# Site * / x");

    // The page title travels as an escaped HTML text node, not as markup.
    expect(fileContents(site.files, "index.html")).toContain("<title>Site */ x</title>");
  });

  it("escapes markup in the page title rather than injecting it", () => {
    const html = fileContents(
      generateSite(project([page("Home", "home", [])], [], "Site </title><script>alert(1)</script>")).files,
      "index.html",
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("keeps component names unique when slugs pascal-case identically", () => {
    const site = generateSite(project([page("Dashed", "a-b", []), page("Dotted", "a.b", [])]));
    const paths = site.files.map((file) => file.path);
    expect(paths).toContain("src/pages/ABPage.tsx");
    expect(paths).toContain("src/pages/ABPage2.tsx");
  });
});
