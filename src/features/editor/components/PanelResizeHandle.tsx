import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";

interface PanelResizeHandleProps {
  side: "left" | "right";
  /** Receives the total delta since the drag started (not per-move steps). */
  onResizeDelta: (deltaPx: number) => void;
}

/**
 * Drag handle between a side panel and the canvas (spec §7: panels are
 * resizable within limits — the caller clamps). Uses window listeners so the
 * drag survives leaving the thin handle.
 */
export function PanelResizeHandle({ side, onResizeDelta }: PanelResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startClientX = useRef(0);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    startClientX.current = event.clientX;
    setDragging(true);

    const onMove = (moveEvent: PointerEvent): void => {
      // Accumulated since drag start, so the caller can add it to the width
      // captured when the drag began (each move re-renders with a new closure).
      const delta = moveEvent.clientX - startClientX.current;
      if (delta === 0) return;
      // Left panel grows when dragged right; right panel grows when dragged left.
      onResizeDelta(side === "left" ? delta : -delta);
    };
    const onUp = (): void => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize left panel" : "Resize right panel"}
      tabIndex={0}
      data-testid={`resize-${side}`}
      onPointerDown={beginDrag}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 32 : 8;
        if (event.key === "ArrowLeft") onResizeDelta(side === "left" ? -step : step);
        if (event.key === "ArrowRight") onResizeDelta(side === "left" ? step : -step);
      }}
      className={cn(
        "w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40 focus-visible:bg-accent/60 focus-visible:outline-none",
        dragging && "bg-accent/60",
      )}
    />
  );
}
