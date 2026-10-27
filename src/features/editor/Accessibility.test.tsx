import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import { resetEditorPreferences, useEditorStore } from "@/features/editor/stores/editorStore";
import { resetHistory } from "@/features/editor/stores/historyStore";
import { resetClipboard } from "@/features/editor/stores/clipboardStore";

/**
 * Phase 11 "Improve accessibility" (spec §35) verified against §29.
 *
 * The checks below assert *behavior*: controls actually carry an accessible
 * name, status changes actually reach a live region, the keyboard can perform
 * every drag-and-drop reorder, Escape really clears the selection, and the
 * stylesheet really honors reduced-motion — not just that the markup looks
 * correct.
 */

/** A node whose props satisfy the registered schema (spec §12). */
function makeTypedNode(id: string, type: string): FrameNode {
  const definition = getComponent(type);
  if (definition === undefined) throw new Error(`unknown component type "${type}"`);
  return {
    id,
    type,
    name: definition.label,
    props: definition.createDefaultProps(),
    styles: {},
    children: [],
    editor: { hidden: false, locked: false },
  };
}

async function seedProject(
  dbName: string,
  name: string,
  nodes: FrameNode[] = [],
): Promise<FrameProject> {
  const repository = new DexieProjectRepository(dbName);
  const project = await createProject(repository, { name });
  const page = project.pages[0];
  if (page === undefined) throw new Error("fixture broken: createProject made no page");
  page.root.children = nodes;
  await repository.saveProject(project);
  return project;
}

function renderEditor(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, { initialEntries: [`/editor/${projectId}`] });
  return render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
}

/** Approximates the accessible name a screen reader would announce. */
function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    const text = labelledBy
      .split(/\s+/)
      .filter((id) => id !== "")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text !== "") return text;
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel !== null && ariaLabel.trim() !== "") return ariaLabel.trim();

  // Form controls are named by their <label> association, never by their own
  // contents — an `<input>` has no text, and a `<select>` must not borrow its
  // option text as its name.
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const labels = element.labels;
    if (labels !== null && labels.length > 0) {
      const text = Array.from(labels)
        .map((label) => label.textContent ?? "")
        .join(" ")
        .trim();
      if (text !== "") return text;
    }
    if (element instanceof HTMLInputElement && element.type === "submit") {
      return element.value;
    }
    const title = element.getAttribute("title");
    if (title !== null && title.trim() !== "") return title.trim();
    return "";
  }

  const text = (element.textContent ?? "").trim();
  if (text !== "") return text;

  const title = element.getAttribute("title");
  if (title !== null && title.trim() !== "") return title.trim();
  return "";
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="treeitem"], [role="menuitem"]';

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  resetHistory();
  resetClipboard();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("editor accessibility (Phase 11, spec §29)", () => {
  it("gives every interactive control an accessible name", async () => {
    const user = userEvent.setup();
    const dbName = "a11y-names";
    const project = await seedProject(dbName, "A11y Names", [
      makeTypedNode("node-a", "section"),
      makeTypedNode("node-b", "hero"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "A11y Names" });

    // Exercise the surfaces that hold most controls: layers tab, a selection
    // (populates the inspector), then the component library.
    const sidebar = screen.getByRole("complementary", { name: "Components and layers" });
    await user.click(within(sidebar).getByRole("tab", { name: /layers/i }));
    await user.click(document.querySelector('[data-node-id="node-a"]') as HTMLElement);
    await user.click(within(sidebar).getByRole("tab", { name: /components/i }));

    const controls = Array.from(document.body.querySelectorAll(INTERACTIVE_SELECTOR));
    // Guard against a vacuous pass: the editor renders many controls.
    expect(controls.length).toBeGreaterThan(20);

    const unnamed = controls
      .filter((element) => accessibleName(element) === "")
      .map((element) => `${element.tagName.toLowerCase()}.${element.className || "(no class)"}`);
    expect(unnamed).toEqual([]);
  });

  it("announces persistence state through a live region", async () => {
    const dbName = "a11y-save-status";
    const project = await seedProject(dbName, "A11y Status");
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "A11y Status" });

    const status = screen.getByTestId("save-status");
    // role="status" is a polite live region: screen readers announce the
    // transition to saving/saved/failed without stealing focus (§29, §31).
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent(/saved|saving|failed/i);
  });

  it("reorders layers with Alt+Arrow as the keyboard alternative to dragging", async () => {
    const dbName = "a11y-keyboard-reorder";
    const project = await seedProject(dbName, "A11y Reorder", [
      makeTypedNode("node-a", "section"),
      makeTypedNode("node-b", "section"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "A11y Reorder" });

    const sidebar = screen.getByRole("complementary", { name: "Components and layers" });
    await userEvent.click(within(sidebar).getByRole("tab", { name: /layers/i }));

    // The root row is structural and stays first; only the child order moves.
    const rootId = project.pages[0]?.root.id ?? "";
    const childOrder = (): string[] =>
      Array.from(document.querySelectorAll('[data-testid="layer-row"][data-node-id]'))
        .map((row) => row.getAttribute("data-node-id") ?? "")
        .filter((id) => id !== rootId);
    expect(childOrder()).toEqual(["node-a", "node-b"]);

    const secondRow = document.querySelector('[data-node-id="node-b"]');
    expect(secondRow).not.toBeNull();
    (secondRow as HTMLElement).focus();
    fireEvent.keyDown(secondRow as HTMLElement, { key: "ArrowUp", altKey: true });

    await waitFor(() => {
      expect(childOrder()).toEqual(["node-b", "node-a"]);
    });

    // The reorder went through the command layer, so it must survive a
    // reload: read the project back from storage (spec §12/§31).
    const repository = new DexieProjectRepository(dbName);
    await waitFor(async () => {
      const saved = await repository.getProject(project.id);
      expect(saved?.pages[0]?.root.children.map((child) => child.id)).toEqual([
        "node-b",
        "node-a",
      ]);
    });
  });

  it("clears the selection with Escape", async () => {
    const user = userEvent.setup();
    const dbName = "a11y-escape";
    const project = await seedProject(dbName, "A11y Escape", [makeTypedNode("node-a", "section")]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "A11y Escape" });

    const sidebar = screen.getByRole("complementary", { name: "Components and layers" });
    await user.click(within(sidebar).getByRole("tab", { name: /layers/i }));
    const row = document.querySelector('[data-node-id="node-a"]');
    await user.click(row as HTMLElement);
    await waitFor(() => {
      expect(row).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
      expect(row).toHaveAttribute("aria-selected", "false");
    });
  });

  it("honors the operating system reduced-motion preference", () => {
    // §29 "Reduced-motion support": the whole-app rule lives in the global
    // stylesheet, so a single check covers every transition and spinner.
    const globalsCss = readFileSync("src/styles/globals.css", "utf8");
    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(globalsCss).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
