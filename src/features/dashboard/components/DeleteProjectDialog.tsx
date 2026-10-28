import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import type { ProjectSummary } from "@/features/projects/types";

interface DeleteProjectDialogProps {
  project: ProjectSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
}

/** Deletion always requires an explicit confirmation (spec §6). */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDelete,
}: DeleteProjectDialogProps) {
  if (project === null) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-zinc-900 p-5 shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="display text-lg text-zinc-100">Delete project</Dialog.Title>

          <p className="mt-2 text-sm text-zinc-400">
            Delete <strong data-testid="delete-project-name">{project.name}</strong>? This
            permanently removes the project and its pages. This action cannot be undone.
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded border border-line px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                data-testid="confirm-delete"
                className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete permanently
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
