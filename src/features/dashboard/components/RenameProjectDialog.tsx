import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ProjectSummary } from "@/features/projects/types";

interface RenameProjectDialogProps {
  project: ProjectSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, newName: string) => void;
}

/** Validation errors are surfaced inline; empty names are rejected. */
export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
  onRename,
}: RenameProjectDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && project !== null) {
      setName(project.name);
      setError(null);
    }
  }, [open, project]);

  if (project === null) return null;

  const submit = (): void => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Project name is required.");
      return;
    }
    onOpenChange(false);
    onRename(project.id, trimmed);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-zinc-950/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-5 shadow-lg focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-base font-semibold">Rename project</Dialog.Title>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input type="hidden" data-testid="rename-project-id" value={project.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                onPaste={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                aria-invalid={error !== null}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-blue-500"
              />
              {error !== null ? (
                <span role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {error}
                </span>
              ) : null}
            </label>

            <div className="mt-1 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save name
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
