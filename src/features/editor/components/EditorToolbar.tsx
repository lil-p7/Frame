import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, Loader2, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { FrameMark } from "@/features/dashboard/components/FrameMark";
import { ViewportControls } from "@/features/editor/components/ViewportControls";
import { PageMenu } from "@/features/editor/components/PageMenu";
import type { PageCommands } from "@/features/editor/usePageCommands";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import { validateProjectName, type FrameProject } from "@/features/document/model";
import { renameProject } from "@/features/projects/services/projectService";
import type { ProjectRepository } from "@/features/projects/types";

/** Save indicator states (spec §8). "Saved" is only shown after a successful read/write. */
type SaveStatus = "saved" | "saving" | "failed";

interface EditorToolbarProps {
  project: FrameProject;
  repository: ProjectRepository;
  onProjectRenamed: (project: FrameProject) => void;
  /** Fits the document viewport to the visible canvas (wired to the canvas ref). */
  onFitToWorkspace: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Page management actions for the current page (spec §20). */
  pageCommands: PageCommands;
}

const toolbarButton =
  "inline-flex h-7 items-center justify-center rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

/**
 * Top application toolbar (spec §8): identity + inline project rename +
 * save status on the left, history/page/viewport controls in the center,
 * preview/export on the right.
 *
 * Undo/redo drive the page history engine (Phase 7) and disable honestly
 * when the page has nothing to undo or redo. Preview/export arrive in
 * Phase 10 and stay visibly disabled instead of pretending to work.
 */
export function EditorToolbar({
  project,
  repository,
  onProjectRenamed,
  onFitToWorkspace,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  pageCommands,
}: EditorToolbarProps) {
  const pages = project.pages;
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the displayed name in sync when the project changes underneath us.
  useEffect(() => {
    if (!editingName) setNameDraft(project.name);
  }, [project.name, editingName]);

  useEffect(() => {
    if (editingName) inputRef.current?.select();
  }, [editingName]);

  const startEditing = (): void => {
    setNameDraft(project.name);
    setNameError(null);
    setEditingName(true);
  };

  const cancelEditing = (): void => {
    setEditingName(false);
    setNameDraft(project.name);
    setNameError(null);
  };

  const commitName = async (): Promise<void> => {
    const error = validateProjectName(nameDraft);
    if (error !== null) {
      setNameError(error);
      inputRef.current?.focus();
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed === project.name) {
      cancelEditing();
      return;
    }

    setSaveStatus("saving");
    try {
      const updated = await renameProject(repository, project.id, trimmed);
      onProjectRenamed(updated);
      setSaveStatus("saved");
      setEditingName(false);
      setNameError(null);
    } catch {
      // Never claim a save that did not happen; keep the draft on screen.
      setSaveStatus("failed");
      setNameError("The new name could not be saved. Your text was kept — try again.");
      toast.error("Rename failed — your changes were not saved.");
    }
  };

  const statusContent: Record<SaveStatus, { label: string; icon: typeof Check }> = {
    saved: { label: "Saved", icon: Check },
    saving: { label: "Saving…", icon: Loader2 },
    failed: { label: "Save failed", icon: AlertTriangle },
  };
  const status = statusContent[saveStatus];
  const StatusIcon = status.icon;

  const currentPage = pages.find((p) => p.id === currentPageId) ?? pages[0];

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Left: identity, project name, save status */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/"
          title="Back to projects"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Back to projects</span>
        </Link>
        <FrameMark className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-500" />

        {editingName ? (
          <div className="flex min-w-0 flex-col">
            <input
              ref={inputRef}
              value={nameDraft}
              aria-label="Project name"
              aria-invalid={nameError !== null}
              onChange={(event) => {
                setNameDraft(event.target.value);
                setNameError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitName();
                if (event.key === "Escape") cancelEditing();
              }}
              onBlur={() => {
                // Escape handles cancellation explicitly; a blur with an
                // invalid draft just reverts rather than trapping focus.
                if (validateProjectName(nameDraft) !== null) cancelEditing();
                else void commitName();
              }}
              className="h-7 w-44 rounded border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {nameError !== null && (
              <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                {nameError}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            title="Rename project"
            className="min-w-0 max-w-52 truncate rounded px-2 py-1 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {project.name}
          </button>
        )}

        <span
          data-testid="save-status"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px]",
            saveStatus === "saved" && "text-zinc-500 dark:text-zinc-400",
            saveStatus === "saving" && "text-zinc-500 dark:text-zinc-400",
            saveStatus === "failed" && "text-red-600 dark:text-red-400",
          )}
          role="status"
          title={
            saveStatus === "failed"
              ? "The last save did not succeed"
              : "Persistence status for this project"
          }
        >
          <StatusIcon
            className={cn("h-3.5 w-3.5", saveStatus === "saving" && "animate-spin")}
            aria-hidden="true"
          />
          {status.label}
        </span>
      </div>

      {/* Center: history, page, viewport controls */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
        <button
          type="button"
          data-testid="undo"
          onClick={onUndo}
          disabled={!canUndo}
          aria-disabled={!canUndo}
          aria-keyshortcuts="Control+Z Meta+Z"
          title="Undo (Ctrl/Cmd + Z)"
          className={toolbarButton}
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Undo</span>
        </button>
        <button
          type="button"
          data-testid="redo"
          onClick={onRedo}
          disabled={!canRedo}
          aria-disabled={!canRedo}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          title="Redo (Ctrl/Cmd + Shift + Z or Ctrl + Y)"
          className={toolbarButton}
        >
          <Redo2 className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Redo</span>
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" role="separator" />

        <label className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Page</span>
          <select
            value={currentPage?.id ?? ""}
            onChange={(event) => setCurrentPage(event.target.value)}
            aria-label="Current page"
            className="h-7 max-w-40 truncate rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
        </label>

        {currentPage !== undefined && (
          <PageMenu pages={pages} currentPage={currentPage} commands={pageCommands} />
        )}

        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" role="separator" />

        <ViewportControls onFitToWorkspace={onFitToWorkspace} />
      </div>

      {/* Right: preview/export arrive in Phase 10 — shown disabled, not fake. */}
      <div className="flex items-center gap-1">
        <span title="Preview mode arrives in Phase 10 (preview and export)">
          <button type="button" disabled className={toolbarButton} aria-disabled="true">
            Preview
          </button>
        </span>
        <span title="Export arrives in Phase 10 (preview and export)">
          <button type="button" disabled className={toolbarButton} aria-disabled="true">
            Export
          </button>
        </span>
      </div>
    </header>
  );
}
