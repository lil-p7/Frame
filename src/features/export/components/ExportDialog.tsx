import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { FrameProject } from "@/features/document/model";
import type { ProjectRepository } from "@/features/projects/types";
import { buildExportPackage, downloadBlob, reportForExport } from "@/features/export/services/exportService";
import { siteFolder } from "@/features/export/generators/site";
import { isExportable, type ExportReport } from "@/features/export/validation";

type ValidationState =
  | { status: "checking" }
  | { status: "checked"; report: ExportReport }
  | { status: "failed"; message: string };

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: FrameProject;
  repository: ProjectRepository;
  /**
   * Waits for queued editor commands to reach storage (spec §8: flush pending
   * changes before exporting) so the export reflects what the user sees.
   */
  flush: () => Promise<void>;
  /** Download sink; injectable so tests can capture the package. */
  onDownload?: (blob: Blob, fileName: string) => void;
}

/**
 * Export dialog (spec §23).
 *
 * Shows what will be exported, validates the project against the local asset
 * store, and reports every issue before anything is written. Blocking issues
 * disable the export instead of silently substituting content, and the
 * download only starts after the package is fully built.
 */
export function ExportDialog({
  open,
  onOpenChange,
  project,
  repository,
  flush,
  onDownload = downloadBlob,
}: ExportDialogProps) {
  const [validation, setValidation] = useState<ValidationState>({ status: "checking" });
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  // Validate on open and whenever the project changes underneath the dialog:
  // the user may fix an issue and reopen without the stale verdict.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setValidation({ status: "checking" });
    setExported(null);
    void (async () => {
      try {
        await flush();
        const report = await reportForExport(project, repository);
        if (!cancelled) setValidation({ status: "checked", report });
      } catch {
        if (!cancelled) {
          setValidation({ status: "failed", message: "The project could not be checked for export." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, project, repository, flush]);

  const startExport = useCallback(async (): Promise<void> => {
    setExporting(true);
    try {
      await flush();
      const built = await buildExportPackage(project, repository);
      onDownload(built.blob, built.fileName);
      setExported(built.fileName);
      toast.success(`Export completed — ${built.fileName}`);
    } catch (error) {
      // Never claim a download that did not happen; say what to fix.
      const detail = error instanceof Error ? error.message : "The export failed.";
      toast.error(detail);
      setValidation({ status: "failed", message: detail });
    } finally {
      setExporting(false);
    }
  }, [flush, onDownload, project, repository]);

  const report = validation.status === "checked" ? validation.report : null;
  const ready = report !== null && isExportable(report);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="export-dialog"
          className="fixed left-1/2 top-1/2 w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-zinc-900 p-5 shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="display text-lg text-zinc-100">Export project</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-zinc-400">
            Generate an independent website from this project. Frame does not need to be running for
            the exported site.
          </Dialog.Description>

          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-zinc-500">Project</dt>
            <dd className="font-medium text-zinc-200">{project.name}</dd>

            <dt className="text-zinc-500">Format</dt>
            <dd className="text-zinc-200">
              React + Vite website (ZIP archive)
            </dd>

            <dt className="text-zinc-500">Destination</dt>
            <dd className="text-zinc-200">
              Downloads <span className="font-mono">{siteFolder(project)}.zip</span> to your computer.
            </dd>

            <dt className="text-zinc-500">Contents</dt>
            <dd className="text-zinc-200">
              {project.pages.length} {project.pages.length === 1 ? "page" : "pages"}, pages as source
              files, {project.assets.length === 0 ? "no images" : `${project.assets.length} stored ${project.assets.length === 1 ? "image" : "images"}`}, and setup
              instructions.
            </dd>

            <dt className="text-zinc-500">Validation</dt>
            <dd>
              {validation.status === "checking" && (
                <span role="status" className="inline-flex items-center gap-1.5 text-zinc-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Checking the project…
                </span>
              )}

              {validation.status === "failed" && (
                <span role="alert" className="inline-flex items-start gap-1.5 text-red-400">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {validation.message}
                </span>
              )}

              {report !== null && ready && report.warnings.length === 0 && (
                <span
                  data-testid="export-validation-ready"
                  className="inline-flex items-center gap-1.5 text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Everything checks out.
                </span>
              )}

              {report !== null && (
                <div className="flex flex-col gap-2">
                  {report.errors.length > 0 && (
                    <ul data-testid="export-errors" className="flex flex-col gap-1 text-red-400">
                      {report.errors.map((message) => (
                        <li key={message} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.warnings.length > 0 && (
                    <ul data-testid="export-warnings" className="flex flex-col gap-1 text-amber-400">
                      {report.warnings.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                  {report.errors.length === 0 && (
                    <span className="text-zinc-300">
                      {report.warnings.length > 0
                        ? "Warnings do not block the export."
                        : "Ready to export."}
                    </span>
                  )}
                </div>
              )}
            </dd>
          </dl>

          {exported !== null && (
            <p role="status" className="mt-4 rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
              Downloaded <span className="font-mono">{exported}</span>. Unzip it and run{" "}
              <span className="font-mono">npm install</span> inside the folder to work on the site.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              data-testid="export-confirm"
              onClick={() => void startExport()}
              disabled={!ready || exporting}
              aria-disabled={!ready || exporting}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {exporting ? "Exporting…" : "Export website"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
