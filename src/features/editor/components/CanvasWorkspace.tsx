import type { RefObject } from "react";
import { GripVertical } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ROOT_NODE_TYPE,
  type FrameNode,
  type FramePage,
  type StyleBreakpoint,
} from "@/features/document/model";
import { breakpointForWidth, withResolvedStyles } from "@/features/document/responsive";
import { resolveNodeAssetSrc } from "@/features/assets/service";
import { getComponent } from "@/features/component-registry/registry";
import type { DragPayload } from "@/features/editor/dnd/dropResolution";
import { resolveViewportWidth, useEditorStore } from "@/features/editor/stores/editorStore";
import { cn } from "@/lib/cn";

interface CanvasWorkspaceProps {
  page: FramePage;
  /** Shared so the toolbar's "fit" control can measure the visible area. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Object URLs for the project's stored image assets (spec §19). */
  assetUrls?: Readonly<Record<string, string>>;
  /** Optional click-to-insert action for the empty-canvas call to action (spec §10). */
  onInsertFirstSection?: () => void;
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
export function CanvasWorkspace({
  page,
  scrollerRef,
  assetUrls = {},
  onInsertFirstSection,
}: CanvasWorkspaceProps) {
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const zoom = useEditorStore((s) => s.zoom);
  const selectNode = useEditorStore((s) => s.selectNode);
  const drag = useEditorStore((s) => s.drag);

  const viewportWidth = resolveViewportWidth({ viewportSelection, customViewportWidth });
  // Breakpoint styles shown on the canvas are exactly the ones the document
  // resolves at this width (spec §16): the editor is the live CSS behavior.
  const breakpoint = breakpointForWidth(viewportWidth);

  // The whole page boundary is a droppable zone: drops on empty pages,
  // padding, or between children resolve through it (spec §10, §15).
  const { setNodeRef: setPageDroppableRef } = useDroppable({
    id: "canvas-page",
    data: { zone: "canvas", nodeId: page.root.id },
  });
  const pageZoneActive = drag.zone === "canvas" && drag.overNodeId === page.root.id && drag.valid;

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
        ref={setPageDroppableRef}
        data-testid="document-viewport"
        data-breakpoint={breakpoint}
        style={{
          width: `${viewportWidth}px`,
          zoom,
          backgroundColor: page.settings.backgroundColor,
        }}
        className={cn(
          "min-h-[640px] shrink-0 shadow-lg ring-1 ring-zinc-300/80 dark:ring-zinc-700",
          // Drop indicator: "lands at the end of the page" (§15).
          pageZoneActive && "ring-2 ring-blue-500/70",
        )}
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
              Add components from the Components tab in the left sidebar, or start with a section:
            </p>
            {onInsertFirstSection !== undefined && (
              <button
                type="button"
                data-testid="canvas-insert-section"
                onClick={onInsertFirstSection}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Insert a section
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-h-[640px] flex-col gap-2 p-4" data-testid="canvas-document">
            {page.root.children.map((node) => (
              <CanvasNodeView
                key={node.id}
                node={node}
                breakpoint={breakpoint}
                assetUrls={assetUrls}
              />
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
function CanvasNodeView({
  node,
  breakpoint,
  assetUrls,
}: {
  node: FrameNode;
  breakpoint: StyleBreakpoint;
  assetUrls: Readonly<Record<string, string>>;
}) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const hoveredNodeId = useEditorStore((s) => s.hoveredNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setHoveredNode = useEditorStore((s) => s.setHoveredNode);
  const drag = useEditorStore((s) => s.drag);

  // Every visible node is a droppable zone (spec §15 explicit drop zones).
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `canvas-node:${node.id}`,
    data: { zone: "canvas", nodeId: node.id },
  });

  // Hidden components never appear on the canvas (spec §9C).
  if (node.editor.hidden) return null;

  const definition = getComponent(node.type);
  const selected = selectedNodeId === node.id;
  const hovered = hoveredNodeId === node.id;
  // The root container is structural; locked components ignore ordinary
  // canvas clicks (spec §10 selection behavior).
  const selectable = node.type !== ROOT_NODE_TYPE && !node.editor.locked;

  // Insertion indicator for the component the drag is currently over (§15).
  // The store holds the *effective* band, already degraded to the nearer
  // edge for targets that cannot receive children.
  const dropTargeted = drag.zone === "canvas" && drag.overNodeId === node.id && drag.valid;
  const indicator = dropTargeted ? drag.band : null;

  const children = definition?.acceptsChildren
    ? node.children.map((child) => (
        <CanvasNodeView key={child.id} node={child} breakpoint={breakpoint} assetUrls={assetUrls} />
      ))
    : null;

  // Definitions render the styles that apply at the active breakpoint and
  // asset references resolved to object URLs; the stored document is
  // untouched (editor overlays are separate chrome).
  const content =
    definition !== undefined ? (
      definition.renderEditor(
        resolveNodeAssetSrc(withResolvedStyles(node, breakpoint), assetUrls),
        children,
      )
    ) : (
      <UnknownComponentView node={node} />
    );

  return (
    <div
      ref={setDroppableRef}
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
          className="absolute -top-2.5 left-2 z-10 flex items-center gap-0.5 rounded bg-zinc-900/85 px-1.5 py-px text-[10px] font-medium text-zinc-100"
        >
          {selectable && <CanvasDragHandle node={node} />}
          <span className="pointer-events-none">{node.name}</span>
        </span>
      )}
      {indicator !== null && (
        <span
          data-testid={`canvas-drop-${indicator}`}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 right-0 z-20 rounded bg-blue-500",
            indicator === "before" && "-top-1 h-1",
            indicator === "after" && "-bottom-1 h-1",
            indicator === "inside" &&
              "inset-0 h-auto rounded-sm bg-transparent ring-2 ring-blue-500/70",
          )}
        />
      )}
      {content}
    </div>
  );
}

/**
 * Drag handle on the node label (spec §10, §15 "drag handles should be
 * available where needed"): only the handle starts a node drag, so text
 * selection and ordinary clicks on the component itself keep working.
 */
function CanvasDragHandle({ node }: { node: FrameNode }) {
  const { attributes, listeners, setActivatorNodeRef } = useDraggable({
    id: `canvas-handle:${node.id}`,
    data: { kind: "node", nodeId: node.id } satisfies DragPayload,
  });
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      data-testid="canvas-drag-handle"
      aria-label={`Drag ${node.name}`}
      {...listeners}
      {...attributes}
      className="cursor-grab touch-none rounded px-0.5 text-zinc-300 hover:text-white active:cursor-grabbing"
    >
      <GripVertical className="h-3 w-3" aria-hidden="true" />
    </button>
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
