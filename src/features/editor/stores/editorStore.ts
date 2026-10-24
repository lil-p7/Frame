import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DragPayload, DropBand } from "@/features/editor/dnd/dropResolution";

/**
 * Central editor UI state (spec §7, §10, §34).
 *
 * This store holds *editor presentation* state only: viewport preset, editor
 * zoom, panel geometry, page-in-view, and selection. The document itself
 * stays in the persistence layer (Phase 3+ owns document mutations).
 *
 * Key invariant (Phase 2 acceptance): the document viewport width and the
 * editor zoom are independent. `zoom` scales the editor presentation; the
 * frame keeps its declared CSS width.
 */

export const VIEWPORT_PRESETS = [
  { id: "desktop", label: "Desktop", width: 1440 },
  { id: "laptop", label: "Laptop", width: 1280 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
] as const;

export type ViewportPresetId = (typeof VIEWPORT_PRESETS)[number]["id"];
export type ViewportSelection = ViewportPresetId | "custom";

/** Allowed custom viewport widths (preview widths, spec §10). */
export const MIN_VIEWPORT_WIDTH = 320;
export const MAX_VIEWPORT_WIDTH = 3840;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export const MIN_LEFT_PANEL_WIDTH = 200;
export const MAX_LEFT_PANEL_WIDTH = 420;
export const DEFAULT_LEFT_PANEL_WIDTH = 268;

export const MIN_RIGHT_PANEL_WIDTH = 240;
export const MAX_RIGHT_PANEL_WIDTH = 480;
export const DEFAULT_RIGHT_PANEL_WIDTH = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampViewportWidth(width: number): number {
  if (!Number.isFinite(width)) return VIEWPORT_PRESETS[0].width;
  return clamp(Math.round(width), MIN_VIEWPORT_WIDTH, MAX_VIEWPORT_WIDTH);
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return clamp(Math.round(zoom * 100) / 100, MIN_ZOOM, MAX_ZOOM);
}

/** Panel geometry + viewport preferences — the part persisted to localStorage. */
interface EditorPreferences {
  viewportSelection: ViewportSelection;
  customViewportWidth: number;
  zoom: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

export interface EditorState extends EditorPreferences {
  /** Page shown in the canvas; set from the loaded project's pages. */
  currentPageId: string | null;
  /** Selected component ID, or null when nothing is selected. */
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  setViewportPreset: (presetId: ViewportPresetId) => void;
  setCustomViewportWidth: (width: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToWorkspace: (workspaceWidth: number) => void;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  resetPanelLayout: () => void;

  setCurrentPage: (pageId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;

  /** Phase 6: ephemeral drag-and-drop state (never persisted, §13 UI state). */
  drag: DragUiState;
  setDragStart: (payload: DragPayload) => void;
  setDragOver: (over: DragOverUiState | null) => void;
  setDragEnd: () => void;
}

/** What a drag is carrying (library item or an existing node). */
export interface DragUiState {
  payload: DragPayload | null;
  /** Which surface the pointer is over: canvas or layer tree. */
  zone: "canvas" | "layer" | null;
  /** Component the pointer is over (root id for whole-page/empty drops). */
  overNodeId: string | null;
  /** Where relative to that component the drop would land. */
  band: DropBand;
  /** False: no valid outcome — surfaces render no indicator (§15). */
  valid: boolean;
}

export type DragOverUiState = Omit<DragUiState, "payload">;

const NO_DRAG: DragUiState = {
  payload: null,
  zone: null,
  overNodeId: null,
  band: "inside",
  valid: false,
};

const defaultPreferences: EditorPreferences = {
  viewportSelection: "desktop",
  customViewportWidth: 1440,
  zoom: 1,
  leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
};

/** Viewport-relevant slice of the preferences (all consumers need). */
export type ViewportPreferences = Pick<
  EditorPreferences,
  "viewportSelection" | "customViewportWidth"
>;

/** Resolved document viewport width in CSS pixels for the current selection. */
export function resolveViewportWidth(state: ViewportPreferences): number {
  if (state.viewportSelection === "custom") return state.customViewportWidth;
  const preset = VIEWPORT_PRESETS.find((p) => p.id === state.viewportSelection);
  return preset?.width ?? VIEWPORT_PRESETS[0].width;
}

const GAP_AND_PADDING = 48;

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      ...defaultPreferences,
      currentPageId: null,
      selectedNodeId: null,
      hoveredNodeId: null,

      setViewportPreset: (presetId) => {
        const preset = VIEWPORT_PRESETS.find((p) => p.id === presetId);
        if (preset === undefined) return;
        set({ viewportSelection: presetId });
      },

      setCustomViewportWidth: (width) =>
        set((state) => ({
          viewportSelection: "custom",
          customViewportWidth: clampViewportWidth(width),
          // Keep a stale preset value from leaking into the custom width.
          zoom: state.zoom,
        })),

      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

      zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),

      zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),

      resetZoom: () => set({ zoom: 1 }),

      /**
       * Fits the document viewport width to the visible canvas area.
       * Scales the editor presentation only — never the document's CSS width.
       */
      fitToWorkspace: (workspaceWidth) => {
        const state = get();
        const viewportWidth = resolveViewportWidth(state);
        const usable = workspaceWidth - GAP_AND_PADDING;
        if (!Number.isFinite(usable) || usable <= 0) return;
        set({ zoom: clampZoom(usable / viewportWidth) });
      },

      toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),

      toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

      setLeftPanelWidth: (width) =>
        set({
          leftPanelWidth: clamp(Math.round(width), MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH),
        }),

      setRightPanelWidth: (width) =>
        set({
          rightPanelWidth: clamp(Math.round(width), MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH),
        }),

      resetPanelLayout: () =>
        set({
          leftPanelWidth: defaultPreferences.leftPanelWidth,
          rightPanelWidth: defaultPreferences.rightPanelWidth,
          leftPanelCollapsed: false,
          rightPanelCollapsed: false,
        }),

      setCurrentPage: (pageId) => set({ currentPageId: pageId }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId, hoveredNodeId: null }),

      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

      drag: NO_DRAG,

      setDragStart: (payload) => set({ drag: { ...NO_DRAG, payload } }),

      setDragOver: (over) =>
        set((state) => ({
          drag:
            over === null
              ? { ...state.drag, overNodeId: null, valid: false }
              : { ...state.drag, ...over },
        })),

      setDragEnd: () => set({ drag: NO_DRAG }),
    }),
    {
      name: "frame.editor.preferences",
      version: 1,
      // Selection and page-in-view are per-session; preferences are durable.
      partialize: (state) => ({
        viewportSelection: state.viewportSelection,
        customViewportWidth: state.customViewportWidth,
        zoom: state.zoom,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        leftPanelCollapsed: state.leftPanelCollapsed,
        rightPanelCollapsed: state.rightPanelCollapsed,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<EditorPreferences>;
        return {
          ...current,
          viewportSelection: saved.viewportSelection ?? current.viewportSelection,
          customViewportWidth: clampViewportWidth(
            saved.customViewportWidth ?? current.customViewportWidth,
          ),
          zoom: clampZoom(saved.zoom ?? current.zoom),
          leftPanelWidth: clamp(
            saved.leftPanelWidth ?? current.leftPanelWidth,
            MIN_LEFT_PANEL_WIDTH,
            MAX_LEFT_PANEL_WIDTH,
          ),
          rightPanelWidth: clamp(
            saved.rightPanelWidth ?? current.rightPanelWidth,
            MIN_RIGHT_PANEL_WIDTH,
            MAX_RIGHT_PANEL_WIDTH,
          ),
          leftPanelCollapsed: saved.leftPanelCollapsed ?? false,
          rightPanelCollapsed: saved.rightPanelCollapsed ?? false,
        };
      },
    },
  ),
);

/** Restores panel/viewport preferences to defaults (used by settings + tests). */
export function resetEditorPreferences(): void {
  useEditorStore.getState().resetPanelLayout();
  useEditorStore.setState({
    viewportSelection: defaultPreferences.viewportSelection,
    customViewportWidth: defaultPreferences.customViewportWidth,
    zoom: defaultPreferences.zoom,
  });
}
