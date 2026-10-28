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
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-zinc-900 p-5 shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="display text-lg text-zinc-100">Rename project</Dialog.Title>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input type="hidden" data-testid="rename-project-id" value={project.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Name</span>
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
                className="rounded border border-line bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-accent focus:outline-none"
              />
              {error !== null ? (
                <span role="alert" className="text-xs text-red-400">
                  {error}
                </span>
              ) : null}
            </label>

            <div className="mt-1 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded border border-line px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white"
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
