import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FrameProject } from "@/features/document/model";
import { CanvasWorkspace } from "@/features/editor/components/CanvasWorkspace";
import { ComponentSidebar } from "@/features/editor/components/ComponentSidebar";
import { EditorToolbar } from "@/features/editor/components/EditorToolbar";
import { PanelResizeHandle } from "@/features/editor/components/PanelResizeHandle";
import { PropertiesInspector } from "@/features/editor/components/PropertiesInspector";
import { StatusBar } from "@/features/editor/components/StatusBar";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import type { ProjectRepository } from "@/features/projects/types";

/** Below this width the sidebars auto-collapse once so the canvas stays usable. */
const COMPACT_BREAKPOINT = 900;

interface EditorShellProps {
  project: FrameProject;
  repository: ProjectRepository;
  onProjectChanged: (project: FrameProject) => void;
}

/**
 * Full-viewport editor application shell (spec §7):
 * toolbar / left sidebar / canvas / right inspector / status bar.
 *
 * Fits a 1366×768 laptop viewport without page scrolling — panels and canvas
 * share a flex row; only the canvas and panels scroll internally. Sidebars
 * collapse (rail buttons re-open them) and resize within clamped widths.
 */
export function EditorShell({ project, repository, onProjectChanged }: EditorShellProps) {
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const selectNode = useEditorStore((s) => s.selectNode);
  const leftPanelWidth = useEditorStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useEditorStore((s) => s.rightPanelWidth);
  const leftPanelCollapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const rightPanelCollapsed = useEditorStore((s) => s.rightPanelCollapsed);
  const toggleLeftPanel = useEditorStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel);
  const setLeftPanelWidth = useEditorStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useEditorStore((s) => s.setRightPanelWidth);
  const fitToWorkspace = useEditorStore((s) => s.fitToWorkspace);

  const canvasRef = useRef<HTMLDivElement>(null);

  const currentPage = project.pages.find((page) => page.id === currentPageId) ?? project.pages[0];

  // Default to the first page whenever the stored selection is missing or stale.
  useEffect(() => {
    const firstPage = project.pages[0];
    if (firstPage === undefined) return;
    if (currentPageId === null || !project.pages.some((page) => page.id === currentPageId)) {
      setCurrentPage(firstPage.id);
    }
  }, [project.pages, currentPageId, setCurrentPage]);

  // Changing pages invalidates the old page's selection.
  useEffect(() => {
    selectNode(null);
  }, [currentPage?.id, selectNode]);

  // Responsive layout: collapse both sidebars when the window crosses into
  // compact width, so the canvas keeps a usable area (spec §7).
  const lastWindowWidth = useRef<number | null>(null);
  useEffect(() => {
    const onResize = (): void => {
      const width = window.innerWidth;
      const previous = lastWindowWidth.current;
      lastWindowWidth.current = width;
      if (previous === null) return;
      if (previous >= COMPACT_BREAKPOINT && width < COMPACT_BREAKPOINT) {
        const state = useEditorStore.getState();
        if (!state.leftPanelCollapsed) state.toggleLeftPanel();
        if (!state.rightPanelCollapsed) state.toggleRightPanel();
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (currentPage === undefined) {
    // The schema guarantees at least one page; guard anyway rather than crash.
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-zinc-500">
        This project has no pages to edit.
      </div>
    );
  }

  const railButton =
    "flex w-6 shrink-0 items-center justify-center border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <EditorToolbar
        project={project}
        repository={repository}
        onProjectRenamed={onProjectChanged}
        onFitToWorkspace={() => fitToWorkspace(canvasRef.current?.clientWidth ?? 0)}
      />

      <div className="flex min-h-0 flex-1">
        {leftPanelCollapsed ? (
          <button
            type="button"
            onClick={toggleLeftPanel}
            title="Show components and layers"
            className={cn(railButton, "border-r")}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Show components and layers</span>
          </button>
        ) : (
          <>
            <aside
              style={{ width: `${leftPanelWidth}px` }}
              className="flex min-h-0 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              aria-label="Components and layers"
            >
              <div className="flex min-h-0 flex-1">
                <div className="min-w-0 flex-1">
                  <ComponentSidebar root={currentPage.root} />
                </div>
                <button
                  type="button"
                  onClick={toggleLeftPanel}
                  title="Collapse sidebar"
                  className="flex w-6 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Collapse components and layers</span>
                </button>
              </div>
            </aside>
            <PanelResizeHandle
              side="left"
              onResizeDelta={(d) => setLeftPanelWidth(leftPanelWidth + d)}
            />
          </>
        )}

        <CanvasWorkspace page={currentPage} scrollerRef={canvasRef} />

        {rightPanelCollapsed ? (
          <button
            type="button"
            onClick={toggleRightPanel}
            title="Show inspector"
            className={cn(railButton, "border-l")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Show inspector</span>
          </button>
        ) : (
          <>
            <PanelResizeHandle
              side="right"
              onResizeDelta={(d) => setRightPanelWidth(rightPanelWidth + d)}
            />
            <aside
              style={{ width: `${rightPanelWidth}px` }}
              className="flex min-h-0 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              aria-label="Properties inspector"
            >
              <div className="flex min-h-0 flex-1">
                <button
                  type="button"
                  onClick={toggleRightPanel}
                  title="Collapse inspector"
                  className="flex w-6 shrink-0 items-center justify-center border-r border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Collapse inspector</span>
                </button>
                <div className="min-w-0 flex-1">
                  <PropertiesInspector page={currentPage} />
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      <StatusBar page={currentPage} />
    </div>
  );
}
