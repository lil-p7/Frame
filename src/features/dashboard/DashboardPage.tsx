import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { ProjectCard } from "@/features/dashboard/components/ProjectCard";
import { CreateProjectDialog } from "@/features/dashboard/components/CreateProjectDialog";
import { RenameProjectDialog } from "@/features/dashboard/components/RenameProjectDialog";
import { DeleteProjectDialog } from "@/features/dashboard/components/DeleteProjectDialog";
import { useProjectSummaries } from "@/features/projects/hooks/useProjectSummaries";
import { useProjectRepository } from "@/features/projects/repositories/RepositoryContext";
import {
  createProject,
  deleteProject,
  duplicateProject,
  renameProject,
} from "@/features/projects/services/projectService";
import type { ProjectSummary } from "@/features/projects/types";
import { PersistenceError, ProjectValidationError } from "@/lib/errors";

type SortMode = "recent" | "alphabetical";

const sortButtonClass = (selected: boolean): string =>
  `rounded-md px-2 py-1 text-xs ${
    selected
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
  }`;

export default function DashboardPage() {
  const repository = useProjectRepository();
  const navigate = useNavigate();
  const { isLoading, summaries, error, reload } = useProjectSummaries();

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

  const visibleProjects = useMemo(() => {
    const filtered = summaries.filter((project) =>
      project.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (a.corrupt !== b.corrupt) return a.corrupt ? -1 : 1;
      if (sortMode === "alphabetical") return a.name.localeCompare(b.name);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return sorted;
  }, [summaries, query, sortMode]);

  const handleCreate = async (name: string, description?: string): Promise<void> => {
    try {
      const project = await createProject(repository, { name, description });
      toast.success(`Project "${project.name}" created`);
      void navigate(`/editor/${project.id}`);
      await reload();
    } catch (createError) {
      notifyPersistenceFailure(createError, "Project could not be created");
    }
  };

  const handleRename = async (id: string, newName: string): Promise<void> => {
    try {
      const project = await renameProject(repository, id, newName);
      toast.success(`Renamed to "${project.name}"`);
      await reload();
    } catch (renameError) {
      notifyPersistenceFailure(renameError, `Project could not be renamed`);
    }
  };

  const handleDuplicate = async (project: ProjectSummary): Promise<void> => {
    try {
      const copy = await duplicateProject(repository, project.id);
      toast.success(`Project duplicated as "${copy.name}"`);
      await reload();
    } catch (duplicateError) {
      notifyPersistenceFailure(duplicateError, `Project could not be duplicated`);
    }
  };

  const handleDelete = async (project: ProjectSummary): Promise<void> => {
    try {
      await deleteProject(repository, project.id);
      toast.success(`Project "${project.name}" deleted`);
      await reload();
    } catch (deleteError) {
      notifyPersistenceFailure(deleteError, `Project could not be deleted`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <DashboardHeader onNewProject={() => setCreateOpen(true)} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight">Your projects</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Build responsive web pages by assembling components on a canvas.
        </p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <label className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onPaste={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search projects"
              aria-label="Search projects by name"
              className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-blue-500"
            />
          </label>

          <div
            className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950"
            role="group"
            aria-label="Sort projects"
          >
            <button
              type="button"
              className={sortButtonClass(sortMode === "recent")}
              onClick={() => setSortMode("recent")}
              aria-pressed={sortMode === "recent"}
            >
              Recently modified
            </button>
            <button
              type="button"
              className={sortButtonClass(sortMode === "alphabetical")}
              onClick={() => setSortMode("alphabetical")}
              aria-pressed={sortMode === "alphabetical"}
            >
              Alphabetical
            </button>
          </div>
        </div>

        <section className="mt-6" aria-label="Projects">
          {isLoading ? (
            <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading projects…
            </p>
          ) : error !== null ? (
            <ErrorPanel message={error} onRetry={() => void reload()} />
          ) : summaries.length === 0 ? (
            <EmptyDashboard onCreate={() => setCreateOpen(true)} />
          ) : visibleProjects.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No projects match “{query}”.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProjects.map((project) => (
                <li key={project.id}>
                  <ProjectCard
                    project={project}
                    onRename={(p) => setRenaming(p)}
                    onDuplicate={(p) => void handleDuplicate(p)}
                    onDelete={(p) => setDeleting(p)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(name, description) => void handleCreate(name, description)}
      />
      <RenameProjectDialog
        project={renaming}
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        onRename={(id, newName) => {
          void handleRename(id, newName);
        }}
      />
      <DeleteProjectDialog
        project={deleting}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onDelete={() => {
          const project = deleting;
          setDeleting(null);
          if (project !== null) void handleDelete(project);
        }}
      />
    </div>
  );
}

function EmptyDashboard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-8 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-base font-semibold">No projects yet</h2>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Create your first project, then assemble navbars, heroes, text and buttons on a visual
        canvas — and export the finished website when you are done.
      </p>
      <button
        type="button"
        onClick={onCreate}
        data-testid="empty-state-create"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create your first project
      </button>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm text-red-800 dark:text-red-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
      >
        Try again
      </button>
    </div>
  );
}

function notifyPersistenceFailure(error: unknown, fallMessage: string): void {
  if (error instanceof ProjectValidationError) {
    toast.error(error.message);
    return;
  }
  if (error instanceof PersistenceError) {
    toast.error(`${error.message}. Your existing projects were not modified.`);
    return;
  }
  toast.error(fallMessage);
}
