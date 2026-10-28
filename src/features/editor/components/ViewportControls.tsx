import { useState } from "react";
import { Maximize2, Minus, Monitor, Laptop, Plus, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  MAX_ZOOM,
  MIN_ZOOM,
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

interface ViewportControlsProps {
  /** Fits the document viewport to the visible canvas area (spec §10). */
  onFitToWorkspace: () => void;
}

/**
 * Center-toolbar viewport presets (Desktop 1440 / Laptop 1280 / Tablet 768 /
 * Mobile 390 plus a custom width) and zoom controls (spec §8, §10).
 *
 * Presets and zoom only change editor presentation: the document frame keeps
 * its declared CSS width regardless of zoom (Phase 2 acceptance criterion).
 */
export function ViewportControls({ onFitToWorkspace }: ViewportControlsProps) {
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const zoom = useEditorStore((s) => s.zoom);
  const setViewportPreset = useEditorStore((s) => s.setViewportPreset);
  const setCustomViewportWidth = useEditorStore((s) => s.setCustomViewportWidth);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetZoom = useEditorStore((s) => s.resetZoom);

  const resolvedWidth = resolveViewportWidth({
    viewportSelection,
    customViewportWidth,
  });

  /*
   * Typing "500" must not be clobbered by re-resolving the width on every
   * keystroke ("5" alone clamps to the minimum, which would rewrite the
   * field mid-word). Keep the raw text while focused; commit numbers that
   * parse, and reconcile to the resolved width on blur.
   */
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const shownWidth = widthDraft ?? String(Math.round(resolvedWidth));

  const iconButton =
    "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Viewport and zoom">
      <div className="flex items-center gap-0.5 rounded border border-line p-0.5">
        {VIEWPORT_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.id];
          const active = viewportSelection === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setWidthDraft(null);
                setViewportPreset(preset.id);
              }}
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

      <label className="ml-1 flex items-center gap-1 text-xs text-zinc-500">
        <span className="sr-only">Custom viewport width in pixels</span>
        <input
          type="number"
          min={320}
          max={3840}
          value={shownWidth}
          onChange={(event) => {
            const raw = event.target.value;
            setWidthDraft(raw);
            const parsed = Number(raw);
            if (raw.trim() !== "" && Number.isFinite(parsed)) {
              setCustomViewportWidth(parsed);
            }
          }}
          onBlur={() => setWidthDraft(null)}
          className="h-7 w-16 rounded border border-line bg-zinc-900 px-1.5 text-center text-xs tabular-nums text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        <span aria-hidden="true">px</span>
      </label>

      <span
        className="mx-1 h-5 w-px bg-zinc-700"
        role="separator"
        aria-orientation="vertical"
      />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out"
          className={iconButton}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Zoom out</span>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          aria-label="Reset zoom to 100%"
          title="Reset zoom to 100%"
          className="h-7 min-w-11 rounded px-1 text-xs tabular-nums text-zinc-400 hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in"
          className={iconButton}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Zoom in</span>
        </button>
        <button
          type="button"
          onClick={onFitToWorkspace}
          title="Fit page to workspace"
          className={iconButton}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Fit page to workspace</span>
        </button>
      </div>
    </div>
  );
}
