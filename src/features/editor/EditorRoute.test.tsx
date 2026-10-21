import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";

function renderEditor(dbName: string, projectId: string) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, {
    initialEntries: [`/editor/${projectId}`],
  });
  const utils = render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, utils };
}

describe("EditorRoute", () => {
  it("shows an explicit not-found state for a missing project", async () => {
    renderEditor("editor-missing", "no-such-id");

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });

  it("mounts the editor shell from a freshly loaded saved project", async () => {
    const dbName = "editor-saved";
    // Seed storage directly, then mount the route to prove load-from-storage.
    const repository = new DexieProjectRepository(dbName);
    const project = await createProject(repository, { name: "Portfolio Website" });
    renderEditor(dbName, project.id);

    expect(await screen.findByRole("button", { name: "Portfolio Website" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-workspace")).toBeInTheDocument();
    const pageSelect = screen.getByRole("combobox", { name: /current page/i });
    expect(pageSelect).toHaveValue(project.pages[0]?.id ?? "");
  });

  it("shows the damaged-data recovery state for an invalid record", async () => {
    const dbName = "editor-damaged";
    const repository = new DexieProjectRepository(dbName);
    await repository.rawPutForTests({ id: "broken", name: "Broken", pages: "not-a-list" });

    renderEditor(dbName, "broken");

    expect(await screen.findByText("This project’s data is damaged")).toBeInTheDocument();
  });

  it("navigates back to the dashboard from the not-found state", async () => {
    const user = userEvent.setup();
    renderEditor("editor-back", "ghost");

    await user.click(await screen.findByRole("link", { name: /go to dashboard/i }));
    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument();
  });
});
