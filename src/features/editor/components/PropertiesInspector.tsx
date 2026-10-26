import { useEffect, useRef, useState } from "react";
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
import type { FramePage, StyleBreakpoint, StyleValue } from "@/features/document/model";
import { ROOT_NODE_TYPE } from "@/features/document/model";
import {
  BREAKPOINT_LABELS,
  BREAKPOINT_RANGES,
  breakpointForWidth,
  getBreakpointStyles,
  resolveNodeStyles,
} from "@/features/document/responsive";
import {
  colorPickerValue,
  fieldsForSection,
  hasSection,
  INSPECTOR_SECTIONS,
  isHexColor,
  type InspectorField,
  type InspectorSection,
} from "@/features/component-registry/inspector";
import { getComponent } from "@/features/component-registry/registry";
import { countNodes, getPath } from "@/features/document/traversal";
import { InspectorFieldRow } from "@/features/editor/inspector/fields";
import { resolveViewportWidth, useEditorStore } from "@/features/editor/stores/editorStore";
import type { PageCommands } from "@/features/editor/usePageCommands";
import { cn } from "@/lib/cn";

interface PropertiesInspectorProps {
  page: FramePage;
  commands: PageCommands;
  /** All project pages: link destinations can target them (spec §20). */
  pages: readonly FramePage[];
  /** Object URLs for stored image assets (spec §19 previews). */
  assetUrls: Readonly<Record<string, string>>;
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
export function PropertiesInspector({
  page,
  commands,
  pages,
  assetUrls,
}: PropertiesInspectorProps) {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const viewportSelection = useEditorStore((s) => s.viewportSelection);
  const customViewportWidth = useEditorStore((s) => s.customViewportWidth);
  // Style edits target the breakpoint the current viewport renders (spec §16).
  const breakpoint: StyleBreakpoint = breakpointForWidth(
    resolveViewportWidth({ viewportSelection, customViewportWidth }),
  );
  const path = selectedNodeId === null ? null : getPath(page.root, selectedNodeId);
  const node = path?.at(-1) ?? null;

  // Collapses persist per panel session, not per document.
  const [collapsed, setCollapsed] = useState<Partial<Record<InspectorSection, boolean>>>({});

  if (node === null || node.type === ROOT_NODE_TYPE) {
    return (
      <div className="flex h-full flex-col gap-3 p-4" data-testid="inspector-empty">
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Properties
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing selected</p>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Click a component on the canvas or in the Layers panel to edit its properties.
          </p>
        </div>
        <PageSettingsFields page={page} commands={commands} />
      </div>
    );
  }

  const definition = getComponent(node.type);
  const fields = definition?.controls ?? [];
  const ancestors = path!.slice(0, -1).map((ancestor) => ancestor.name);

  // Values shown are the effective breakpoint values (base merged with the
  // active overrides); the stored node is never rewritten to display them.
  const overrides = breakpoint === "base" ? {} : getBreakpointStyles(node, breakpoint);
  const displayedNode =
    breakpoint === "base" ? node : { ...node, styles: resolveNodeStyles(node, breakpoint) };

  const commitField = (field: InspectorField, value: StyleValue): void => {
    if (field.target === "prop") {
      commands.updateLayerProps(node.id, { [field.key]: value });
    } else {
      commands.updateLayerStyles(node.id, { [field.key]: value }, breakpoint);
    }
  };

  const resetField = (field: InspectorField): void => {
    if (field.target === "prop") {
      const defaults = definition?.createDefaultProps() ?? {};
      if (!(field.key in defaults)) return; // no default to restore
      commands.updateLayerProps(node.id, { [field.key]: defaults[field.key] });
      return;
    }
    // Breakpoint reset removes only that override, restoring inheritance;
    // base reset clears the declaration (spec §16/§17).
    if (breakpoint === "base") {
      commands.updateLayerStyles(node.id, { [field.key]: null });
    } else if (overrides[field.key] !== undefined) {
      commands.updateLayerStyles(node.id, { [field.key]: null }, breakpoint);
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
        {breakpoint !== "base" && (
          <div
            data-testid="breakpoint-banner"
            role="note"
            className="border-b border-blue-200 bg-blue-50/70 px-4 py-2 dark:border-blue-900 dark:bg-blue-950/30"
          >
            <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
              Editing {BREAKPOINT_LABELS[breakpoint]} styles
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-blue-700/80 dark:text-blue-300/70">
              Applies at {BREAKPOINT_RANGES[breakpoint]}. Unchanged fields inherit the Desktop
              values; reset a field to remove its override.
            </p>
          </div>
        )}

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
                  {fieldsForSection(fields, section).map((field) => {
                    const isStyle = field.target === "style";
                    const overridden = isStyle && overrides[field.key] !== undefined;
                    return (
                      <InspectorFieldRow
                        key={`${field.target}.${field.key}`}
                        field={field}
                        node={displayedNode}
                        onCommit={commitField}
                        onReset={resetField}
                        identityPrefix={node.id}
                        breakpointBadge={
                          isStyle && breakpoint !== "base"
                            ? overridden
                              ? "override"
                              : "inherited"
                            : undefined
                        }
                        canReset={!isStyle || breakpoint === "base" || overridden}
                        pages={pages}
                        assetUrls={assetUrls}
                        onAssetUpload={(file) => void commands.uploadImageForNode(node.id, file)}
                      />
                    );
                  })}
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

const settingsInputClass =
  "h-7 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const settingsLabelClass =
  "flex flex-col gap-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400";

/**
 * Page settings for the selected page (spec §20 page configuration), shown
 * while nothing is selected. Every field commits through the validated page
 * command, so invalid input is rejected with a toast and the document keeps
 * its last valid value; focus is never lost while typing (§11).
 */
function PageSettingsFields({ page, commands }: { page: FramePage; commands: PageCommands }) {
  return (
    <section
      className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
      data-testid="page-settings"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Page settings
      </h3>
      <SettingsField
        label="Page name"
        testId="page-name"
        value={page.name}
        onCommit={(value) => void commands.updatePageSettings({ name: value })}
      />
      <SettingsField
        label="Slug"
        testId="page-slug"
        value={page.slug}
        onCommit={(value) => void commands.updatePageSettings({ slug: value })}
      />
      <SettingsField
        label="Page title"
        testId="page-title"
        value={page.settings.title}
        onCommit={(value) => void commands.updatePageSettings({ title: value })}
      />
      <PageBackgroundField background={page.settings.backgroundColor} commands={commands} />
    </section>
  );
}

function SettingsField({
  label,
  testId,
  value,
  onCommit,
}: {
  label: string;
  testId: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Resync only while unfocused, so a save round-trip never clobbers typing.
  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (draftRef.current !== value) onCommit(draftRef.current);
  };

  return (
    <label className={settingsLabelClass}>
      {label}
      <input
        value={draft}
        data-testid={`${testId}-input`}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            draftRef.current = value;
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
        className={settingsInputClass}
      />
    </label>
  );
}

function PageBackgroundField({
  background,
  commands,
}: {
  background: string;
  commands: PageCommands;
}) {
  const [draft, setDraft] = useState(background);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(background);
  }, [background]);

  const commit = (): void => {
    if (draft === background) return;
    if (!isHexColor(draft)) {
      setError("Use a hex color like #ffffff.");
      setDraft(background);
      return;
    }
    setError(null);
    void commands.updatePageSettings({ backgroundColor: draft });
  };

  return (
    <label className={settingsLabelClass}>
      Background
      <span className="flex items-center gap-2">
        <input
          value={draft}
          data-testid="page-background-input"
          aria-invalid={error !== null}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(background);
              setError(null);
              event.currentTarget.blur();
            }
          }}
          onBlur={() => {
            focusedRef.current = false;
            commit();
          }}
          className={settingsInputClass}
        />
        <input
          type="color"
          value={colorPickerValue(background)}
          aria-label="Pick page background color"
          data-testid="page-background-color"
          onChange={(event) => {
            setError(null);
            setDraft(event.target.value);
            void commands.updatePageSettings({ backgroundColor: event.target.value });
          }}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
        />
      </span>
      {error !== null && (
        <span role="alert" className="text-[10px] text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}
