import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { FrameProject } from "@/features/document/model";
import { useProjectRepository } from "@/features/projects/repositories/RepositoryContext";
import { getProject } from "@/features/projects/services/projectService";
import type { ProjectRepository } from "@/features/projects/types";
import { resolveNodeAssetSrc } from "@/features/assets/service";
import { useAssetUrls } from "@/features/assets/hooks/useAssetUrls";
import { breakpointForWidth } from "@/features/document/responsive";
import { resolveViewportWidth, useEditorStore } from "@/features/editor/stores/editorStore";
import { editorPath, previewHrefFor, previewPath } from "@/features/preview/paths";
import { PreviewToolbar } from "@/features/preview/components/PreviewToolbar";
import { StaticPageView } from "@/features/preview/renderers/StaticPageView";

/**
 * `/preview/:projectId/:pageId` — the page as visitors see it (spec §5C, §22).
 *
 * Renders the shared static tree at the selected viewport width with no
 * editor controls, real links that navigate between project pages, and a
 * return-to-editor action. Missing projects and pages get explicit recovery
 * states instead of a blank screen.
 */
export default function PreviewRoute() {
  const { projectId = "", pageId = "" } = useParams();
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
    return <PreviewView project={state.project} repository={repository} pageId={pageId} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <PreviewShellHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {state.status === "loading" && (
          <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading preview…
          </p>
        )}

        {state.status === "missing" && (
          <Notice
            title="Project not found"
            body="This project does not exist in local storage. It may have been deleted."
            to="/"
            action="Go to dashboard"
          />
        )}

        {state.status === "invalid" && (
          <Notice
            tone="error"
            title="This project’s data is damaged"
            body="The stored document failed validation, so it cannot be previewed. The stored copy was not modified."
            to="/"
            action="Go to dashboard"
          />
        )}
      </main>
    </div>
  );
}

/** Ready state: the page plus the minimal preview chrome. */
function PreviewView({
  project,
  repository,
  pageId,
}: {
  project: FrameProject;
  repository: ProjectRepository;
  pageId: string;
}) {
  const navigate = useNavigate();
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const viewportWidth = resolveViewportWidth({ viewportSelection, customViewportWidth });
  // The preview renders the declarations that apply at its own width, so it
  // matches the canvas at the same breakpoint (spec §16).
  const breakpoint = breakpointForWidth(viewportWidth);
  const assetUrls = useAssetUrls(repository, project.assets);
  const page = project.pages.find((candidate) => candidate.id === pageId) ?? null;

  // Preview sets the document title for the page being viewed (§20).
  useEffect(() => {
    const previous = document.title;
    const pageTitle = page === null ? null : page.settings.title || page.name;
    document.title = pageTitle === null ? `${project.name} — preview` : `${pageTitle} — ${project.name}`;
    return () => {
      document.title = previous;
    };
  }, [page, project.name]);

  if (page === null) {
    const firstPage = project.pages[0];
    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
        <PreviewShellHeader projectId={project.id} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          <Notice
            title="Page not found"
            body="This page is no longer part of the project."
            to={firstPage === undefined ? editorPath(project.id) : previewPath(project.id, firstPage.id)}
            action={firstPage === undefined ? "Back to editor" : "Preview the first page"}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <PreviewToolbar
        project={project}
        page={page}
        onSelectPage={(nextPageId) => {
          void navigate(previewPath(project.id, nextPageId));
        }}
      />
      <main
        data-testid="preview-canvas"
        className="relative flex h-full min-w-0 flex-1 items-start justify-center overflow-auto bg-zinc-200 p-6 dark:bg-zinc-900"
      >
        <div
          data-testid="preview-viewport"
          data-width={viewportWidth}
          style={{ width: `${viewportWidth}px` }}
          className="min-h-full shrink-0 shadow-lg ring-1 ring-zinc-300/80 dark:ring-zinc-700"
        >
          <StaticPageView
            page={page}
            breakpoint={breakpoint}
            options={{
              // Stored asset references resolve to object URLs, exactly like
              // the canvas; anything unresolved keeps its recoverable state.
              transformNode: (node) => resolveNodeAssetSrc(node, assetUrls),
              mapHref: (href) => previewHrefFor(project, href),
            }}
          />
        </div>
      </main>
    </div>
  );
}

/** Back-to-editor header for the non-ready preview states. */
function PreviewShellHeader({ projectId }: { projectId?: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        to={projectId === undefined ? "/" : editorPath(projectId)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {projectId === undefined ? "← Back to projects" : "← Back to editor"}
      </Link>
    </header>
  );
}

function Notice({
  title,
  body,
  to,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  to: string;
  action: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-red-300 bg-red-50 px-6 py-10 text-center dark:border-red-900 dark:bg-red-950/40"
          : "rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <h1
        className={
          tone === "error"
            ? "text-lg font-semibold text-red-800 dark:text-red-300"
            : "text-lg font-semibold"
        }
      >
        {title}
      </h1>
      <p
        className={
          tone === "error"
            ? "mt-2 text-sm text-red-700/80 dark:text-red-300/80"
            : "mt-2 text-sm text-zinc-500 dark:text-zinc-400"
        }
      >
        {body}
      </p>
      <Link
        to={to}
        className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {action}
      </Link>
    </div>
  );
}
