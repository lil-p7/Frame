import { useEffect, useRef } from "react";

/**
 * Editor keyboard shortcuts (spec §25).
 *
 * - Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo
 * - Ctrl/Cmd+D duplicate, Ctrl/Cmd+C copy, Ctrl/Cmd+V paste
 * - Delete/Backspace delete the selection
 * - Escape clears the selection
 *
 * Safety rules (spec §25 shortcut safety): nothing fires while focus is in a
 * text field or content-editable surface, browser shortcuts are only consumed
 * when the editor actually performed the action, and Alt-modified keys are
 * left alone (the layer tree uses Alt+↑/↓).
 */

export interface EditorShortcutHandlers {
  undo: () => void;
  redo: () => void;
  /** Returns true when a component was duplicated. */
  duplicate: () => boolean;
  /** Returns true when something was deleted. */
  deleteSelected: () => boolean;
  /** Returns true when a component was copied. */
  copy: () => boolean;
  /** Returns true when a paste command was issued. */
  paste: () => boolean;
  /** Returns true when a selection was cleared. */
  clearSelection: () => boolean;
}

/** True when the event target accepts text input (shortcuts must not steal keys). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable || target.getAttribute("contenteditable") === "true";
}

export function useEditorShortcuts(handlers: EditorShortcutHandlers): void {
  // Handlers are recreated with each render; the listener stays stable.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return;
      if (isEditableTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && !event.altKey) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) handlersRef.current.redo();
          else handlersRef.current.undo();
          return;
        }
        if (key === "y") {
          event.preventDefault();
          handlersRef.current.redo();
          return;
        }
        if (key === "d") {
          if (handlersRef.current.duplicate()) event.preventDefault();
          return;
        }
        if (key === "c") {
          if (handlersRef.current.copy()) event.preventDefault();
          return;
        }
        if (key === "v") {
          if (handlersRef.current.paste()) event.preventDefault();
          return;
        }
        return;
      }

      if (mod || event.altKey) return;

      if (key === "delete" || key === "backspace") {
        if (handlersRef.current.deleteSelected()) event.preventDefault();
        return;
      }
      if (key === "escape") {
        if (handlersRef.current.clearSelection()) event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
