import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { FramePage } from "@/features/document/model";
import type { PageCommands } from "@/features/editor/usePageCommands";
import { cn } from "@/lib/cn";

/**
 * Page management (spec §20): create, duplicate, rename, reorder, and delete
 * pages for the current project. Deletion requires confirmation and is
 * disabled for the last remaining page; every action goes through the same
 * command layer as the rest of the editor.
 */

interface PageMenuProps {
  pages: readonly FramePage[];
  currentPage: FramePage;
  commands: PageCommands;
}

type DialogState = { kind: "create" } | { kind: "rename" } | { kind: "delete" } | null;

const menuItemClass =
  "flex w-full cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 outline-none data-[highlighted]:bg-white/10 disabled:pointer-events-none disabled:opacity-40";
const destructiveItemClass = cn(
  menuItemClass,
  "text-red-400 data-[highlighted]:bg-red-950/60",
);

const dialogOverlayClass = "fixed inset-0 z-50 bg-black/70";
const dialogContentClass =
  "fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-zinc-900 p-4 shadow-2xl focus:outline-none";

export function PageMenu({ pages, currentPage, commands }: PageMenuProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const index = pages.findIndex((page) => page.id === currentPage.id);
  const onlyPage = pages.length <= 1;

  const openNameDialog = (kind: "create" | "rename"): void => {
    setDraft(kind === "rename" ? currentPage.name : "");
    setError(null);
    setDialog({ kind });
  };

  const submitName = async (): Promise<void> => {
    if (draft.trim().length === 0) {
      setError("Page name is required.");
      return;
    }
    setBusy(true);
    try {
      if (dialog?.kind === "rename") {
        await commands.updatePageSettings({ name: draft });
        setDialog(null);
      } else if (dialog?.kind === "create") {
        const created = await commands.createPage(draft);
        if (created) setDialog(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    setBusy(true);
    try {
      const deleted = await commands.deletePage();
      if (deleted) setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          asChild
          aria-label="Page actions"
          className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <button type="button" title="Page actions" data-testid="page-menu-trigger">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[190px] rounded-lg border border-line bg-zinc-800 p-1 shadow-xl focus:outline-none"
          >
            <DropdownMenu.Item
              className={menuItemClass}
              data-testid="page-menu-new"
              onSelect={() => openNameDialog("create")}
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              New page…
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              data-testid="page-menu-duplicate"
              onSelect={() => void commands.duplicatePage()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Duplicate page
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              data-testid="page-menu-rename"
              onSelect={() => openNameDialog("rename")}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Rename page…
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

            <DropdownMenu.Item
              className={menuItemClass}
              data-testid="page-menu-up"
              disabled={index <= 0}
              onSelect={() => void commands.movePage("up")}
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              Move page up
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItemClass}
              data-testid="page-menu-down"
              disabled={index === -1 || index >= pages.length - 1}
              onSelect={() => void commands.movePage("down")}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              Move page down
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

            <DropdownMenu.Item
              className={destructiveItemClass}
              data-testid="page-menu-delete"
              disabled={onlyPage}
              onSelect={() => setDialog({ kind: "delete" })}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete page…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root
        open={dialog !== null && dialog.kind !== "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={dialogOverlayClass} />
          <Dialog.Content className={dialogContentClass} data-testid="page-name-dialog">
            <Dialog.Title className="text-sm font-semibold text-zinc-100">
              {dialog?.kind === "rename" ? "Rename page" : "New page"}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-zinc-400">
              {dialog?.kind === "rename"
                ? "The page keeps its content; the URL slug updates separately."
                : "Create an empty page in this project."}
            </Dialog.Description>
            <input
              autoFocus
              value={draft}
              aria-label="Page name"
              aria-invalid={error !== null}
              data-testid="page-dialog-input"
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitName();
              }}
              className="mt-3 h-8 w-full rounded border border-line bg-zinc-950 px-2 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            {error !== null && (
              <p role="alert" className="mt-1 text-xs text-red-400">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded border border-line px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="page-name-submit"
                disabled={busy}
                onClick={() => void submitName()}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
              >
                {dialog?.kind === "rename" ? "Rename" : "Create"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={dialogOverlayClass} />
          <Dialog.Content className={dialogContentClass} data-testid="page-delete-dialog">
            <Dialog.Title className="text-sm font-semibold text-zinc-100">
              Delete “{currentPage.name}”?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-zinc-400">
              This removes the page and its components from the project. It cannot be undone.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded border border-line px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="page-delete-confirm"
                disabled={busy}
                onClick={() => void confirmDelete()}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Delete page
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
