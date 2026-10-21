import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProjectRepository } from "@/features/projects/repositories/RepositoryContext";
import { getProject } from "@/features/projects/services/projectService";
import type { FrameProject } from "@/features/document/model";
import { EditorShell } from "@/features/editor/components/EditorShell";

/**
 * `/editor/:projectId` — loads the persisted project and mounts the editor
 * shell (Phase 2). Missing and damaged projects get explicit recovery states
 * instead of a broken editor. Nothing pretends: if validation fails, the
 * stored copy is untouched and the user is told.
 */
export default function EditorRoute() {
  const { projectId = "" } = useParams();
  const repository = useProjectRepository();
  const [state, setState] = useState<{
    status: "loading" | "ready" | "missing" | "invalid";
    project: FrameProject | null;
  }>({ status: "loading", project: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(repository, projectId);
        if (cancelled) return;
        setState(
          project === null ? { status: "missing", project: null } : { status: "ready", project },
        );
      } catch {
        if (!cancelled) setState({ status: "invalid", project: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, projectId]);

  if (state.status === "ready" && state.project !== null) {
    return (
      <EditorShell
        project={state.project}
        repository={repository}
        onProjectChanged={(project) => setState({ status: "ready", project })}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to projects
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {state.status === "loading" && (
          <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading project…
          </p>
        )}

        {state.status === "missing" && (
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-lg font-semibold">Project not found</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              This project does not exist in local storage. It may have been deleted.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {state.status === "invalid" && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-6 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
            <h1 className="text-lg font-semibold text-red-800 dark:text-red-300">
              This project’s data is damaged
            </h1>
            <p className="mt-2 text-sm text-red-700/80 dark:text-red-300/80">
              The stored document failed validation and could not be opened. The stored copy was not
              modified — you can delete the project from the dashboard.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              Go to dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
