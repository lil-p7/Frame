import "@testing-library/jest-dom/vitest";
// Provides IndexedDB in jsdom; must load before Dexie touches `indexedDB`.
import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "@/app/router";
import { RepositoryContext } from "@/features/projects/repositories/RepositoryContext";
import { DexieProjectRepository } from "@/features/projects/repositories/projectRepository";
import { createProject } from "@/features/projects/services/projectService";

/** Renders the real routes with a fake IndexedDB-backed repository. */
function renderApp(dbName: string, initialEntries: string[] = ["/"]) {
  const repository = new DexieProjectRepository(dbName);
  const router = createMemoryRouter(routes, { initialEntries });
  const utils = render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, utils };
}

/** Seeds storage first, then renders — modelling "reopen an existing project". */
async function seedAndRender(dbName: string, names: string[]) {
  const repository = new DexieProjectRepository(dbName);
  const projects = [];
  for (const name of names) {
    projects.push(await createProject(repository, { name }));
  }
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  const utils = render(
    <RepositoryContext.Provider value={repository}>
      <RouterProvider router={router} />
    </RepositoryContext.Provider>,
  );
  return { repository, project: projects[0], utils };
}

describe("DashboardPage (integration over IndexedDB)", () => {
  it("shows the empty state, then creates a project and opens it in the editor", async () => {
    const user = userEvent.setup();
    const view = renderApp("db-create");

    expect(await view.utils.findByText("No projects yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create your first project/i }));
    await user.type(screen.getByPlaceholderText("Portfolio Website"), "My First Site");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    // Creation navigates to the editor route, which loads the saved page.
    expect(await screen.findByTestId("editor-project-name")).toHaveTextContent("My First Site");

    // Returning to the dashboard shows the persisted card.
    await user.click(screen.getByRole("link", { name: /back to projects/i }));
    const cards = await screen.findAllByTestId("project-card");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText("My First Site")).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/1 page/)).toBeInTheDocument();
  });

  it("restores projects from storage on a fresh render (simulated restart)", async () => {
    const dbName = "db-restart";
    const seeded = await seedAndRender(dbName, ["Persisted Project"]);
    const utils = seeded.utils;

    // First render lists it.
    expect(await screen.findByText("Persisted Project")).toBeInTheDocument();
    utils.unmount();

    // Second render = fresh app instance over the same storage.
    const reloaded = renderApp(dbName);
    expect(await reloaded.utils.findByText("Persisted Project")).toBeInTheDocument();
  });

  it("renames a project through its context menu and persists the rename", async () => {
    const user = userEvent.setup();
    const dbName = "db-rename";
    const view = await seedAndRender(dbName, ["Original Name"]);
    const utils = view.utils;
    const project = view.project!;

    expect(await screen.findByText("Original Name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Open menu for ${project.name}` }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const nameInput = (await screen.findAllByRole("textbox"))[0]!;
    expect(nameInput).toHaveValue("Original Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed via dialog");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    expect(await screen.findByText("Renamed via dialog")).toBeInTheDocument();
    utils.unmount();

    const reloaded = renderApp(dbName);
    expect(await reloaded.utils.findByText("Renamed via dialog")).toBeInTheDocument();
  });

  it("duplicates a project producing an independent second project", async () => {
    const user = userEvent.setup();
    const dbName = "db-duplicate";
    const view = await seedAndRender(dbName, ["To Duplicate"]);
    const project = view.project!;

    expect(await screen.findByText("To Duplicate")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Open menu for ${project.name}` }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    await waitFor(
      () => {
        const cards = screen.getAllByTestId("project-card");
        expect(cards).toHaveLength(2);
        // Both cards keep their own identity: distinct editor routes. The first
        // link inside each card navigates to that project's editor route.
        const hrefs = cards.map((card) =>
          within(card).getAllByRole("link")[0]!.getAttribute("href"),
        );
        expect(new Set(hrefs).size).toBe(2);
        expect(screen.getByText("To Duplicate (Copy)")).toBeInTheDocument();
      },
      // Toast + IndexedDB write + reload can exceed the 1s default under load.
      { timeout: 5000 },
    );
  });

  it("requires confirmation before deleting and removes the project", async () => {
    const user = userEvent.setup();
    const dbName = "db-delete";
    const view = await seedAndRender(dbName, ["Doomed Project"]);
    const project = view.project!;

    expect(await screen.findByText("Doomed Project")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Open menu for ${project.name}` }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    // The project must still exist until the destructive click.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Doomed Project")).toBeInTheDocument();
    await user.click(within(dialog).getByTestId("confirm-delete"));

    await waitFor(() => {
      expect(screen.queryByTestId("project-card")).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument();
  });

  it("filters projects by search query", async () => {
    const user = userEvent.setup();
    const dbName = "db-search";
    await seedAndRender(dbName, ["Alpha Site", "Beta Site"]);

    await screen.findByText("Alpha Site");
    expect(screen.getAllByTestId("project-card")).toHaveLength(2);

    await user.type(screen.getByRole("searchbox", { name: /search projects/i }), "Beta");
    await waitFor(() => {
      const cards = screen.getAllByTestId("project-card");
      expect(cards).toHaveLength(1);
      expect(within(cards[0]!).getByText("Beta Site")).toBeInTheDocument();
    });
  });

  it("survives a corrupt stored record without crashing or losing other projects", async () => {
    const dbName = "db-corrupt";
    const pre = new DexieProjectRepository(dbName);
    await createProject(pre, { name: "Healthy Site" });
    // Includes indexed fields so the damaged record is still listed by the
    // dashboard (not silently filtered out of the index query).
    await pre.rawPutForTests({
      id: "corrupt-1",
      name: "Hand-edited junk",
      updatedAt: "2026-01-01T00:00:00.000Z",
      pages: "not-a-list",
    });

    const reloaded = renderApp(dbName);

    // The healthy project still renders next to an explicit damaged row.
    expect(await reloaded.utils.findByText("Healthy Site")).toBeInTheDocument();
    expect(await reloaded.utils.findByText("Hand-edited junk")).toBeInTheDocument();
    expect(reloaded.utils.getAllByTestId("project-card")).toHaveLength(2);
  });
});
