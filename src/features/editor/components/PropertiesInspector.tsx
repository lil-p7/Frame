import { Box } from "lucide-react";
import { ROOT_NODE_TYPE, type FramePage } from "@/features/document/model";
import { countNodes, getPath } from "@/features/document/traversal";
import { useEditorStore } from "@/features/editor/stores/editorStore";

interface PropertiesInspectorProps {
  page: FramePage;
}

/**
 * Right properties inspector (spec §11).
 *
 * Phase 2 scope: selection-aware header plus honest read-only details. Every
 * editing control arrives with Phase 5 (inspector and style editing) — no
 * control is shown here that would not actually change the document.
 */
export function PropertiesInspector({ page }: PropertiesInspectorProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const path = selectedNodeId === null ? null : getPath(page.root, selectedNodeId);
  const node = path?.at(-1) ?? null;

  if (node === null || node.type === ROOT_NODE_TYPE) {
    return (
      <div className="flex h-full flex-col gap-2 p-4" data-testid="inspector-empty">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Properties
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing selected</p>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Click a component on the canvas or in the Layers panel to inspect it. Editing controls
          arrive with the inspector phase (Phase 5).
        </p>
      </div>
    );
  }

  const ancestors = path!.slice(0, -1).map((ancestor) => ancestor.name);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Box className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" data-testid="inspector-node-name">
            {node.name}
          </p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{node.type}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Location
          </h2>
          <p className="mt-1.5 break-words text-xs text-zinc-600 dark:text-zinc-300">
            {ancestors.length > 0 ? `${ancestors.join(" / ")} / ` : ""}
            {node.name}
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Advanced
          </h2>
          <dl className="mt-1.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Type</dt>
              <dd className="text-zinc-800 dark:text-zinc-200">{node.type}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Children</dt>
              <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {node.children.length}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Visible</dt>
              <dd className="text-zinc-800 dark:text-zinc-200">
                {node.editor.hidden ? "Hidden" : "Yes"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Locked</dt>
              <dd className="text-zinc-800 dark:text-zinc-200">
                {node.editor.locked ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Component ID</dt>
              <dd
                className="max-w-32 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
                title={node.id}
              >
                {node.id}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Nodes in page</dt>
              <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {countNodes(page.root)}
              </dd>
            </div>
          </dl>
        </section>

        <p className="rounded border border-dashed border-zinc-200 p-2 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Content, layout, typography, appearance, and spacing controls are added in Phase 5.
          Nothing here is editable yet, so nothing is faked.
        </p>
      </div>
    </div>
  );
}
