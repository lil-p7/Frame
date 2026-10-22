import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import type { FrameNode, FramePage } from "@/features/document/model";
import { getComponent } from "@/features/component-registry/registry";
import {
  resolveSiblingShift,
  type DragPayload,
} from "@/features/editor/dnd/dropResolution";
import type { PageCommands } from "@/features/editor/usePageCommands";
import { useEditorStore } from "@/features/editor/stores/editorStore";

interface LayersPanelProps {
  page: FramePage;
  commands: PageCommands;
}

/**
 * Layer tree over the page document (spec §9C).
 *
 * Selection sync plus rename, duplicate, delete, hide/lock (Phase 2/4), and
 * Phase 6 reordering: rows are draggable (grip handle) and droppable with
 * before/inside/after indicators; Alt+↑/↓ is the keyboard alternative
 * (spec §15). Every move goes through the same command layer as drags.
 *
 * Selection rules: locked components cannot be selected from the canvas but
 * can be selected here, where their unlock control also lives (spec §9C).
 */
export function LayersPanel({ page, commands }: LayersPanelProps) {
  // Whitespace below the rows is a drop zone: it appends to the page root.
  const { setNodeRef } = useDroppable({
    id: "layer-tree",
    data: { zone: "layer", nodeId: page.root.id },
  });
  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-y-auto py-1"
      role="tree"
      aria-label="Layer tree"
    >
      <LayerRow node={page.root} depth={0} isRoot page={page} commands={commands} />
    </div>
  );
}

interface LayerRowProps {
  node: FrameNode;
  depth: number;
  page: FramePage;
  isRoot?: boolean;
  commands: PageCommands;
}

function LayerRow({ node, depth, page, isRoot = false, commands }: LayerRowProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const selected = !isRoot && selectedNodeId === node.id;
  const locked = node.editor.locked;
  const hidden = node.editor.hidden;
  const hasChildren = node.children.length > 0;

  const definition = getComponent(node.type);
  const canDuplicate = definition?.canDuplicate ?? !isRoot;
  const canDelete = definition?.canDelete ?? false;
  const canLock = (definition?.canLock ?? false) && !isRoot;

  // Phase 6: every row is a droppable zone; non-root, unlocked rows are
  // draggable from their grip handle (spec §15, §9C layer ordering).
  const drag = useEditorStore((s) => s.drag);
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `layer-drop:${node.id}`,
    data: { zone: "layer", nodeId: node.id },
  });
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `layer-row:${node.id}`,
    data: { kind: "node", nodeId: node.id } satisfies DragPayload,
    disabled: isRoot || locked,
  });
  // Effective band is precomputed by the drag context (§15 invalid targets
  // never show an indicator).
  const dropBand =
    drag.zone === "layer" && drag.overNodeId === node.id && drag.valid ? drag.band : null;

  // Keep the selected layer visible when selection comes from the canvas.
  useEffect(() => {
    if (selected && typeof rowRef.current?.scrollIntoView === "function") {
      rowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  if (renaming) {
    return (
      <div role="none" style={{ paddingLeft: `${8 + depth * 12}px` }}>
        <LayerNameEditor
          node={node}
          onCommit={(name) => {
            setRenaming(false);
            commands.renameLayer(node.id, name);
          }}
          onCancel={() => setRenaming(false)}
        />
        {hasChildren && expanded && (
          <div role="group">
            {node.children.map((child) => (
              <LayerRow
                key={child.id}
                node={child}
                depth={depth + 1}
                page={page}
                commands={commands}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const actionButton =
    "inline-flex h-4.5 w-4.5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-700 dark:hover:text-zinc-200";

  return (
    <div role="none">
      <div
        ref={(element) => {
          rowRef.current = element;
          setDroppableRef(element);
        }}
        role="treeitem"
        tabIndex={0}
        aria-selected={selected}
        aria-level={depth + 1}
        aria-expanded={hasChildren ? expanded : undefined}
        data-testid="layer-row"
        data-node-id={node.id}
        title={
          isRoot
            ? "Page root — structural container, always present"
            : locked
              ? "Locked — canvas clicks are ignored; unlock here to edit on the canvas"
              : "Alt+↑ / Alt+↓ reorders; drag the grip to move freely"
        }
        onClick={(event) => {
          event.stopPropagation();
          if (!isRoot) selectNode(node.id);
        }}
        onKeyDown={(event) => {
          // Keyboard reordering alternative (spec §15): swap with the
          // previous/next sibling through the same command layer as drags.
          if (!event.altKey || isRoot) return;
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const shift = resolveSiblingShift(
            page,
            node.id,
            event.key === "ArrowUp" ? "up" : "down",
          );
          if (shift === null) return;
          commands.moveLayer(node.id, shift.parentId, shift.index);
        }}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        className={cn(
          "group relative flex h-7 cursor-pointer items-center gap-1 pr-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
          selected
            ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
          isRoot && "cursor-default text-zinc-400 dark:text-zinc-500",
          hidden && "opacity-50",
          isDragging && "opacity-50",
        )}
      >
        {!isRoot && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            data-testid="layer-drag-handle"
            aria-label={`Drag ${node.name}`}
            disabled={locked}
            title={locked ? "Unlock before reordering" : "Drag to reorder"}
            {...listeners}
            {...attributes}
            className="inline-flex h-4 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-zinc-200 hover:text-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <GripVertical className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
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

        {(() => {
          const Icon = definition?.icon;
          return Icon !== undefined && !isRoot ? (
            <Icon
              className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500"
              aria-hidden="true"
            />
          ) : (
            <span className="inline-block h-3 w-3 shrink-0" aria-hidden="true" />
          );
        })()}

        <span className="min-w-0 truncate" data-testid="layer-row-name">
          {node.name}
        </span>
        {!isRoot && (
          <span className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{node.type}</span>
        )}

        {!isRoot && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 aria-selected:opacity-100">
            <button
              type="button"
              data-testid="layer-rename"
              aria-label={`Rename ${node.name}`}
              disabled={locked}
              title={locked ? "Unlock before renaming" : "Rename"}
              onClick={(event) => {
                event.stopPropagation();
                setRenaming(true);
              }}
              className={actionButton}
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="layer-visibility"
              aria-label={hidden ? `Show ${node.name}` : `Hide ${node.name}`}
              title={hidden ? "Show on canvas" : "Hide from canvas"}
              onClick={(event) => {
                event.stopPropagation();
                commands.setLayerVisibility(node.id, !hidden);
              }}
              className={actionButton}
            >
              {hidden ? (
                <EyeOff className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Eye className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {canLock && (
              <button
                type="button"
                data-testid="layer-lock"
                aria-label={locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
                title={locked ? "Unlock" : "Lock against canvas edits"}
                onClick={(event) => {
                  event.stopPropagation();
                  commands.setLayerLock(node.id, !locked);
                }}
                className={actionButton}
              >
                {locked ? (
                  <LockOpen className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Lock className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            )}
            <button
              type="button"
              data-testid="layer-duplicate"
              aria-label={`Duplicate ${node.name}`}
              title={
                canDuplicate
                  ? "Duplicate (fresh IDs in the copy)"
                  : "This component cannot be duplicated"
              }
              disabled={!canDuplicate}
              onClick={(event) => {
                event.stopPropagation();
                commands.duplicateLayer(node.id);
              }}
              className={actionButton}
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="layer-delete"
              aria-label={`Delete ${node.name}`}
              title={canDelete ? "Delete (removes the whole subtree)" : undefined}
              disabled={!canDelete}
              onClick={(event) => {
                event.stopPropagation();
                commands.deleteLayer(node.id);
              }}
              className={actionButton}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )}
        {locked && (
          <Lock
            className={cn("h-3 w-3 shrink-0 text-zinc-400", !isRoot && "-ml-1")}
            aria-label="Locked"
          />
        )}
        {dropBand !== null && (
          <span
            data-testid={`layer-drop-${dropBand}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-0 right-0 z-10 rounded bg-blue-500",
              dropBand === "before" && "-top-0.5 h-0.5",
              dropBand === "after" && "-bottom-0.5 h-0.5",
              dropBand === "inside" &&
                "inset-0 h-auto rounded-sm bg-blue-500/10 ring-1 ring-blue-500/60",
            )}
          />
        )}
      </div>

      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              page={page}
              commands={commands}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LayerNameEditorProps {
  node: FrameNode;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/** Inline rename (spec §25): Enter commits, Escape cancels, empty reverts. */
function LayerNameEditor({ node, onCommit, onCancel }: LayerNameEditorProps) {
  const [draft, setDraft] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const commit = (): void => {
    // Blur after an Escape-cancel must not resurrect the draft as a rename.
    if (cancelledRef.current) return;
    onCommit(draft);
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      data-testid="layer-rename-input"
      value={draft}
      aria-label={`Rename ${node.name}`}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={commit}
      className="h-5 w-28 rounded border border-blue-500 bg-white px-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600 dark:bg-zinc-900"
    />
  );
}
