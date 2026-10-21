import type { RefObject } from "react";
import { ROOT_NODE_TYPE, type FrameNode, type FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import { resolveViewportWidth, useEditorStore } from "@/features/editor/stores/editorStore";

interface CanvasWorkspaceProps {
  page: FramePage;
  /** Shared so the toolbar's "fit" control can measure the visible area. */
  scrollerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Central canvas workspace (spec §10, §12 "Rendering architecture").
 *
 * Nodes render recursively through the component registry: resolve
 * definition → validate → render its element → render children in stored
 * order → add editor overlays (this wrapper) only in editor mode. Unknown
 * types render a controlled fallback that preserves the original data
 * instead of guessing at HTML.
 *
 * Zoom uses the CSS `zoom` property: the document frame keeps its declared
 * width (Phase 2 acceptance), only presentation scales.
 */
export function CanvasWorkspace({ page, scrollerRef }: CanvasWorkspaceProps) {
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const zoom = useEditorStore((s) => s.zoom);
  const selectNode = useEditorStore((s) => s.selectNode);

  const viewportWidth = resolveViewportWidth({ viewportSelection, customViewportWidth });

  return (
    <div
      ref={scrollerRef}
      data-testid="canvas-workspace"
      role="presentation"
      onClick={() => selectNode(null)}
      className="relative h-full min-w-0 flex-1 overflow-auto bg-zinc-200 p-8 dark:bg-zinc-900"
      style={{ display: "flex", alignItems: "flex-start", justifyContent: "center" }}
    >
      {/*
        The document frame: declared width in CSS pixels; `zoom` scales only
        the editor presentation (the specified width never changes).
      */}
      <div
        data-testid="document-viewport"
        style={{
          width: `${viewportWidth}px`,
          zoom,
          backgroundColor: page.settings.backgroundColor,
        }}
        className="min-h-[640px] shrink-0 shadow-lg ring-1 ring-zinc-300/80 dark:ring-zinc-700"
      >
        {page.root.children.length === 0 ? (
          <div
            data-testid="canvas-empty-state"
            className="flex h-full min-h-[640px] flex-col items-center justify-center gap-2 px-8 text-center"
          >
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              This page is empty
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Components can be added from the Components tab in the left sidebar once the component
              library ships (Phase 4). Dropping onto this canvas will work then too.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[640px] flex-col gap-2 p-4" data-testid="canvas-document">
            {page.root.children.map((node) => (
              <CanvasNodeView key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One node's editor view: definition-rendered element inside the editor
 * overlay wrapper (selection outline, label, click/hover handling).
 * The wrapper is editor chrome and never appears in preview or export.
 */
function CanvasNodeView({ node }: { node: FrameNode }) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const hoveredNodeId = useEditorStore((s) => s.hoveredNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setHoveredNode = useEditorStore((s) => s.setHoveredNode);

  // Hidden components never appear on the canvas (spec §9C).
  if (node.editor.hidden) return null;

  const definition = getComponent(node.type);
  const selected = selectedNodeId === node.id;
  const hovered = hoveredNodeId === node.id;
  // The root container is structural; locked components ignore ordinary
  // canvas clicks (spec §10 selection behavior).
  const selectable = node.type !== ROOT_NODE_TYPE && !node.editor.locked;

  const children = definition?.acceptsChildren
    ? node.children.map((child) => <CanvasNodeView key={child.id} node={child} />)
    : null;

  const content =
    definition !== undefined ? (
      definition.renderEditor(node, children)
    ) : (
      <UnknownComponentView node={node} />
    );

  return (
    <div
      data-testid="canvas-node"
      data-node-id={node.id}
      data-node-type={node.type}
      data-selected={selected ? "true" : "false"}
      onClick={(event) => {
        event.stopPropagation();
        if (selectable) selectNode(node.id);
      }}
      onMouseEnter={() => setHoveredNode(node.id)}
      onMouseLeave={() => setHoveredNode(null)}
      className="relative"
      style={{
        boxShadow: selected
          ? "0 0 0 1px rgba(255,255,255,0.9), 0 0 0 3px var(--frame-accent)"
          : hovered
            ? "0 0 0 1px rgba(255,255,255,0.7), 0 0 0 2px rgba(113,113,122,0.6)"
            : undefined,
        cursor: selectable ? "default" : "not-allowed",
      }}
    >
      {(selected || hovered) && (
        <span
          data-testid="canvas-node-label"
          className="pointer-events-none absolute -top-2.5 left-2 z-10 rounded bg-zinc-900/85 px-1.5 py-px text-[10px] font-medium text-zinc-100"
        >
          {node.name}
        </span>
      )}
      {content}
    </div>
  );
}

/**
 * Controlled fallback for unregistered types (spec §12): never rendered as
 * arbitrary HTML, and the original node data stays untouched.
 */
function UnknownComponentView({ node }: { node: FrameNode }) {
  return (
    <div
      data-testid="unknown-component"
      className="rounded-sm border border-dashed border-amber-500/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      Unknown component <span className="font-mono">{node.type}</span> — kept as-is so no data is
      lost. Remove it or open this project with a version that supports it.
    </div>
  );
}
