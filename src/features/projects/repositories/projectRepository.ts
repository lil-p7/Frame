import Dexie, { type EntityTable } from "dexie";
import type { FrameProject } from "@/features/document/model";
import { PersistenceError } from "@/lib/errors";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * IndexedDB persistence for projects, built on Dexie.
 *
 * One table, keyed by the stable project ID. Asset blobs get their own
 * table in the asset phase (Phase 9), with an explicit DB migration then.
 */
export class DexieProjectRepository implements ProjectRepository {
  private readonly db: Dexie;
  private readonly projects: EntityTable<FrameProject, "id">;

  constructor(dbName = "frame") {
    this.db = new Dexie(dbName);
    this.db.version(1).stores({
      projects: "id, name, updatedAt",
    });
    this.projects = this.db.table("projects");
  }

  async listProjects(): Promise<FrameProject[]> {
    try {
      return await this.projects.orderBy("updatedAt").reverse().toArray();
    } catch (error) {
      throw new PersistenceError("Failed to list projects", error);
    }
  }

  async getProject(id: string): Promise<FrameProject | null> {
    try {
      const found = await this.projects.get(id);
      return found ?? null;
    } catch (error) {
      throw new PersistenceError(`Failed to load project ${id}`, error);
    }
  }

  async saveProject(project: FrameProject): Promise<void> {
    try {
      await this.projects.put(project);
    } catch (error) {
      throw new PersistenceError(`Failed to save project ${project.id}`, error);
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await this.projects.delete(id);
    } catch (error) {
      throw new PersistenceError(`Failed to delete project ${id}`, error);
    }
  }

  /**
   * Test-only escape hatch: writes an unvalidated raw record, simulating data
   * that reached storage outside the app (e.g. corrupted or hand-edited).
   * The application code itself must never call this.
   */
  async rawPutForTests(record: unknown): Promise<void> {
    await this.projects.put(record as FrameProject);
  }
}
