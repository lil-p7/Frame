import { useState } from "react";
import type { ReactNode } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";
import type { FramePage, StyleValue } from "@/features/document/model";
import { ROOT_NODE_TYPE } from "@/features/document/model";
import {
  fieldsForSection,
  hasSection,
  INSPECTOR_SECTIONS,
  type InspectorField,
  type InspectorSection,
} from "@/features/component-registry/inspector";
import { getComponent } from "@/features/component-registry/registry";
import { countNodes, getPath } from "@/features/document/traversal";
import { InspectorFieldRow } from "@/features/editor/inspector/fields";
import { useEditorStore } from "@/features/editor/stores/editorStore";
import type { PageCommands } from "@/features/editor/usePageCommands";
import { cn } from "@/lib/cn";

interface PropertiesInspectorProps {
  page: FramePage;
  commands: PageCommands;
}

const SECTION_LABELS: Record<InspectorSection, string> = {
  content: "Content",
  layout: "Layout",
  typography: "Typography",
  appearance: "Appearance",
  spacing: "Spacing",
  advanced: "Advanced",
};

/**
 * Right properties inspector (spec §11).
 *
 * Rows render strictly from the registry's per-definition `controls`
 * (§12: the registry drives inspector configuration), grouped into the
 * spec's sections. No control appears that is not wired to a document
 * command; style resets clear the override so definition defaults show
 * through (spec §17).
 */
export function PropertiesInspector({ page, commands }: PropertiesInspectorProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const path = selectedNodeId === null ? null : getPath(page.root, selectedNodeId);
  const node = path?.at(-1) ?? null;

  // Collapses persist per panel session, not per document.
  const [collapsed, setCollapsed] = useState<Partial<Record<InspectorSection, boolean>>>({});

  if (node === null || node.type === ROOT_NODE_TYPE) {
    return (
      <div className="flex h-full flex-col gap-2 p-4" data-testid="inspector-empty">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Properties
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing selected</p>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Click a component on the canvas or in the Layers panel to edit its properties.
        </p>
      </div>
    );
  }

  const definition = getComponent(node.type);
  const fields = definition?.controls ?? [];
  const ancestors = path!.slice(0, -1).map((ancestor) => ancestor.name);

  const commitField = (field: InspectorField, value: StyleValue): void => {
    if (field.target === "prop") {
      commands.updateLayerProps(node.id, { [field.key]: value });
    } else {
      commands.updateLayerStyles(node.id, { [field.key]: value });
    }
  };

  const resetField = (field: InspectorField): void => {
    if (field.target === "prop") {
      const defaults = definition?.createDefaultProps() ?? {};
      if (!(field.key in defaults)) return; // no default to restore
      commands.updateLayerProps(node.id, { [field.key]: defaults[field.key] });
    } else {
      commands.updateLayerStyles(node.id, { [field.key]: null });
    }
  };

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
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {definition?.label ?? node.type}
          </p>
        </div>
      </header>

      <div className="flex flex-col">
        {ancestors.length > 0 && (
          <p
            className="break-words px-4 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400"
            data-testid="inspector-node-location"
          >
            {ancestors.join(" / ")}
          </p>
        )}

        {sectionsIn(fields).map((section) => {
          const isCollapsed = collapsed[section] === true;
          return (
            <section
              key={section}
              className="border-b border-zinc-200/70 dark:border-zinc-800/70"
              data-testid={`section-${section}`}
            >
              <button
                type="button"
                className="flex w-full items-center gap-1 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                aria-expanded={!isCollapsed}
                data-testid={`section-${section}-toggle`}
                onClick={() =>
                  setCollapsed((previous) => ({ ...previous, [section]: !isCollapsed }))
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {SECTION_LABELS[section]}
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-3 px-4 pb-3">
                  {fieldsForSection(fields, section).map((field) => (
                    <InspectorFieldRow
                      key={`${field.target}.${field.key}`}
                      field={field}
                      node={node}
                      onCommit={commitField}
                      onReset={resetField}
                      identityPrefix={node.id}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {definition !== undefined && (
          <section className="flex flex-col gap-1.5 px-4 py-3" data-testid="inspector-actions">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Actions
            </span>
            <InspectorActionButton
              testId="inspector-toggle-visibility"
              onClick={() => commands.setLayerVisibility(node.id, !node.editor.hidden)}
              icon={
                node.editor.hidden ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )
              }
              label={node.editor.hidden ? "Show" : "Hide"}
            />
            {definition.canLock && (
              <InspectorActionButton
                testId="inspector-toggle-lock"
                onClick={() => commands.setLayerLock(node.id, !node.editor.locked)}
                icon={
                  node.editor.locked ? (
                    <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  )
                }
                label={node.editor.locked ? "Unlock" : "Lock"}
              />
            )}
            {definition.canDuplicate && (
              <InspectorActionButton
                testId="inspector-duplicate"
                onClick={() => commands.duplicateLayer(node.id)}
                icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Duplicate"
              />
            )}
            {definition.canDelete && (
              <InspectorActionButton
                testId="inspector-delete"
                destructive
                onClick={() => commands.deleteLayer(node.id)}
                icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Delete"
              />
            )}
          </section>
        )}

        <dl className="space-y-1.5 px-4 pb-4 text-xs" data-testid="inspector-details">
          <DetailRow label="Type" value={node.type} />
          <DetailRow label="Children" value={String(node.children.length)} />
          <DetailRow label="Nodes in page" value={String(countNodes(page.root))} />
          <DetailRow label="Component ID" value={node.id} mono />
        </dl>
      </div>
    </div>
  );
}

function sectionsIn(fields: readonly InspectorField[]): InspectorSection[] {
  if (fields.length === 0) return [];
  return INSPECTOR_SECTIONS.filter((section) => sectionForFieldOrder(fields, section));
}

function sectionForFieldOrder(
  fields: readonly InspectorField[],
  section: InspectorSection,
): boolean {
  return hasSection(fields, section);
}

function InspectorActionButton({
  onClick,
  icon,
  label,
  testId,
  destructive = false,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  testId: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
        destructive && "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={cn(
          "max-w-40 truncate text-zinc-800 dark:text-zinc-200",
          mono && "font-mono text-[11px]",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
