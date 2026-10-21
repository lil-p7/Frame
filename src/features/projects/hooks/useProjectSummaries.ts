import { useCallback, useEffect, useState } from "react";
import { useProjectRepository } from "@/features/projects/repositories/RepositoryContext";
import { listProjectSummaries } from "@/features/projects/services/projectService";
import type { ProjectSummary } from "@/features/projects/types";
import { PersistenceError } from "@/lib/errors";

export interface ProjectSummariesState {
  isLoading: boolean;
  summaries: ProjectSummary[];
  error: string | null;
  /** Reloads all summaries; reports failures through `error` instead of throwing. */
  reload: () => Promise<void>;
}

/** Loads the dashboard rows. Storage failures surface as a string, never thrown. */
export function useProjectSummaries(): ProjectSummariesState {
  const repository = useProjectRepository();
  const [state, setState] = useState<Omit<ProjectSummariesState, "reload">>({
    isLoading: true,
    summaries: [],
    error: null,
  });

  const reload = useCallback(async (): Promise<void> => {
    try {
      const summaries = await listProjectSummaries(repository);
      setState({ isLoading: false, summaries, error: null });
    } catch (error) {
      const message =
        error instanceof PersistenceError
          ? `${error.message}. Your projects were not modified.`
          : "Failed to load projects.";
      setState({ isLoading: false, summaries: [], error: message });
    }
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
