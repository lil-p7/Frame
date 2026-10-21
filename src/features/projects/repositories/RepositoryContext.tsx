import { createContext, useContext } from "react";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * The repository is injected via context so the dashboard, editor, and tests
 * share one persistence adapter. The default (Dexie/IndexedDB) instance is
 * created lazily in the provider, not at module load time.
 */
export const RepositoryContext = createContext<ProjectRepository | null>(null);

export function useProjectRepository(): ProjectRepository {
  const repository = useContext(RepositoryContext);
  if (repository === null) {
    throw new Error("No ProjectRepository provided. Render <RepositoryProvider> around the app.");
  }
  return repository;
}
