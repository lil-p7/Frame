interface FrameMarkProps {
  className?: string;
}

/** Geometric logo mark: a frame outline with a solid inner block. */
export function FrameMark({ className }: FrameMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="14" width="9" height="4" rx="1" fill="currentColor" />
      <rect x="6" y="7" width="6" height="3" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
