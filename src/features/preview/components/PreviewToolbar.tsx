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
    "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-zinc-950 px-3">
      <Link
        to={editorPath(project.id)}
        data-testid="back-to-editor"
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to editor
      </Link>

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold text-zinc-100">
          {project.name}
        </span>
        <span className="truncate text-[11px] text-zinc-500" data-testid="preview-page-name">
          {page.name}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">Page</span>
          <select
            value={page.id}
            onChange={(event) => onSelectPage(event.target.value)}
            aria-label="Preview page"
            className="h-7 max-w-40 truncate rounded border border-line bg-zinc-900 px-1.5 text-xs text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            {project.pages.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <div
          className="flex items-center gap-0.5 rounded border border-line p-0.5"
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
                    "bg-white/10 text-accent hover:bg-white/15 hover:text-accent",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">{preset.label} viewport</span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1 text-xs text-zinc-500">
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
            className="h-7 w-16 rounded border border-line bg-zinc-900 px-1.5 text-center text-xs tabular-nums text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
          <span aria-hidden="true">px</span>
        </label>
      </div>
    </header>
  );
}
