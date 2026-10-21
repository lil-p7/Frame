import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Trash2, FolderOpen } from "lucide-react";
import type { ProjectSummary } from "@/features/projects/types";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/cn";

interface ProjectCardProps {
  project: ProjectSummary;
  onRename: (project: ProjectSummary) => void;
  onDuplicate: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

const menuItemClass =
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800";
const destructiveItemClass = cn(
  menuItemClass,
  "text-red-600 data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-950/50",
);

export function ProjectCard({ project, onRename, onDuplicate, onDelete }: ProjectCardProps) {
  const openLabel = `Open ${project.name}`;

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900",
        project.corrupt
          ? "border-red-300 dark:border-red-900"
          : "border-zinc-200 dark:border-zinc-800",
      )}
      data-testid="project-card"
    >
      <Link
        to={`/editor/${project.id}`}
        aria-label={project.corrupt ? undefined : openLabel}
        className={cn(project.corrupt && "cursor-not-allowed aria-disabled")}
        aria-disabled={project.corrupt}
        draggable={false}
        onClick={(event) => {
          if (project.corrupt) event.preventDefault();
        }}
      >
        <ProjectTile />
      </Link>

      <div className="flex items-start justify-between gap-2 px-3 pb-3 pt-2">
        <div className="min-w-0">
          <Link
            to={`/editor/${project.id}`}
            onClick={(event) => {
              if (project.corrupt) event.preventDefault();
            }}
            className="block truncate text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400"
            draggable={false}
          >
            {project.name}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {project.corrupt ? (
              <span className="text-red-600 dark:text-red-400">
                This project’s data is damaged and cannot be opened.
              </span>
            ) : (
              <>
                {project.pageCount} {project.pageCount === 1 ? "page" : "pages"}
                {" · "}
                {formatRelativeTime(project.updatedAt)}
              </>
            )}
          </p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            asChild
            aria-label={`Open menu for ${project.name}`}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <button type="button">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white p-1 shadow-md focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
            >
              {!project.corrupt && (
                <>
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => onRename(project)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Rename
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={menuItemClass}
                    onSelect={() => onDuplicate(project)}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Duplicate
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                </>
              )}
              <DropdownMenu.Item
                className={destructiveItemClass}
                onSelect={() => onDelete(project)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className={cn(project.corrupt && "font-medium")}>Delete</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </article>
  );
}

/**
 * Phase 1 placeholder tile: a neutral, decorative composition that does not
 * claim to be a page preview. A real document preview arrives with rendering.
 */
function ProjectTile() {
  return (
    <div
      className="flex h-28 items-center justify-center bg-zinc-100 transition-colors group-hover:bg-zinc-200/70 dark:bg-zinc-800 dark:group-hover:bg-zinc-700/60"
      aria-hidden="true"
    >
      <div className="flex w-2/3 flex-col gap-1.5 opacity-60">
        <div className="h-2 w-1/2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
        <div className="h-2 w-3/4 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mt-2 flex gap-1.5">
          <div className="h-7 flex-1 rounded-sm bg-zinc-300 dark:bg-zinc-700" />
          <div className="h-7 flex-1 rounded-sm bg-zinc-400/70 dark:bg-zinc-600/70" />
        </div>
        <div className="flex items-center gap-1 pt-0.5">
          <FolderOpen className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
          <div className="h-1.5 w-1/3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}
