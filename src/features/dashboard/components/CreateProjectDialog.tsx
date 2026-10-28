import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { validateProjectName } from "@/features/document/model";
import type { StarterId } from "@/features/projects/types";
import { STARTERS } from "@/features/projects/services/starters";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description: string | undefined, starter: StarterId) => void;
}

/**
 * Create-project dialog (spec §6). Every listed starter is implemented by
 * `starterPages`, so no option is a nonfunctional control.
 */
export function CreateProjectDialog({ open, onOpenChange, onCreate }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [starter, setStarter] = useState<StarterId>("blank");
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog is opened fresh.
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setStarter("blank");
      setError(null);
    }
  }, [open]);

  const submit = (): void => {
    const validationError = validateProjectName(name);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    onOpenChange(false);
    onCreate(name, description.trim() === "" ? undefined : description, starter);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-zinc-900 p-5 shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="display text-lg text-zinc-100">Create a new project</Dialog.Title>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
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
                className="rounded border border-line bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                placeholder="Portfolio Website"
              />
              {error !== null ? (
                <span role="alert" className="text-xs text-red-400">
                  {error}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Description <span className="font-normal text-zinc-600">(optional)</span>
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onPaste={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                rows={2}
                className="resize-none rounded border border-line bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-accent focus:outline-none"
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Starter
              </legend>
              {STARTERS.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="starter"
                    value={option.id}
                    checked={starter === option.id}
                    onChange={() => setStarter(option.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-zinc-200">{option.label}</span>{" "}
                    <span className="text-zinc-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

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
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Create project
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
