import { Link } from "react-router-dom";
import { ArrowLeft, Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FramePage, FrameProject } from "@/features/document/model";
import { editorPath } from "@/features/preview/paths";
import {
  VIEWPORT_PRESETS,
  resolveViewportWidth,
  useEditorStore,
  type ViewportPresetId,
} from "@/features/editor/stores/editorStore";

const PRESET_ICONS: Record<ViewportPresetId, typeof Monitor> = {
  desktop: Monitor,
  laptop: Laptop,
  tablet: Tablet,
  mobile: Smartphone,
};

interface PreviewToolbarProps {
  project: FrameProject;
  page: FramePage;
  /** Switches the previewed page without leaving preview mode (spec §22). */
  onSelectPage: (pageId: string) => void;
}

/**
 * Preview chrome (spec §22): the only Frame UI visible in preview mode.
 * Provides the return-to-editor action, page switching, and the viewport
 * width — never page content controls.
 *
 * The viewport selection is the editor's own preference, so preview opens at
 * the width the page was being edited at (spec §13E). Changing it here only
 * changes preview presentation: the document is untouched (§16).
 */
export function PreviewToolbar({ project, page, onSelectPage }: PreviewToolbarProps) {
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const setViewportPreset = useEditorStore((s) => s.setViewportPreset);
  const setCustomViewportWidth = useEditorStore((s) => s.setCustomViewportWidth);

  const resolvedWidth = resolveViewportWidth({ viewportSelection, customViewportWidth });
  const iconButton =
    "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        to={editorPath(project.id)}
        data-testid="back-to-editor"
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to editor
      </Link>

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {project.name}
        </span>
        <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" data-testid="preview-page-name">
          {page.name}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Page</span>
          <select
            value={page.id}
            onChange={(event) => onSelectPage(event.target.value)}
            aria-label="Preview page"
            className="h-7 max-w-40 truncate rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {project.pages.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <div
          className="flex items-center gap-0.5 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700"
          role="group"
          aria-label="Preview viewport"
        >
          {VIEWPORT_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id];
            const active = viewportSelection === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setViewportPreset(preset.id)}
                aria-pressed={active}
                title={`${preset.label} viewport (${preset.width}px)`}
                className={cn(
                  iconButton,
                  active &&
                    "bg-blue-600/10 text-blue-700 hover:bg-blue-600/15 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/25 dark:hover:text-blue-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">{preset.label} viewport</span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="sr-only">Preview viewport width in pixels</span>
          <input
            type="number"
            min={320}
            max={3840}
            value={Math.round(resolvedWidth)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (event.target.value.trim() !== "" && Number.isFinite(parsed)) {
                setCustomViewportWidth(parsed);
              }
            }}
            className="h-7 w-16 rounded border border-zinc-200 bg-white px-1.5 text-center text-xs tabular-nums text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <span aria-hidden="true">px</span>
        </label>
      </div>
    </header>
  );
}
