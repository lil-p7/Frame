import { FrameMark } from "@/features/dashboard/components/FrameMark";
import { Plus } from "lucide-react";

interface DashboardHeaderProps {
  onNewProject: () => void;
}

export function DashboardHeader({ onNewProject }: DashboardHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <FrameMark className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <span className="text-sm font-semibold tracking-tight">Frame</span>
          <span className="ml-2 border-l border-zinc-200 pl-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Local workspace
          </span>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New project
        </button>
      </div>
    </header>
  );
}
