import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { Image, RotateCcw, Upload } from "lucide-react";
import type { FrameNode, FramePage, StyleValue } from "@/features/document/model";
import { storageKeyFromSrc } from "@/features/assets/service";
import { PAGE_HREF_PREFIX, resolveHref } from "@/features/document/navigation";
import {
  colorPickerValue,
  isHexColor,
  parseGridColumns,
  parseUnitValue,
  serializeUnitValue,
  type FieldControl,
  type InspectorField,
  type SelectOption,
} from "@/features/component-registry/inspector";
import { cn } from "@/lib/cn";

/**
 * Editable inspector fields (spec §11).
 *
 * Every text-shaped input keeps what the user is typing in local state, so
 * the store round-trip for each committed keystroke can never clobber the
 * field mid-edit ("typing is never clobbered"). Commits are debounced and
 * flushed on blur/Enter. Input that fails validation stays on screen but is
 * not committed — the document keeps its last valid value until a valid one
 * replaces it. Escape reverts to the committed value.
 */

const DEBOUNCE_MS = 400;

const inputClass =
  "w-full min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none";

const rowClass = "flex flex-col gap-1";
const labelClass = "text-[11px] font-medium text-zinc-600 dark:text-zinc-400 select-none";

/**
 * Local draft state shared by every text-shaped control.
 *
 * `identity` (node id + field key) reseeds the draft; the committed value
 * only reseeds the draft while the field is not focused, so edits made
 * directly on the canvas or a reset button land immediately between edits
 * but a focus-preserving re-render (spec §11C) can never wipe what the user
 * is typing.
 */
function useLocalDraft(
  identity: string,
  committed: StyleValue,
  format: (value: StyleValue) => string,
  parse: (raw: string) => StyleValue | null,
  onCommitParsed: (value: StyleValue) => void,
): {
  draft: string;
  setDraft: (raw: string) => void;
  flush: () => void;
  revert: () => void;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [draft, setDraftRaw] = useState(() => format(committed));
  const focusedRef = useRef(false);
  const draftRef = useRef(draft);
  const writtenRef = useRef(false); // did the user actually edit?

  draftRef.current = draft;

  const commitRaw = (raw: string): void => {
    const parsed = parse(raw);
    if (parsed === null) return; // invalid: keep the draft, don't touch the document
    onCommitParsed(parsed);
  };

  const setDraft = (raw: string): void => {
    writtenRef.current = true;
    setDraftRaw(raw);
  };

  // Selection/field changed: bring the field to the node's current value.
  useEffect(() => {
    if (focusedRef.current) return; // never clobber active typing
    writtenRef.current = false;
    setDraftRaw(format(committed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- format is a stable deserializer
  }, [identity]);

  // Committed value changed while not being edited (reset from elsewhere,
  // canvas edit): resync. While focused, the user's draft wins.
  useEffect(() => {
    if (focusedRef.current || writtenRef.current) return;
    setDraftRaw(format(committed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- format is stable per control
  }, [committed]);

  // Debounced commit; also flushed on blur/Enter via `flush`.
  useEffect(() => {
    if (!writtenRef.current) return;
    const handle = window.setTimeout(() => commitRaw(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitRaw re-reads draftRef; draft drives the schedule
  }, [draft]);

  const flush = (): void => {
    commitRaw(draftRef.current);
  };

  const revert = (): void => {
    setDraftRaw(format(committed));
    writtenRef.current = false;
  };

  const onFocus = (): void => {
    focusedRef.current = true;
  };

  const onBlur = (): void => {
    focusedRef.current = false;
    flush();
  };

  return { draft, setDraft, flush, revert, onFocus, onBlur };
}

/** Parses what the user typed back into a style value, or null when invalid. */
type InputParser = (raw: string) => StyleValue | null;

/** Dispatches on the declaration to the right control. */
/** How the displayed style value relates to the active breakpoint (§16). */
export type BreakpointBadge = "inherited" | "override";

export function InspectorFieldRow({
  field,
  node,
  onCommit,
  onReset,
  identityPrefix,
  breakpointBadge,
  canReset = true,
  onAssetUpload,
  assetUrls,
  pages,
}: {
  field: InspectorField;
  node: FrameNode;
  /** Commits the value: props merge into `node.props`, styles into `styles`. */
  onCommit: (field: InspectorField, value: StyleValue) => void;
  /** Resets to the definition fast default (props) or clears override (styles). */
  onReset: (field: InspectorField) => void;
  identityPrefix: string;
  /** Set on style fields while editing a narrower breakpoint (spec §16). */
  breakpointBadge?: BreakpointBadge;
  /** False for an inherited breakpoint value: there is no override to reset. */
  canReset?: boolean;
  /** Uploads a new image for an `asset` field (spec §19). */
  onAssetUpload?: (file: File) => void;
  /** Object URLs for stored assets, used for previews. */
  assetUrls?: Readonly<Record<string, string>>;
  /** Project pages for the `link` destination picker (spec §20). */
  pages?: readonly FramePage[];
}) {
  const identity = `${identityPrefix}:${field.target}.${field.key}`;
  const value =
    field.target === "prop"
      ? ((node.props[field.key] as StyleValue | undefined) ?? null)
      : (node.styles[field.key] ?? null);
  const testKey = `${identityPrefix}-${field.target}-${field.key}`;

  return (
    <div className={rowClass} data-testid={`field-${testKey}`}>
      <div className="flex items-center gap-1">
        <label htmlFor={`${testKey}-input`} className={labelClass}>
          {field.label}
        </label>
        {breakpointBadge !== undefined && (
          <span
            data-testid={`${testKey}-breakpoint`}
            title={
              breakpointBadge === "override"
                ? "Overridden at this breakpoint — reset to inherit the Desktop value"
                : "Inherited from the Desktop (base) styles"
            }
            className={cn(
              "rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide",
              breakpointBadge === "override"
                ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
            )}
          >
            {breakpointBadge === "override" ? "Override" : "Inherited"}
          </span>
        )}
        <button
          type="button"
          data-testid={`${testKey}-reset`}
          disabled={!canReset}
          title={canReset ? `Reset ${field.label}` : "Inherited from Desktop — nothing to reset"}
          className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label={`Reset ${field.label}`}
          onClick={() => onReset(field)}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div className="min-w-0">
        {renderControl(
          field.control,
          identity,
          value,
          testKey,
          (parsed) => onCommit(field, parsed),
          {
            onAssetUpload,
            assetUrl:
              field.control.type === "asset" && assetUrls !== undefined
                ? assetUrls[storageKeyFromSrc(value) ?? ""]
                : undefined,
            pages,
          },
        )}
      </div>
    </div>
  );
}

function renderControl(
  control: FieldControl,
  identity: string,
  value: StyleValue,
  testKey: string,
  commit: (value: StyleValue) => void,
  extras: {
    onAssetUpload?: (file: File) => void;
    assetUrl?: string;
    pages?: readonly FramePage[];
  },
): ReactNode {
  switch (control.type) {
    case "text":
    case "url":
      return (
        <TextInput
          identity={identity}
          committed={value}
          testKey={testKey}
          multiline={false}
          format={(v) =>
            typeof v === "string" ? v : v === null || v === undefined ? "" : String(v)
          }
          parse={(raw) => raw}
          onCommitParsed={commit}
        />
      );
    case "textarea":
      return (
        <TextInput
          identity={identity}
          committed={value}
          testKey={testKey}
          multiline
          format={(v) => (typeof v === "string" ? v : "")}
          parse={(raw) => raw}
          onCommitParsed={commit}
        />
      );
    case "number":
      return (
        <TextInput
          identity={identity}
          committed={value}
          testKey={testKey}
          multiline={false}
          inputMode="decimal"
          format={(v) => (v === null || v === undefined ? "" : String(v))}
          parse={parseNumeric(control.integer, control.min, control.max)}
          onCommitParsed={commit}
        />
      );
    case "opacity":
      return <OpacityInput committed={value} testKey={testKey} commit={commit} />;
    case "asset":
      return (
        <AssetInput
          identity={identity}
          committed={value}
          testKey={testKey}
          commit={commit}
          onUpload={extras.onAssetUpload}
          assetUrl={extras.assetUrl}
        />
      );
    case "link":
      return (
        <LinkInput
          identity={identity}
          committed={value}
          testKey={testKey}
          commit={commit}
          pages={extras.pages ?? []}
        />
      );
    case "select":
      return (
        <SelectInput
          identity={identity}
          committed={value}
          testKey={testKey}
          options={control.options}
          numeric={control.numeric === true}
          commit={commit}
        />
      );
    case "color":
      return <ColorInput identity={identity} committed={value} testKey={testKey} commit={commit} />;
    case "unit":
      return (
        <UnitInput
          identity={identity}
          committed={value}
          testKey={testKey}
          units={control.units}
          commit={commit}
        />
      );
    case "columns":
      return (
        <ColumnsInput identity={identity} committed={value} testKey={testKey} commit={commit} />
      );
  }
}

/**
 * Destination: text input for external URLs plus a picker for this
 * project's pages (spec §20 internal navigation). A destination whose page
 * was deleted is reported instead of silently kept (§20).
 */
function LinkInput({
  identity,
  committed,
  testKey,
  commit,
  pages,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  commit: (value: StyleValue) => void;
  pages: readonly FramePage[];
}) {
  const href = typeof committed === "string" ? committed : "";
  const resolution = resolveHref(href, pages);
  const selected = resolution.kind === "page" ? `${PAGE_HREF_PREFIX}${resolution.slug}` : "";
  const broken = resolution.kind === "page" && resolution.pageId === null;

  return (
    <div className="flex flex-col gap-1">
      <TextInput
        identity={identity}
        committed={committed}
        testKey={testKey}
        multiline={false}
        format={(value) => (typeof value === "string" ? value : "")}
        parse={(raw) => raw}
        onCommitParsed={commit}
      />
      <select
        value={selected}
        aria-label="Link to a page"
        data-testid={`${testKey}-page`}
        onChange={(event) => {
          if (event.target.value !== "") commit(event.target.value);
        }}
        className={inputClass}
      >
        <option value="">Link to a page…</option>
        {pages.map((page) => (
          <option key={page.id} value={`${PAGE_HREF_PREFIX}${page.slug}`}>
            {page.name}
          </option>
        ))}
      </select>
      {broken && (
        <p data-testid={`${testKey}-broken`} className="text-[10px] text-red-600 dark:text-red-400">
          This page no longer exists — choose another destination.
        </p>
      )}
    </div>
  );
}

/**
 * Image source: text input for external URLs plus local upload/replace/
 * remove actions (spec §19 initial image workflow). The preview shows the
 * stored asset's object URL (or the external URL as-is).
 */
function AssetInput({
  identity,
  committed,
  testKey,
  commit,
  onUpload,
  assetUrl,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  commit: (value: StyleValue) => void;
  onUpload?: (file: File) => void;
  assetUrl?: string;
}) {
  const key = storageKeyFromSrc(committed);
  const external = typeof committed === "string" && committed.trim() !== "" && key === null;
  const previewSrc = key !== null ? assetUrl : external ? committed : null;

  return (
    <div className="flex flex-col gap-1.5">
      <TextInput
        identity={identity}
        committed={committed}
        testKey={testKey}
        multiline={false}
        format={(value) => (typeof value === "string" ? value : "")}
        parse={(raw) => raw}
        onCommitParsed={commit}
      />
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          {previewSrc !== null && previewSrc !== "" ? (
            <img
              src={previewSrc}
              alt=""
              data-testid={`${testKey}-preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          )}
        </span>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-blue-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <Upload className="h-3 w-3" aria-hidden="true" />
          {key !== null ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid={`${testKey}-upload`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined && onUpload !== undefined) onUpload(file);
            }}
          />
        </label>
        <button
          type="button"
          data-testid={`${testKey}-remove`}
          disabled={committed === null || committed === ""}
          onClick={() => commit("")}
          className="rounded border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Remove
        </button>
      </div>
      {key !== null && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          Uploaded image — stored with this project.
        </p>
      )}
    </div>
  );
}

function parseNumeric(
  integer: boolean | undefined,
  min: number | undefined,
  max: number | undefined,
): InputParser {
  return (raw) => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    if (integer === true && !Number.isInteger(parsed)) return null;
    if (min !== undefined && parsed < min) return null;
    if (max !== undefined && parsed > max) return null;
    return parsed;
  };
}

/** Single-line or multi-line text, shared commit/debounce logic. */
function TextInput({
  identity,
  committed,
  testKey,
  multiline,
  format,
  parse,
  onCommitParsed,
  inputMode,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  multiline: boolean;
  format: (value: StyleValue) => string;
  parse: (raw: string) => StyleValue | null;
  onCommitParsed: (value: StyleValue) => void;
  inputMode?: "decimal";
}) {
  const { draft, setDraft, flush, revert, onFocus, onBlur } = useLocalDraft(
    identity,
    committed,
    format,
    parse,
    onCommitParsed,
  );

  const commonProps = {
    "data-testid": `${testKey}-input`,
    // Matches the row's `<label htmlFor>` so the field label actually names
    // this control for assistive technology (spec §29).
    id: `${testKey}-input`,
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onFocus,
    onBlur,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" && !multiline) {
        event.preventDefault();
        flush();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        revert();
      }
    },
    className: inputClass,
    ...(inputMode !== undefined ? { inputMode } : {}),
  };

  return multiline ? (
    <textarea {...commonProps} rows={3} className={cn(inputClass, "resize-y")} />
  ) : (
    <input {...commonProps} type="text" />
  );
}

/** Bounded 0–1 fraction with quick presets (spec §11 appearance). */
function OpacityInput({
  committed,
  testKey,
  commit,
}: {
  committed: StyleValue;
  testKey: string;
  commit: (value: StyleValue) => void;
}) {
  const raw = typeof committed === "number" ? committed : null;
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        data-testid={`${testKey}-range`}
        id={`${testKey}-input`}
        className="h-1 flex-1 accent-zinc-700"
        min={0}
        max={1}
        step={0.05}
        value={raw ?? 1}
        onChange={(event) => commit(Number(event.target.value))}
      />
      <span className="w-8 text-right text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
        {raw === null ? "100%" : `${Math.round(raw * 100)}%`}
      </span>
    </div>
  );
}

function SelectInput({
  identity,
  committed,
  testKey,
  options,
  numeric,
  commit,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  options: readonly SelectOption[];
  numeric: boolean;
  commit: (value: StyleValue) => void;
}) {
  const raw = committed === null ? "" : String(committed);
  void identity;
  return (
    <select
      data-testid={`${testKey}-select`}
      id={`${testKey}-input`}
      className={inputClass}
      value={raw}
      onChange={(event) =>
        commit(
          event.target.value === ""
            ? null
            : numeric
              ? Number(event.target.value)
              : event.target.value,
        )
      }
    >
      <option value="">Auto</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const HEX_INPUT_CLASS = cn(inputClass, "w-24");

function ColorInput({
  identity,
  committed,
  testKey,
  commit,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  commit: (value: StyleValue) => void;
}) {
  // The hex text shares the unit field's approach: a local draft that keeps
  // partial/invalid values on screen (a fully controlled input would reset
  // on every invalid keystroke) and commits whenever the draft parses.
  // While focused, resync from the document is skipped so ongoing typing
  // keeps its draft; the picker itself commits directly (always valid).
  const seeded = typeof committed === "string" ? committed : "";
  const [draft, setDraft] = useState(seeded);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(typeof committed === "string" ? committed : "");
  }, [identity, committed]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        data-testid={`${testKey}-picker`}
        aria-label="Pick color"
        className="h-6 w-8 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
        value={colorPickerValue(committed)}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
      />
      <input
        type="text"
        data-testid={`${testKey}-hex`}
        id={`${testKey}-input`}
        className={HEX_INPUT_CLASS}
        value={draft}
        placeholder="#000000"
        spellCheck={false}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          setDraft(typeof committed === "string" ? committed : "");
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (isHexColor(raw)) commit(raw.toLowerCase());
        }}
      />
    </div>
  );
}

/** Amount + unit (px / % / rem, spec §11E). */
function UnitInput({
  identity,
  committed,
  testKey,
  units,
  commit,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  units: readonly string[];
  commit: (value: StyleValue) => void;
}) {
  // Unit fields self-verify on each keystroke (§11E): input that round-trips
  // through `serializeUnitValue` commits immediately, anything else stays on
  // screen uncommitted. Resync follows the same focus rule as text fields
  // via useLocal-style focus guard below.
  const seeded = parseUnitValue(committed);
  const [amount, setAmount] = useState(seeded.amount);
  const [unit, setUnit] = useState(seeded.unit);
  const amountFocusedRef = useRef(false);

  useEffect(() => {
    if (amountFocusedRef.current) return;
    const parsed = parseUnitValue(committed);
    setAmount(parsed.amount);
    setUnit(parsed.unit);
  }, [identity, committed]);

  const dispatch = (nextAmount: string, nextUnit: string): void => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    const serialized = serializeUnitValue({ amount: nextAmount, unit: nextUnit });
    if (serialized !== null) commit(serialized);
  };

  return (
    <div className="grid grid-cols-[1fr_4.5rem] gap-1">
      <input
        type="text"
        data-testid={`${testKey}-amount`}
        id={`${testKey}-input`}
        inputMode="decimal"
        className={cn(inputClass, "tabular-nums")}
        value={amount}
        onFocus={() => {
          amountFocusedRef.current = true;
        }}
        onBlur={() => {
          amountFocusedRef.current = false;
          dispatch(amount, unit);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            dispatch(amount, unit);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setAmount(raw);
          const serialized = serializeUnitValue({ amount: raw, unit });
          if (serialized !== null) commit(serialized);
        }}
      />
      <select
        data-testid={`${testKey}-unit`}
        className={inputClass}
        value={unit}
        aria-label="Unit"
        onChange={(event) => dispatch(amount, event.target.value)}
      >
        {units.map((unitOption) => (
          <option key={unitOption} value={unitOption}>
            {unitOption === "" ? "—" : unitOption}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Grid column count → `repeat(n, minmax(0, 1fr))`. */
function ColumnsInput({
  identity,
  committed,
  testKey,
  commit,
}: {
  identity: string;
  committed: StyleValue;
  testKey: string;
  commit: (value: StyleValue) => void;
}) {
  const count = parseGridColumns(committed);
  void identity;
  return (
    <div className="grid grid-cols-6 gap-1" data-testid={`${testKey}-columns`}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          type="button"
          data-testid={`${testKey}-columns-${n}`}
          className={cn(
            "rounded border py-0.5 text-center text-[11px] tabular-nums",
            count === n
              ? "border-zinc-700 bg-zinc-700 text-white dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
          aria-pressed={count === n}
          onClick={() => commit(`repeat(${n}, minmax(0, 1fr))`)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
