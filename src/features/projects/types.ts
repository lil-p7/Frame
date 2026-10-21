import type { FrameProject } from "@/features/document/model";

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

export interface CreateProjectInput {
  name: string;
  description?: string;
}

/**
 * High-level project operations. All methods return explicit results and
 * throw `PersistenceError` on storage failure.
 */
export interface ProjectRepository {
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
