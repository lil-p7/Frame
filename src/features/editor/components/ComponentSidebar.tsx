import { useState } from "react";
import { Component, GripVertical, Layers, Plus, Search } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import type { ComponentCategory, ComponentDefinition } from "@/features/component-registry/types";
import { COMPONENT_CATEGORIES } from "@/features/component-registry/types";
import { listComponents } from "@/features/component-registry/registry";
import type { FramePage } from "@/features/document/model";
import { findNode } from "@/features/document/traversal";
import { resolveInsertionTarget, type PageCommands } from "@/features/editor/usePageCommands";
import type { DragPayload } from "@/features/editor/dnd/dropResolution";
import { LayersPanel } from "@/features/editor/components/LayersPanel";

interface ComponentSidebarProps {
  page: FramePage;
  commands: PageCommands;
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: "Layout",
  text: "Text",
  media: "Media",
  interactive: "Interactive",
  structure: "Structure",
};

type TabId = "components" | "layers";

/**
 * One library entry: click inserts (Phase 4); dragging carries the component
 * type onto the canvas or layer tree (Phase 6, spec §9A drag affordance,
 * §15 component-library drag). Both paths share the same command layer.
 */
function LibraryItemButton({
  definition,
  insertComponent,
}: {
  definition: ComponentDefinition;
  insertComponent: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `library-item:${definition.type}`,
    data: { kind: "library", componentType: definition.type } satisfies DragPayload,
  });
  const Icon = definition.icon;
  return (
    <button
      type="button"
      // The button is both the dragged node (measured for collision
      // detection) and its activator — both refs must point at it or dnd-kit
      // never resolves a drop target.
      ref={(element) => {
        setNodeRef(element);
        setActivatorNodeRef(element);
      }}
      data-testid="library-item"
      data-component-type={definition.type}
      title={definition.description}
      aria-label={`Insert ${definition.label}`}
      onClick={() => insertComponent(definition.type)}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-accent",
        isDragging && "opacity-40",
      )}
    >
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-400 group-hover:bg-white group-hover:text-accent">
        <Icon className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-medium text-zinc-200">
          {definition.label}
          <Plus
            className="h-2.5 w-2.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span className="block truncate text-[10px] leading-snug text-zinc-500">
          {definition.description}
        </span>
      </span>
      <GripVertical
        className="mt-1 h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Left sidebar with the two tabs from spec §9: Components and Layers.
 *
 * The Components tab lists the registry (spec §9A) grouped by category with
 * a search field; clicking an item inserts a default instance at the current
 * valid location (Phase 4 — drag-and-drop arrives in Phase 6).
 */
export function ComponentSidebar({ page, commands }: ComponentSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>("layers");

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 border-b-2 px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
      active
        ? "border-accent text-accent"
        : "border-transparent text-zinc-500 hover:text-zinc-100",
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Sidebar sections"
        className="flex border-b border-line"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "components"}
          onClick={() => setActiveTab("components")}
          className={tabClass(activeTab === "components")}
        >
          <Component className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Components
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "layers"}
          onClick={() => setActiveTab("layers")}
          className={tabClass(activeTab === "layers")}
        >
          <Layers className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Layers
        </button>
      </div>

      {activeTab === "components" ? (
        <ComponentLibrary page={page} insertComponent={commands.insertComponent} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" role="tabpanel" aria-label="Layers">
          <LayersPanel page={page} commands={commands} />
        </div>
      )}
    </div>
  );
}

interface ComponentLibraryProps {
  page: FramePage;
  insertComponent: (type: string) => void;
}

function ComponentLibrary({ page, insertComponent }: ComponentLibraryProps) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matches = (name: string, type: string, description: string): boolean =>
    needle.length === 0 ||
    name.toLowerCase().includes(needle) ||
    type.toLowerCase().includes(needle) ||
    description.toLowerCase().includes(needle);

  // Where the next click will land — shown honestly because insertion without
  // drop indicators should not be a surprise.
  const target = resolveInsertionTarget(page, null, "section");
  const targetNode = findNode(page.root, target.parentId);
  const targetLabel =
    targetNode === null ? "the page root" : `“${targetNode.name}” (or beside the selection)`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="tabpanel" aria-label="Components">
      <div className="border-b border-line p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search components"
            aria-label="Search components"
            className="h-7 w-full rounded border border-line bg-zinc-900 pr-2 pl-7 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
          Click a component to insert it into {targetLabel}, or drag it onto the canvas or a layer.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {COMPONENT_CATEGORIES.map((category) => {
          const definitions = listComponents(category).filter((definition) =>
            matches(definition.label, definition.type, definition.description),
          );
          if (definitions.length === 0) return null;
          return (
            <section key={category} className="mb-3">
              <h2 className="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className="space-y-1">
                {definitions.map((definition) => (
                  <li key={definition.type}>
                    <LibraryItemButton definition={definition} insertComponent={insertComponent} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {COMPONENT_CATEGORIES.every(
          (category) =>
            listComponents(category).filter((definition) =>
              matches(definition.label, definition.type, definition.description),
            ).length === 0,
        ) && (
          <p className="px-1 py-4 text-xs text-zinc-500">
            No components match “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
