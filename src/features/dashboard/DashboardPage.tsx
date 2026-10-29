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
import type { ProjectSummary, StarterId } from "@/features/projects/types";
import { PersistenceError, ProjectValidationError } from "@/lib/errors";

type SortMode = "recent" | "alphabetical";

const sortButtonClass = (selected: boolean): string =>
  `rounded px-2.5 py-1 text-xs ${
    selected ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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

  const handleCreate = async (
    name: string,
    description?: string,
    starter?: StarterId,
  ): Promise<void> => {
    try {
      const project = await createProject(repository, { name, description, starter });
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
    <div className="min-h-screen bg-zinc-950">
      <DashboardHeader onNewProject={() => setCreateOpen(true)} />

      <main className="relative isolate mx-auto min-h-[calc(100vh-3.5rem)] max-w-5xl overflow-hidden px-6 py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(1000px,100vh)] overflow-hidden"
        >
          <img
            src="/images/frame-dashboard-bg.jpg"
            alt=""
            className="absolute right-0 top-[20vh] h-[min(1000px,100vh)] w-auto max-w-none translate-x-[18%] object-contain object-top opacity-40 [mask-image:linear-gradient(to_right,transparent_0%,black_18%,black_82%,transparent_100%)] sm:translate-x-0 sm:opacity-60 md:top-0"
          />
        </div>
        <h1 className="display text-[26px] leading-tight text-zinc-100">Your projects</h1>
        <p className="mt-1.5 max-w-md text-sm text-zinc-400">
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
              className="w-full rounded border border-line bg-zinc-950 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
            />
          </label>

          <div
            className="flex items-center gap-1 rounded border border-line bg-zinc-900 p-0.5"
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
            <p role="status" className="text-sm text-zinc-500">
              Loading projects…
            </p>
          ) : error !== null ? (
            <ErrorPanel message={error} onRetry={() => void reload()} />
          ) : summaries.length === 0 ? (
            <EmptyDashboard onCreate={() => setCreateOpen(true)} />
          ) : visibleProjects.length === 0 ? (
            <p className="text-sm text-zinc-500">No projects match “{query}”.</p>
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
        onCreate={(name, description, starter) => void handleCreate(name, description, starter)}
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
    <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-zinc-900/60 px-8 py-16 text-center">
      <h2 className="display text-lg">No projects yet</h2>
      <p className="max-w-md text-sm text-zinc-400">
        Create your first project, then assemble navbars, heroes, text and buttons on a visual
        canvas — and export the finished website when you are done.
      </p>
      <button
        type="button"
        onClick={onCreate}
        data-testid="empty-state-create"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create your first project
      </button>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3">
      <p className="text-sm text-red-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded border border-red-800 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-900/40"
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
