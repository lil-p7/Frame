import type { FrameProject } from "@/features/document/model";
import type { AssetRepository } from "@/features/assets/types";

/**
 * Lightweight dashboard row. `corrupt` marks records that failed schema
 * validation so the dashboard can surface them without crashing or
 * silently discarding user data.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  pageCount: number;
  updatedAt: string;
  corrupt: boolean;
}

/** Starter templates offered by the create-project dialog (spec §6). */
export type StarterId = "blank" | "landing" | "portfolio";

export interface CreateProjectInput {
  name: string;
  description?: string;
  /** Defaults to "blank". */
  starter?: StarterId;
}

/**
 * High-level project operations. All methods return explicit results and
 * throw `PersistenceError` on storage failure.
 *
 * Extends `AssetRepository` (spec §31: "Refine the interface as required for
 * asset storage") so uploads share one persistence adapter with projects.
 */
export interface ProjectRepository extends AssetRepository {
  listProjects(): Promise<FrameProject[]>;
  getProject(id: string): Promise<FrameProject | null>;
  saveProject(project: FrameProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export function toSummary(project: FrameProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    pageCount: project.pages.length,
    updatedAt: project.updatedAt,
    corrupt: false,
  };
}
