import { FrameMark } from "@/features/dashboard/components/FrameMark";
import { Plus } from "lucide-react";

interface DashboardHeaderProps {
  onNewProject: () => void;
}

export function DashboardHeader({ onNewProject }: DashboardHeaderProps) {
  return (
    <header className="border-b border-line bg-zinc-950">
      <div className="mx-auto flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <FrameMark className="h-5 w-5 text-accent" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-zinc-100">
            Frame
          </span>
          <span className="ml-2 border-l border-line pl-3 text-[11px] uppercase tracking-wider text-zinc-500">
            Local workspace
          </span>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New project
        </button>
      </div>
    </header>
  );
}
