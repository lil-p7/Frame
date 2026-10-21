import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Lock, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import { ROOT_NODE_TYPE, type FrameNode } from "@/features/document/model";
import { useEditorStore } from "@/features/editor/stores/editorStore";

interface LayersPanelProps {
  root: FrameNode;
}

/**
 * Read-only layer tree over the page document (spec §9C).
 *
 * Phase 2 scope: hierarchy display, expand/collapse, and selection that stays
 * synchronized with the canvas. Rename, reorder, visibility, and locking
 * controls arrive with Phase 4.
 */
export function LayersPanel({ root }: LayersPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto py-1" role="tree" aria-label="Layer tree">
      <LayerRow node={root} depth={0} isRoot />
    </div>
  );
}

interface LayerRowProps {
  node: FrameNode;
  depth: number;
  isRoot?: boolean;
}

function LayerRow({ node, depth, isRoot = false }: LayerRowProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const [expanded, setExpanded] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);

  const selected = !isRoot && selectedNodeId === node.id;
  const locked = node.editor.locked;
  const hidden = node.editor.hidden;
  const hasChildren = node.children.length > 0;
  const selectable = !isRoot && !locked;

  // Keep the selected layer visible when selection comes from the canvas.
  useEffect(() => {
    if (selected && typeof rowRef.current?.scrollIntoView === "function") {
      rowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <div role="none">
      <div
        ref={rowRef}
        role="treeitem"
        aria-selected={selected}
        aria-level={depth + 1}
        aria-expanded={hasChildren ? expanded : undefined}
        data-testid="layer-row"
        data-node-id={node.id}
        title={
          isRoot
            ? "Page root — always present, never selectable"
            : locked
              ? "Locked components are selected from the Layers panel once Phase 4 ships locking"
              : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          if (selectable) selectNode(node.id);
        }}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        className={cn(
          "group flex h-7 cursor-pointer items-center gap-1 pr-2 text-xs",
          selected
            ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
          isRoot && "cursor-default text-zinc-400 dark:text-zinc-500",
          hidden && "opacity-50",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" aria-hidden="true" />
        )}

        <Square
          className={cn(
            "h-3 w-3 shrink-0",
            isRoot ? "text-zinc-400" : "text-zinc-400 dark:text-zinc-500",
          )}
          aria-hidden="true"
        />
        <span className="truncate">{node.name}</span>
        {node.type !== ROOT_NODE_TYPE && (
          <span className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{node.type}</span>
        )}
        {locked && <Lock className="ml-auto h-3 w-3 shrink-0 text-zinc-400" aria-label="Locked" />}
      </div>

      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <LayerRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
