import Dexie, { type EntityTable } from "dexie";
import type { FrameProject } from "@/features/document/model";
import type { StoredAsset } from "@/features/assets/types";
import { PersistenceError } from "@/lib/errors";
import type { ProjectRepository } from "@/features/projects/types";

/**
 * IndexedDB persistence for projects, built on Dexie.
 *
 * - v1: projects table (Phase 1).
 * - v2: adds the asset blob table (Phase 9) — an explicit, additive
 *   migration; existing project records are untouched.
 */
export class DexieProjectRepository implements ProjectRepository {
  private readonly db: Dexie;
  private readonly projects: EntityTable<FrameProject, "id">;
  private readonly assets: EntityTable<StoredAsset, "storageKey">;

  constructor(dbName = "frame") {
    this.db = new Dexie(dbName);
    this.db.version(1).stores({
      projects: "id, name, updatedAt",
    });
    this.db.version(2).stores({
      projects: "id, name, updatedAt",
      assets: "storageKey",
    });
    this.projects = this.db.table("projects");
    this.assets = this.db.table("assets");
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
  /** Stores one image blob under its stable storage key (spec §19). */
  async putAsset(asset: StoredAsset): Promise<void> {
    try {
      await this.assets.put(asset);
    } catch (error) {
      throw new PersistenceError(`Failed to store asset ${asset.storageKey}`, error);
    }
  }

  /** Loads an asset's bytes, or null when the key is unknown/missing. */
  async getAssetBlob(storageKey: string): Promise<Blob | null> {
    try {
      const record = await this.assets.get(storageKey);
      return record?.blob ?? null;
    } catch (error) {
      throw new PersistenceError(`Failed to load asset ${storageKey}`, error);
    }
  }

  async deleteAsset(storageKey: string): Promise<void> {
    try {
      await this.assets.delete(storageKey);
    } catch (error) {
      throw new PersistenceError(`Failed to delete asset ${storageKey}`, error);
    }
  }

  async rawPutForTests(record: unknown): Promise<void> {
    await this.projects.put(record as FrameProject);
  }
}
