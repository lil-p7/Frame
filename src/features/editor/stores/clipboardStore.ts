import { create } from "zustand";
import type { FrameNode } from "@/features/document/model";

/**
 * In-session component clipboard (spec §25 copy/paste).
 *
 * Holds a snapshot of the copied subtree. Paste clones it with fresh IDs, so
 * the clipboard never aliases a live document node. Deliberately memory-only:
 * editor clipboard content is not a durable preference.
 */
interface ClipboardStoreState {
  node: FrameNode | null;
  copy: (node: FrameNode) => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardStoreState>()((set) => ({
  node: null,
  copy: (node) => set({ node }),
  clear: () => set({ node: null }),
}));

/** Test/reset helper: empties the component clipboard. */
export function resetClipboard(): void {
  useClipboardStore.setState({ node: null });
}
