import { useState } from "react";
import { Component, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FrameNode } from "@/features/document/model";
import { LayersPanel } from "@/features/editor/components/LayersPanel";

interface ComponentSidebarProps {
  root: FrameNode;
}

type TabId = "components" | "layers";

/** Groups the component library will list once the registry lands (Phase 4). */
const UPCOMING_GROUPS = ["Layout", "Text", "Media", "Interactive", "Structure"] as const;

/**
 * Left sidebar with the two tabs from spec §9: Components and Layers.
 *
 * The Layers tab is live (document tree + selection sync). The Components tab
 * honestly states what is coming instead of showing fake, non-inserting items.
 */
export function ComponentSidebar({ root }: ComponentSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>("layers");

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 border-b-2 px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
      active
        ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Sidebar sections"
        className="flex border-b border-zinc-200 dark:border-zinc-800"
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
        <div className="flex-1 overflow-y-auto p-4" role="tabpanel" aria-label="Components">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Component library
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Components are defined in the registry (Phase 3) and listed here for insertion (Phase
            4). Nothing is offered yet because nothing would work yet.
          </p>
          <ul className="mt-3 space-y-1.5">
            {UPCOMING_GROUPS.map((group) => (
              <li
                key={group}
                className="rounded border border-dashed border-zinc-200 px-2 py-1.5 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
              >
                {group}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" role="tabpanel" aria-label="Layers">
          <LayersPanel root={root} />
        </div>
      )}
    </div>
  );
}
