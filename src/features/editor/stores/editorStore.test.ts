import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_LEFT_PANEL_WIDTH,
  MAX_VIEWPORT_WIDTH,
  MAX_ZOOM,
  MIN_LEFT_PANEL_WIDTH,
  MIN_VIEWPORT_WIDTH,
  MIN_ZOOM,
  MIN_RIGHT_PANEL_WIDTH,
  resetEditorPreferences,
  resolveViewportWidth,
  useEditorStore,
} from "./editorStore";

beforeEach(() => {
  localStorage.clear();
  resetEditorPreferences();
  useEditorStore.setState({ currentPageId: null, selectedNodeId: null, hoveredNodeId: null });
});

describe("viewport", () => {
  it("resolves preset widths and switches to custom width", () => {
    expect(resolveViewportWidth(useEditorStore.getState())).toBe(1440);

    useEditorStore.getState().setViewportPreset("mobile");
    expect(resolveViewportWidth(useEditorStore.getState())).toBe(390);

    useEditorStore.getState().setViewportPreset("tablet");
    expect(resolveViewportWidth(useEditorStore.getState())).toBe(768);
  });

  it("clamps custom widths to supported preview range", () => {
    useEditorStore.getState().setCustomViewportWidth(120);
    expect(useEditorStore.getState().viewportSelection).toBe("custom");
    expect(useEditorStore.getState().customViewportWidth).toBe(MIN_VIEWPORT_WIDTH);

    useEditorStore.getState().setCustomViewportWidth(99_999);
    expect(useEditorStore.getState().customViewportWidth).toBe(MAX_VIEWPORT_WIDTH);

    useEditorStore.getState().setCustomViewportWidth(Number.NaN);
    expect(useEditorStore.getState().customViewportWidth).toBe(1440);
  });
});

describe("zoom", () => {
  it("clamps zoom to the allowed range", () => {
    useEditorStore.getState().setZoom(50);
    expect(useEditorStore.getState().zoom).toBe(MAX_ZOOM);

    useEditorStore.getState().setZoom(0.01);
    expect(useEditorStore.getState().zoom).toBe(MIN_ZOOM);

    useEditorStore.getState().setZoom(Number.NaN);
    expect(useEditorStore.getState().zoom).toBe(1);
  });

  it("steps in, out, and resets", () => {
    useEditorStore.getState().zoomIn();
    expect(useEditorStore.getState().zoom).toBe(1.25);
    useEditorStore.getState().zoomOut();
    expect(useEditorStore.getState().zoom).toBe(1);
    useEditorStore.getState().zoomIn();
    useEditorStore.getState().resetZoom();
    expect(useEditorStore.getState().zoom).toBe(1);
  });

  it("fit scales presentation only — viewport width is untouched", () => {
    useEditorStore.getState().setViewportPreset("desktop");
    useEditorStore.getState().fitToWorkspace(768);
    const state = useEditorStore.getState();
    // (768 - 48 padding) / 1440 = 0.5
    expect(state.zoom).toBe(0.5);
    // The document keeps its CSS width regardless of zoom.
    expect(resolveViewportWidth(state)).toBe(1440);
  });

  it("fit ignores unusable measurements", () => {
    const before = useEditorStore.getState().zoom;
    useEditorStore.getState().fitToWorkspace(0);
    expect(useEditorStore.getState().zoom).toBe(before);
    useEditorStore.getState().fitToWorkspace(Number.NaN);
    expect(useEditorStore.getState().zoom).toBe(before);
  });
});

describe("panels", () => {
  it("clamps widths to sensible bounds", () => {
    useEditorStore.getState().setLeftPanelWidth(10);
    expect(useEditorStore.getState().leftPanelWidth).toBe(MIN_LEFT_PANEL_WIDTH);
    useEditorStore.getState().setLeftPanelWidth(5000);
    expect(useEditorStore.getState().leftPanelWidth).toBe(MAX_LEFT_PANEL_WIDTH);
    useEditorStore.getState().setRightPanelWidth(10);
    expect(useEditorStore.getState().rightPanelWidth).toBe(MIN_RIGHT_PANEL_WIDTH);
  });

  it("toggles and resets collapse state", () => {
    expect(useEditorStore.getState().leftPanelCollapsed).toBe(false);
    useEditorStore.getState().toggleLeftPanel();
    expect(useEditorStore.getState().leftPanelCollapsed).toBe(true);
    useEditorStore.getState().resetPanelLayout();
    expect(useEditorStore.getState().leftPanelCollapsed).toBe(false);
  });

  it("persists panel preferences but not session-only state", () => {
    useEditorStore.getState().setLeftPanelWidth(321);
    useEditorStore.getState().selectNode("some-node");

    const stored = JSON.parse(localStorage.getItem("frame.editor.preferences") ?? "{}") as {
      state?: Record<string, unknown>;
    };
    expect(stored.state?.leftPanelWidth).toBe(321);
    expect(stored.state).not.toHaveProperty("selectedNodeId");
    expect(stored.state).not.toHaveProperty("currentPageId");
  });
});
