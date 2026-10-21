import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("EditorRoute (Phase 1 persistence route)", () => {
  it("shows an explicit not-found state for a missing project", async () => {
    renderEditor("editor-missing", "no-such-id");

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });

  it("loads a saved project with its page list", async () => {
    const dbName = "editor-saved";
    const seeded = renderEditor(dbName, "any");
    const utils = seeded.utils;
    const project = await createProject(seeded.repository, { name: "Portfolio Website" });

    // Reload the route freshly to prove load-from-storage.
    utils.unmount();
    renderEditor(dbName, project.id);

    await waitFor(async () => {
      expect(await screen.findByTestId("editor-project-name")).toHaveTextContent(
        "Portfolio Website",
      );
    });
    expect(screen.getAllByTestId("editor-page-name")[0]).toHaveTextContent("Portfolio Website");
  });

  it("navigates back to the dashboard from the not-found state", async () => {
    const user = userEvent.setup();
    renderEditor("editor-back", "ghost");

    await user.click(await screen.findByRole("link", { name: /go to dashboard/i }));
    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument();
  });
});
