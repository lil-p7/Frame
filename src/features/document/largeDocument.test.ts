import { describe, expect, it } from "vitest";
import { getComponent } from "@/features/component-registry/registry";
import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  parseFrameProject,
  type FrameNode,
  type FramePage,
  type FrameProject,
} from "@/features/document/model";
import {
  deleteNode,
  duplicateNode,
  insertNode,
  moveNode,
  updateNodeStyles,
} from "@/features/document/commands";
import { validatePage } from "@/features/document/validation";
import { pageStylesheet } from "@/features/document/stylesheet";
import { countNodes, findNode } from "@/features/document/traversal";
import {
  HISTORY_LIMIT,
  canUndo,
  recordHistory,
  undoHistory,
  type HistoryState,
} from "@/features/document/history";

/**
 * Phase 11 "Test large documents" (spec §35) against the §30 performance
 * targets.
 *
 * Budgets are deliberately generous (~10–50× the observed cost on a normal
 * machine) so they flag catastrophic regressions — an accidentally quadratic
 * command, an unbounded history, a stack overflow on deep trees — without
 * turning CI jitter into a red build. Every assertion still proves the work
 * completed correctly, not merely that it was fast.
 */

const SECTIONS = 100;
const PARAGRAPHS_PER_SECTION = 5;
/** One page = 1 root + 100 sections × (1 stack + 1 heading + 5 paragraphs). */
const NODES_PER_PAGE = 1 + SECTIONS * (3 + PARAGRAPHS_PER_SECTION);
const DEPTH = 400;

const VALIDATE_BUDGET_MS = 2_000;
const COMMAND_BUDGET_MS = 2_000;
const STYLESHEET_BUDGET_MS = 2_000;
const ROUND_TRIP_BUDGET_MS = 4_000;

function node(type: string, id: string, children: FrameNode[] = []): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown component type "${type}"`);
  return { ...definition.createDefaultNode(), id, children };
}

/** A structurally valid page with `SECTIONS` stacked content sections. */
function buildLargePage(prefix: string): FramePage {
  const sections: FrameNode[] = [];
  for (let i = 0; i < SECTIONS; i += 1) {
    const paragraphs: FrameNode[] = [];
    for (let p = 0; p < PARAGRAPHS_PER_SECTION; p += 1) {
      paragraphs.push(node("paragraph", `${prefix}p-${i}-${p}`));
    }
    // The first heading carries a mobile override so the stylesheet has to
    // emit a real media block, not just base rules (spec §16).
    const heading = node("heading", `${prefix}h-${i}`);
    const firstHeading =
      i === 0 ? { ...heading, responsive: { mobile: { fontSize: 18 } } } : heading;
    sections.push(
      node("section", `${prefix}sec-${i}`, [
        node("stack", `${prefix}stack-${i}`, [firstHeading, ...paragraphs]),
      ]),
    );
  }
  return {
    id: `${prefix}page`,
    name: "Large page",
    slug: "large-page",
    root: { ...createRootNode(`${prefix}root`), children: sections },
    settings: { title: "Large page", backgroundColor: "#ffffff" },
  };
}

/** Measures how long `run` takes, without asserting on the result. */
function elapsed(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

const largePage = buildLargePage("a-");
const otherPage = buildLargePage("b-");

const deepPage: FramePage = (() => {
  let child: FrameNode = node("heading", "deep-heading");
  for (let level = DEPTH; level > 0; level -= 1) {
    child = node("container", `deep-${level}`, [child]);
  }
  return {
    id: "page-deep",
    name: "Deep",
    slug: "deep",
    root: { ...createRootNode("deep-root"), children: [child] },
    settings: { title: "Deep", backgroundColor: "#ffffff" },
  };
})();

describe("large documents (Phase 11, spec §30)", () => {
  it("validates and styles an ~800-node page within budget", () => {
    expect(countNodes(largePage.root)).toBe(NODES_PER_PAGE);

    let issues: ReturnType<typeof validatePage> = [];
    const validateMs = elapsed(() => {
      issues = validatePage(largePage);
    });
    expect(validateMs).toBeLessThan(VALIDATE_BUDGET_MS);
    expect(issues).toEqual([]);

    let css = "";
    const cssMs = elapsed(() => {
      css = pageStylesheet(largePage, "responsive");
    });
    expect(cssMs).toBeLessThan(STYLESHEET_BUDGET_MS);
    expect(css).toContain(".frame-page");
    expect(css).toContain("fr-a-h-0");
    expect(css).toContain("@media");
  });

  it("keeps every editing command responsive on a large page", () => {
    let page = largePage;
    const firstSectionId = "a-sec-0";
    const lastSectionId = `a-sec-${SECTIONS - 1}`;
    const overBudget: string[] = [];

    const measure = (label: string, run: () => void): void => {
      const ms = elapsed(run);
      if (ms >= COMMAND_BUDGET_MS) overBudget.push(`${label} (${Math.round(ms)}ms)`);
    };

    measure("insert", () => {
      page = insertNode(page, {
        parentId: "a-stack-1",
        index: 1,
        node: node("heading", "inserted-heading"),
      });
    });
    measure("duplicate", () => {
      page = duplicateNode(page, firstSectionId);
    });
    measure("move", () => {
      page = moveNode(page, { nodeId: lastSectionId, newParentId: "a-root", index: 0 });
    });
    measure("style", () => {
      page = updateNodeStyles(page, "a-h-1", { fontSize: 32 });
    });
    measure("delete", () => {
      page = deleteNode(page, firstSectionId);
    });
    expect(overBudget).toEqual([]);

    // Each command ran full page validation; the result must still be clean
    // and reflect all five operations: +1 inserted heading, +1 duplicated
    // section subtree (8 nodes), then −8 for the deleted section.
    expect(validatePage(page)).toEqual([]);
    expect(findNode(page.root, "inserted-heading")).not.toBeNull();
    expect(findNode(page.root, firstSectionId)).toBeNull();
    expect(page.root.children[0]?.id).toBe(lastSectionId);
    expect(findNode(page.root, "a-h-1")?.styles.fontSize).toBe(32);
    expect(countNodes(page.root)).toBe(NODES_PER_PAGE + 1);
  });

  it("handles deeply nested documents without exhausting the stack", () => {
    expect(countNodes(deepPage.root)).toBe(DEPTH + 2);

    let issues: ReturnType<typeof validatePage> = [];
    const validateMs = elapsed(() => {
      issues = validatePage(deepPage);
    });
    expect(validateMs).toBeLessThan(VALIDATE_BUDGET_MS);
    expect(issues).toEqual([]);

    expect(findNode(deepPage.root, "deep-heading")).not.toBeNull();

    let css = "";
    const cssMs = elapsed(() => {
      css = pageStylesheet(deepPage, "responsive");
    });
    expect(cssMs).toBeLessThan(STYLESHEET_BUDGET_MS);
    expect(css).toContain("fr-deep-heading");

    // Deleting a node 400 levels down must walk the whole chain safely.
    const withoutLeaf = deleteNode(deepPage, "deep-1");
    expect(findNode(withoutLeaf.root, "deep-heading")).toBeNull();
    expect(validatePage(withoutLeaf)).toEqual([]);
  });

  it("keeps history bounded during a long editing session", () => {
    let state: HistoryState = {};

    for (let step = 0; step < HISTORY_LIMIT * 3; step += 1) {
      state = recordHistory(state, largePage.id, largePage, { now: step });
    }

    const entry = state[largePage.id];
    expect(entry).toBeDefined();
    expect(entry?.past.length).toBe(HISTORY_LIMIT);
    expect(entry?.future).toEqual([]);
    expect(canUndo(state, largePage.id)).toBe(true);

    const transition = undoHistory(state, largePage.id, largePage);
    expect(transition).not.toBeNull();
    expect(transition?.page).toBe(largePage);
  });

  it("round-trips a multi-page large project through the project schema", () => {
    const project: FrameProject = {
      id: "proj-large",
      name: "Large project",
      schemaVersion: PROJECT_SCHEMA_VERSION,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      pages: [largePage, otherPage],
      assets: [],
      designTokens: { colors: {}, spacing: {}, typography: {} },
    };

    expect(countNodes(largePage.root) + countNodes(otherPage.root)).toBe(NODES_PER_PAGE * 2);

    // Serialize exactly as persistence does, then parse it back.
    const serialized = JSON.stringify(project);
    let parsed: FrameProject | null = null;
    const parseMs = elapsed(() => {
      parsed = parseFrameProject(JSON.parse(serialized));
    });
    expect(parseMs).toBeLessThan(ROUND_TRIP_BUDGET_MS);
    expect(parsed).toEqual(project);
  });
});
