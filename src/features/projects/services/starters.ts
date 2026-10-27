import {
  createRootNode,
  slugify,
  type FrameNode,
  type FramePage,
  type StyleValue,
} from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import type { StarterId } from "@/features/projects/types";
import { createId } from "@/lib/ids";

/**
 * Starter templates for the create-project dialog (spec §6 "Starter
 * options", Phase 11 "Create a polished demo project").
 *
 * Every starter builds a real, validated document out of registered
 * components — no placeholders, no markup the editor cannot represent. The
 * dialog only offers starters implemented here, so an option is never a
 * nonfunctional control (§6).
 *
 * Link destinations are chosen to be genuinely functional everywhere they
 * run: `page:<slug>` internal links resolve in preview and export (§20), and
 * `mailto:` buttons work without any routing support (§32 safe schemes).
 */

export interface StarterOption {
  id: StarterId;
  label: string;
  description: string;
}

export const STARTERS: readonly StarterOption[] = [
  {
    id: "blank",
    label: "Blank project",
    description: "One empty page, ready for your first component.",
  },
  {
    id: "landing",
    label: "Landing page",
    description: "Navbar, hero, feature grid, call to action, and footer.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Two linked pages: selected work and an about page.",
  },
];

/** Working contact destination used by the demo content. */
const CONTACT_HREF = "mailto:hello@example.com";

interface NodeOverrides {
  props?: Record<string, unknown>;
  styles?: Record<string, StyleValue>;
  name?: string;
  children?: FrameNode[];
}

/** Fresh node of a registered component with optional overrides. */
function nodeOf(type: string, overrides: NodeOverrides = {}): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) {
    throw new Error(`starter template uses unknown component type "${type}"`);
  }
  const node = definition.createDefaultNode();
  if (overrides.props !== undefined) Object.assign(node.props, overrides.props);
  if (overrides.styles !== undefined) Object.assign(node.styles, overrides.styles);
  if (overrides.name !== undefined) node.name = overrides.name;
  if (overrides.children !== undefined) node.children = overrides.children;
  return node;
}

function makePage(name: string, slug: string, children: FrameNode[]): FramePage {
  return {
    id: createId(),
    name,
    slug,
    root: { ...createRootNode(createId()), children },
    settings: { title: name, backgroundColor: "#ffffff" },
  };
}

function navLink(label: string, href: string): FrameNode {
  return nodeOf("link", {
    name: label,
    props: { label, href, newTab: false },
  });
}

function navbar(brand: string, links: FrameNode[]): FrameNode {
  return nodeOf("navbar", {
    name: "Navbar",
    children: [
      nodeOf("heading", {
        name: "Brand",
        props: { level: 3, text: brand },
        styles: { margin: 0, fontSize: 20 },
      }),
      nodeOf("stack", {
        name: "Nav links",
        styles: { display: "flex", flexDirection: "row", gap: 16, alignItems: "center" },
        children: links,
      }),
    ],
  });
}

function hero(heading: string, copy: string, cta: { label: string; href: string }): FrameNode {
  return nodeOf("hero", {
    name: "Hero",
    children: [
      nodeOf("heading", {
        name: "Hero heading",
        props: { level: 1, text: heading },
        styles: { margin: 0, fontSize: 40 },
      }),
      nodeOf("paragraph", { name: "Hero copy", props: { text: copy } }),
      nodeOf("button", {
        name: "Hero action",
        props: { label: cta.label, href: cta.href },
      }),
    ],
  });
}

function section(title: string, children: FrameNode[], name?: string): FrameNode {
  return nodeOf("section", {
    name: name ?? title,
    children: [
      nodeOf("heading", {
        name: `${title} heading`,
        props: { level: 2, text: title },
        styles: { margin: 0, fontSize: 28, textAlign: "center" },
      }),
      ...children,
    ],
  });
}

function card(title: string, body: string): FrameNode {
  return nodeOf("stack", {
    name: title,
    styles: {
      gap: 8,
      padding: 24,
      backgroundColor: "#fafafa",
      borderRadius: 12,
      textAlign: "left",
    },
    children: [
      nodeOf("heading", {
        name: `${title} heading`,
        props: { level: 3, text: title },
        styles: { margin: 0, fontSize: 18 },
      }),
      nodeOf("paragraph", { name: `${title} copy`, props: { text: body } }),
    ],
  });
}

function footer(brand: string): FrameNode {
  return nodeOf("footer", {
    name: "Footer",
    children: [
      nodeOf("text", {
        name: "Copyright",
        props: { text: `© 2026 ${brand}` },
      }),
      nodeOf("stack", {
        name: "Footer links",
        styles: { display: "flex", flexDirection: "row", gap: 16 },
        children: [navLink("Contact", CONTACT_HREF)],
      }),
    ],
  });
}

/** Landing page starter: a single, complete marketing page. */
function landingPages(projectName: string): FramePage[] {
  const brand = projectName;
  const page = makePage(projectName, slugify(projectName), [
    navbar(brand, [navLink("Contact", CONTACT_HREF)]),
    hero(
      "Design that works harder",
      "A clear headline, one sentence of value, and a single call to action — the shape every good landing page starts from.",
      { label: "Start a project", href: CONTACT_HREF },
    ),
    section(
      "Everything you need",
      [
        nodeOf("grid", {
          name: "Feature grid",
          styles: { width: "100%" },
          children: [
            card("Structured", "Edit a real component tree, not pixels on a canvas."),
            card("Responsive", "Desktop, tablet, and mobile styles from one document."),
            card("Exportable", "Leave with a standalone site you can build yourself."),
          ],
        }),
      ],
      "Features",
    ),
    nodeOf("divider", { name: "Divider" }),
    section(
      "Ready when you are",
      [
        nodeOf("paragraph", {
          name: "Closing copy",
          props: { text: "Tell us what you are building and we will get back to you." },
        }),
        nodeOf("button", {
          name: "Closing action",
          props: { label: "Get in touch", href: CONTACT_HREF },
        }),
      ],
      "Call to action",
    ),
    footer(brand),
  ]);
  return [page];
}

/** Portfolio starter: two pages linked to each other. */
function portfolioPages(projectName: string): FramePage[] {
  const homeSlug = slugify(projectName);
  // Keep the second page's slug distinct when the project itself is called
  // "About" (spec §20: a project never ships duplicate page slugs).
  const aboutName = homeSlug === "about" ? "Studio" : "About";
  const aboutSlug = slugify(aboutName);

  const home = makePage(projectName, homeSlug, [
    navbar(projectName, [navLink("About the studio", `page:${aboutSlug}`)]),
    hero("Selected work", "A short tour of the projects we are proudest of.", {
      label: "About the studio",
      href: `page:${aboutSlug}`,
    }),
    section(
      "Recent work",
      [
        nodeOf("grid", {
          name: "Case study grid",
          styles: { width: "100%" },
          children: [
            card(
              "Northwind rebrand",
              "A full identity refresh delivered in six weeks, from wordmark to launch site.",
            ),
            card(
              "Ledger dashboard",
              "A finance dashboard that made monthly reporting a ten-minute job.",
            ),
          ],
        }),
      ],
      "Work",
    ),
    section(
      "Work with us",
      [
        nodeOf("paragraph", {
          name: "Contact copy",
          props: { text: "Have something similar in mind? We would love to hear about it." },
        }),
        nodeOf("button", {
          name: "Contact action",
          props: { label: "Say hello", href: CONTACT_HREF },
        }),
      ],
      "Contact",
    ),
    footer(projectName),
  ]);

  const about = makePage(aboutName, aboutSlug, [
    navbar(projectName, [navLink("See the work", `page:${homeSlug}`)]),
    section(
      `About ${projectName}`,
      [
        nodeOf("paragraph", {
          name: "About copy",
          props: {
            text: "We are a small studio that designs and builds websites people actually enjoy using.",
          },
        }),
        nodeOf("paragraph", {
          name: "Approach copy",
          props: {
            text: "Every project starts with structure: what the page must say, who it is for, and what a visitor should do next.",
          },
        }),
      ],
      "About",
    ),
    nodeOf("divider", { name: "Divider" }),
    section(
      "How we work",
      [
        nodeOf("grid", {
          name: "Process grid",
          styles: { width: "100%" },
          children: [
            card("Discover", "One week of interviews, audit, and a shared plan."),
            card("Design and build", "Weekly previews, no surprises, everything in the open."),
          ],
        }),
      ],
      "Process",
    ),
    footer(projectName),
  ]);

  return [home, about];
}

/**
 * Pages for a new project. The blank starter keeps the historic behavior
 * (one empty page named after the project).
 */
export function starterPages(starter: StarterId, projectName: string): FramePage[] {
  switch (starter) {
    case "landing":
      return landingPages(projectName);
    case "portfolio":
      return portfolioPages(projectName);
    case "blank":
      return [makePage(projectName, slugify(projectName), [])];
  }
}
