import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import type { FramePage, FrameProject } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { findNode } from "@/features/document/traversal";
import {
  bandFromPointerRatio,
  effectiveBand,
  pointerYFrom,
  resolveDropTarget,
  type DragPayload,
  type DropBand,
} from "@/features/editor/dnd/dropResolution";
import { CanvasWorkspace } from "@/features/editor/components/CanvasWorkspace";
import { ComponentSidebar } from "@/features/editor/components/ComponentSidebar";
import { EditorToolbar } from "@/features/editor/components/EditorToolbar";
import { PanelResizeHandle } from "@/features/editor/components/PanelResizeHandle";
import { PropertiesInspector } from "@/features/editor/components/PropertiesInspector";
import { StatusBar } from "@/features/editor/components/StatusBar";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import { useCanRedo, useCanUndo, useHistoryStore } from "@/features/editor/stores/historyStore";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { usePageCommands } from "@/features/editor/usePageCommands";
import { useAssetUrls } from "@/features/assets/hooks/useAssetUrls";
import type { ProjectRepository } from "@/features/projects/types";

/** Below this width the sidebars auto-collapse once so the canvas stays usable. */
const COMPACT_BREAKPOINT = 900;

/**
 * Nearest canvas node to a client Y coordinate, used when the pointer is in
 * page-level empty space (gaps, padding) while over the canvas page zone.
 * Returns null when layout is unavailable (e.g. jsdom without mocks) so
 * callers keep the safe append-at-root fallback.
 */
function nearestCanvasChild(pointerY: number): { nodeId: string; ratio: number } | null {
  const elements = document.querySelectorAll<HTMLElement>(
    '[data-testid="canvas-node"][data-node-id]',
  );
  let best: { nodeId: string; ratio: number; dist: number } | null = null;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) return null;
    const nodeId = element.dataset.nodeId;
    if (nodeId === undefined) continue;
    if (pointerY >= rect.top && pointerY <= rect.bottom) {
      return { nodeId, ratio: (pointerY - rect.top) / rect.height };
    }
    const dist = Math.min(Math.abs(pointerY - rect.top), Math.abs(pointerY - rect.bottom));
    if (best === null || dist < best.dist) {
      best = { nodeId, ratio: pointerY < rect.top ? 0 : 1, dist };
    }
  }
  return best;
}

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
  // Non-null view of the page for the drag handlers defined below the guard.
  const activePage = currentPage ?? project.pages[0]!;

  // Phase 4 editing flow: commands mutate the document, persist it, and keep
  // selection valid (spec §9A, §9C, §13). Stored here so every panel shares it.
  const pageCommands = usePageCommands({
    page: currentPage ?? project.pages[0]!,
    project,
    repository,
    onProjectChanged,
  });

  // Phase 7 history: undo/redo availability for the page in view. Each page
  // has its own stack, so switching pages never applies the wrong history
  // (spec §14); loading a different project starts a fresh session.
  const historyPageId = currentPage?.id ?? null;
  const canUndo = useCanUndo(historyPageId);
  const canRedo = useCanRedo(historyPageId);
  // Stored image assets resolve to object URLs for canvas and inspector (§19).
  const assetUrls = useAssetUrls(repository, project.assets);
  const clearHistory = useHistoryStore((s) => s.clearAll);
  useEffect(() => {
    clearHistory();
  }, [project.id, clearHistory]);

  // Keyboard shortcuts (spec §25). They are ignored inside text fields and
  // only consume browser shortcuts when the editor performed the action.
  useEditorShortcuts({
    undo: pageCommands.undo,
    redo: pageCommands.redo,
    duplicate: pageCommands.duplicateSelected,
    deleteSelected: pageCommands.deleteSelected,
    copy: pageCommands.copySelected,
    paste: pageCommands.pasteClipboard,
    clearSelection: () => {
      const editor = useEditorStore.getState();
      if (editor.selectedNodeId === null) return false;
      editor.selectNode(null);
      return true;
    },
  });

  // Phase 6: one dnd-kit context drives library→canvas, library→layers, and
  // node moves across both surfaces (spec §15). The document only changes in
  // `onDragEnd` with a valid resolved target — cancelled and invalid drags
  // are non-mutating by construction.
  const setDragStart = useEditorStore((s) => s.setDragStart);
  const setDragOver = useEditorStore((s) => s.setDragOver);
  const setDragEnd = useEditorStore((s) => s.setDragEnd);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /**
   * Resolves a drag event into the component the pointer is over plus the
   * band (before/inside/after) — shared by `onDragOver` (indicators) and
   * `onDragEnd` (commit) so both always agree.
   */
  const resolveOver = useCallback(
    (
      event: DragOverEvent | DragEndEvent,
    ): { overNodeId: string; band: DropBand; ratio: number } | null => {
      const over = event.over;
      if (over === null) return null;
      const data = over.data.current as { zone?: "canvas" | "layer"; nodeId?: string } | null;
      const zone = data?.zone;
      let overNodeId = data?.nodeId;
      if (zone === undefined || overNodeId === undefined) return null;

      const pointerY = pointerYFrom(event.activatorEvent, event.delta.y);
      const rect = over.rect;
      let ratio =
        rect !== null && rect.height > 0 && pointerY !== null
          ? (pointerY - rect.top) / rect.height
          : 0.5;
      let band = bandFromPointerRatio(ratio);

      // Canvas page zone with children: the gaps between children are their
      // own empty space (spec §15 explicit zones) — resolve the nearest
      // child so a gap drop becomes a before/after position instead of
      // silently appending at the end of the page.
      if (
        zone === "canvas" &&
        overNodeId === activePage.root.id &&
        activePage.root.children.length > 0 &&
        pointerY !== null
      ) {
        const nearest = nearestCanvasChild(pointerY);
        if (nearest !== null) {
          overNodeId = nearest.nodeId;
          ratio = nearest.ratio;
          band = bandFromPointerRatio(ratio);
        }
      }

      return { overNodeId, band, ratio };
    },
    [activePage],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const payload = event.active.data.current as DragPayload | null | undefined;
      if (payload === undefined || payload === null) return;
      setDragStart(payload);
    },
    [setDragStart],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const payload = event.active.data.current as DragPayload | null | undefined;
      const resolved = resolveOver(event);
      if (payload === undefined || payload === null || resolved === null) {
        setDragOver(null);
        return;
      }
      const zone = (event.over?.data.current as { zone?: "canvas" | "layer" } | null)?.zone ?? null;
      const valid =
        resolveDropTarget(
          activePage,
          payload,
          resolved.overNodeId,
          resolved.band,
          resolved.ratio,
        ) !== null;
      // Indicators show the band that will actually commit (§15): "inside"
      // over an incompatible target is already degraded to the nearer edge.
      const band = effectiveBand(
        activePage,
        payload,
        resolved.overNodeId,
        resolved.band,
        resolved.ratio,
      );
      setDragOver({
        zone,
        overNodeId: resolved.overNodeId,
        band: band ?? resolved.band,
        valid,
      });
    },
    [activePage, resolveOver, setDragOver],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const payload = event.active.data.current as DragPayload | null | undefined;
      const resolved = payload === undefined || payload === null ? null : resolveOver(event);
      setDragEnd();
      if (payload === undefined || payload === null || resolved === null) return;
      const target = resolveDropTarget(
        activePage,
        payload,
        resolved.overNodeId,
        resolved.band,
        resolved.ratio,
      );
      // Invalid drop: rejected without touching the document (§15).
      if (target === null) return;
      // One completed drag = one command = one persistence write (§14: one
      // history entry, wired when history lands in Phase 7).
      if (payload.kind === "library") {
        pageCommands.insertComponentAt(payload.componentType, target.parentId, target.index);
      } else {
        pageCommands.moveLayer(payload.nodeId, target.parentId, target.index);
      }
    },
    [activePage, pageCommands, resolveOver, setDragEnd],
  );

  const handleDragCancel = useCallback(() => {
    // Escape or a dropped-outside drag: no mutation ever happened.
    setDragEnd();
  }, [setDragEnd]);

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
        onUndo={pageCommands.undo}
        onRedo={pageCommands.redo}
        canUndo={canUndo}
        canRedo={canRedo}
        pageCommands={pageCommands}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
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
                    <ComponentSidebar page={currentPage} commands={pageCommands} />
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

          <CanvasWorkspace
            page={currentPage}
            scrollerRef={canvasRef}
            assetUrls={assetUrls}
            onInsertFirstSection={() => pageCommands.insertComponent("section")}
          />

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
                    <PropertiesInspector
                      page={currentPage}
                      commands={pageCommands}
                      pages={project.pages}
                      assetUrls={assetUrls}
                    />
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          <DragOverlayContent page={currentPage} />
        </DragOverlay>
      </DndContext>

      <StatusBar page={currentPage} />
    </div>
  );
}

/**
 * Drag preview host that owns its own subscription to the drag payload.
 *
 * `drag.over` changes on every pointer move during a drag; keeping that
 * subscription out of `EditorShell` means the per-move updates re-render only
 * this overlay and the surfaces drawing drop indicators — never the toolbar,
 * sidebars, and status bar (spec §30: property changes and dragging must not
 * cause unnecessary full-editor rerenders). The overlay itself renders once
 * per drag because `payload` only changes on start/end.
 */
function DragOverlayContent({ page }: { page: FramePage }) {
  const payload = useEditorStore((s) => s.drag.payload);
  if (payload === null) return null;
  return <DragOverlayCard payload={payload} page={page} />;
}

/** Temporary drag preview (spec §15): never rendered into the document. */
function DragOverlayCard({ payload, page }: { payload: DragPayload; page: FramePage }) {
  const definition = payload.kind === "library" ? getComponent(payload.componentType) : undefined;
  const nodeName =
    payload.kind === "node" ? (findNode(page.root, payload.nodeId)?.name ?? null) : null;
  const Icon = definition?.icon;
  const label = definition?.label ?? nodeName ?? "";
  return (
    <div
      data-testid="drag-overlay"
      className="pointer-events-none flex items-center gap-1.5 rounded border border-blue-400 bg-white/95 px-2 py-1 text-xs font-medium text-zinc-800 shadow-lg dark:bg-zinc-900/95 dark:text-zinc-100"
    >
      {Icon !== undefined && (
        <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      )}
      {label}
    </div>
  );
}
