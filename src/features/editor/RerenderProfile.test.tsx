import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/app/router";
import type { FrameNode, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";
import {
  resetEditorPreferences,
  useEditorStore,
} from "@/features/editor/stores/editorStore";
import { resetHistory } from "@/features/editor/stores/historyStore";
import { resetClipboard } from "@/features/editor/stores/clipboardStore";

/**
 * Phase 11 "Profile unnecessary rerenders" (spec §35) against §30:
 * "property changes should update the canvas without unnecessary full-editor
 * rerenders" and "dragging should remain visually responsive".
 *
 * Each panel is wrapped in a counting shim so the test observes real render
 * counts instead of guessing from the DOM. The wrappers render the actual
 * component, so behavior under test is untouched.
 */
const renders = vi.hoisted(() => ({ toolbar: 0, sidebar: 0, inspector: 0, status: 0 }));

vi.mock("@/features/editor/components/EditorToolbar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/components/EditorToolbar")>();
  return {
    EditorToolbar: (props: Parameters<typeof actual.EditorToolbar>[0]) => {
      renders.toolbar += 1;
      return <actual.EditorToolbar {...props} />;
    },
  };
});

vi.mock("@/features/editor/components/ComponentSidebar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/editor/components/ComponentSidebar")>();
  return {
    ComponentSidebar: (props: Parameters<typeof actual.ComponentSidebar>[0]) => {
      renders.sidebar += 1;
      return <actual.ComponentSidebar {...props} />;
    },
  };
});

vi.mock("@/features/editor/components/PropertiesInspector", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/editor/components/PropertiesInspector")>();
  return {
    PropertiesInspector: (props: Parameters<typeof actual.PropertiesInspector>[0]) => {
      renders.inspector += 1;
      return <actual.PropertiesInspector {...props} />;
    },
  };
});

vi.mock("@/features/editor/components/StatusBar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/components/StatusBar")>();
  return {
    StatusBar: (props: Parameters<typeof actual.StatusBar>[0]) => {
      renders.status += 1;
      return <actual.StatusBar {...props} />;
    },
  };
});

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

async function openComponentsTab(): Promise<void> {
  const user = userEvent.setup();
  const sidebar = screen.getByRole("complementary", { name: "Components and layers" });
  await user.click(within(sidebar).getByRole("tab", { name: /components/i }));
}

function snapshot(): typeof renders {
  return { ...renders };
}

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  resetHistory();
  resetClipboard();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
  renders.toolbar = 0;
  renders.sidebar = 0;
  renders.inspector = 0;
  renders.status = 0;
});

describe("rerender profiling (Phase 11, spec §30)", () => {
  it("re-renders every panel when the document changes (instrumentation sanity)", async () => {
    const user = userEvent.setup();
    const dbName = "rerender-document-edit";
    const project = await seedProject(dbName, "Rerender Edit");
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Rerender Edit" });

    // Counts must actually move, otherwise the negative assertions below prove
    // nothing: a document edit changes the project prop, so every panel that
    // shows document state rerenders.
    await openComponentsTab();
    const before = snapshot();
    await user.click(screen.getByRole("button", { name: "Insert Section" }));

    await waitFor(() => {
      expect(renders.toolbar).toBeGreaterThan(before.toolbar);
      expect(renders.sidebar).toBeGreaterThan(before.sidebar);
      expect(renders.inspector).toBeGreaterThan(before.inspector);
      expect(renders.status).toBeGreaterThan(before.status);
    });
  });

  it("does not rerender any panel for pointer movement during a drag", async () => {
    const dbName = "rerender-drag";
    const project = await seedProject(dbName, "Rerender Drag");
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Rerender Drag" });

    const before = snapshot();
    // `setDragOver` fires on every pointer move over a droppable (spec §15).
    // The shell must not resubscribe to it: only the overlay and the surfaces
    // drawing drop indicators may re-render.
    for (let move = 0; move < 10; move += 1) {
      act(() => {
        useEditorStore.getState().setDragOver({
          zone: "canvas",
          overNodeId: "root",
          band: "after",
          valid: true,
        });
      });
    }
    expect(renders).toEqual(before);

    // Ending the drag resets the state without touching the panels either.
    act(() => {
      useEditorStore.getState().setDragEnd();
    });
    expect(renders).toEqual(before);
  });

  it("keeps the toolbar, sidebar, and status bar still while the selection changes", async () => {
    const dbName = "rerender-selection";
    const project = await seedProject(dbName, "Rerender Selection", [
      makeTypedNode("node-hero", "section"),
    ]);
    renderEditor(dbName, project.id);
    await screen.findByRole("button", { name: "Rerender Selection" });

    const before = snapshot();
    act(() => {
      useEditorStore.getState().selectNode("node-hero");
    });
    expect(useEditorStore.getState().selectedNodeId).toBe("node-hero");

    // Selection is presentation state: panels showing document content may
    // follow it internally, but the shell must not rerender the whole layout.
    expect(renders.toolbar).toBe(before.toolbar);
    expect(renders.sidebar).toBe(before.sidebar);
    expect(renders.status).toBe(before.status);
  });
});
