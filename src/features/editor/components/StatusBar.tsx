import { ROOT_NODE_TYPE, type FramePage } from "@/features/document/model";
import { countNodes, getPath } from "@/features/document/traversal";
import { resolveViewportWidth, useEditorStore } from "@/features/editor/stores/editorStore";

interface StatusBarProps {
  page: FramePage;
}

/**
 * Bottom status bar (spec §7): viewport + zoom readout, a selection
 * breadcrumb (the spec's reliable way to select a parent, §10), and page info.
 */
export function StatusBar({ page }: StatusBarProps) {
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);

  const viewportWidth = resolveViewportWidth({ viewportSelection, customViewportWidth });
  const path = selectedNodeId === null ? null : getPath(page.root, selectedNodeId);
  const crumbs = path ?? [page.root];

  const breadcrumbButton =
    "max-w-32 truncate rounded px-1 py-0.5 hover:bg-zinc-200 focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:hover:bg-zinc-800";

  return (
    <footer
      data-testid="editor-status-bar"
      className="flex h-6 shrink-0 items-center justify-between gap-4 border-t border-zinc-200 bg-white px-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
    >
      <span className="tabular-nums">
        {viewportWidth}px · {Math.round(zoom * 100)}%
      </span>

      <nav aria-label="Selection breadcrumb" className="flex min-w-0 items-center gap-0.5">
        {crumbs.map((crumb, index) => {
          const isRoot = crumb.type === ROOT_NODE_TYPE;
          const last = index === crumbs.length - 1;
          return (
            <span key={crumb.id} className="flex min-w-0 items-center gap-0.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isRoot || last ? (
                <span
                  className={
                    last && !isRoot
                      ? "max-w-32 truncate rounded bg-blue-600/10 px-1 py-0.5 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      : "max-w-32 truncate px-1 py-0.5"
                  }
                  aria-current={last ? "true" : undefined}
                >
                  {isRoot ? page.name : crumb.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectNode(crumb.id)}
                  className={breadcrumbButton}
                  title={`Select ${crumb.name}`}
                >
                  {crumb.name}
                </button>
              )}
            </span>
          );
        })}
        {selectedNodeId === null && (
          <span className="px-1 text-zinc-400 dark:text-zinc-500">· nothing selected</span>
        )}
      </nav>

      <span className="shrink-0 tabular-nums">
        /{page.slug} · {countNodes(page.root)} nodes
      </span>
    </footer>
  );
}
