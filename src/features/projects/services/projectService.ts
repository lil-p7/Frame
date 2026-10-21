import {
  PROJECT_SCHEMA_VERSION,
  createRootNode,
  parseFrameProject,
  slugify,
  type FrameNode,
  type FrameProject,
  validateProjectName,
} from "@/features/document/model";
import type {
  CreateProjectInput,
  ProjectRepository,
  ProjectSummary,
} from "@/features/projects/types";
import { PersistenceError, ProjectValidationError } from "@/lib/errors";
import { createId } from "@/lib/ids";

/**
 * Pure project business logic on top of a persistence adapter.
 * All mutations refresh `updatedAt`; duplication regenerates every ID.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function createInitialPage(projectName: string): StatePage {
  return {
    id: createId(),
    name: projectName,
    slug: slugify(projectName),
    root: createRootNode(createId()),
    settings: {
      title: projectName,
      backgroundColor: "#ffffff",
    },
  };
}

type StatePage = FrameProject["pages"][number];

export async function createProject(
  repository: ProjectRepository,
  input: CreateProjectInput,
): Promise<FrameProject> {
  const nameError = validateProjectName(input.name);
  if (nameError !== null) {
    throw new ProjectValidationError(nameError, [nameError]);
  }

  const name = input.name.trim();
  const timestamp = nowIso();
  const project: FrameProject = {
    id: createId(),
    name,
    description: input.description?.trim() || undefined,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    pages: [createInitialPage(name)],
    assets: [],
    designTokens: { colors: {}, spacing: {}, typography: {} },
  };

  await repository.saveProject(project);
  return project;
}

/** Lists projects as dashboard rows; corrupt records become flagged rows, not thrown. */
export async function listProjectSummaries(
  repository: ProjectRepository,
): Promise<ProjectSummary[]> {
  const rawRecords = await repository.listProjects();

  return rawRecords.map((raw) => {
    try {
      const project = parseFrameProject(raw);
      return {
        id: project.id,
        name: project.name,
        pageCount: project.pages.length,
        updatedAt: project.updatedAt,
        corrupt: false,
      } satisfies ProjectSummary;
    } catch (error) {
      if (error instanceof ProjectValidationError) {
        throw error; // This case is a programming or persistence bug.
      }
      return corruptSummary(raw);
    }
  });
}

/**
 * Builds a display row for a record that could not be parsed, using whatever
 * identity data is salvageable so the user can still delete it explicitly.
 */
function corruptSummary(raw: unknown): ProjectSummary {
  const salvage = (raw ?? {}) as { id?: unknown; name?: unknown };
  return {
    id: typeof salvage.id === "string" ? salvage.id : `corrupt-${createId()}`,
    name:
      typeof salvage.name === "string" && salvage.name.length > 0
        ? salvage.name
        : "Damaged project",
    pageCount: 0,
    updatedAt: "",
    corrupt: true,
  };
}

export async function getProject(
  repository: ProjectRepository,
  id: string,
): Promise<FrameProject | null> {
  const raw = await repository.getProject(id);
  return raw === null ? null : parseFrameProject(raw);
}

export async function renameProject(
  repository: ProjectRepository,
  id: string,
  newName: string,
): Promise<FrameProject> {
  const project = await requireProject(repository, id);
  const nameError = validateProjectName(newName);
  if (nameError !== null) {
    throw new ProjectValidationError(nameError, [nameError]);
  }

  const updated: FrameProject = { ...project, name: newName.trim(), updatedAt: nowIso() };
  await repository.saveProject(updated);
  return updated;
}

/**
 * Deep-copies a project with a completely fresh identity: new project ID,
 * new page IDs, and regenerated IDs for every node in every page tree.
 */
export async function duplicateProject(
  repository: ProjectRepository,
  id: string,
): Promise<FrameProject> {
  const source = await requireProject(repository, id);

  // Old ID -> new ID, filled lazily so aliasing maps consistently.
  const idMap = new Map<string, string>();
  const mapId = (oldId: string): string => {
    const mapped = idMap.get(oldId);
    if (mapped !== undefined) return mapped;
    const fresh = createId();
    idMap.set(oldId, fresh);
    return fresh;
  };

  const cloneNode = (node: FrameNode): FrameNode => ({
    ...node,
    id: mapId(node.id),
    props: structuredClone(node.props),
    styles: structuredClone(node.styles),
    children: node.children.map(cloneNode),
    editor: { ...node.editor },
  });

  const timestamp = nowIso();
  const draft: FrameProject = {
    ...source,
    id: createId(),
    name: `${source.name} (Copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
    pages: source.pages.map((page) => ({
      id: mapId(page.id),
      name: page.name,
      slug: page.slug,
      root: cloneNode(page.root),
      settings: { ...page.settings },
    })),
    assets: structuredClone(source.assets),
    designTokens: structuredClone(source.designTokens),
  };

  await repository.saveProject(draft);
  return draft;
}

export async function deleteProject(repository: ProjectRepository, id: string): Promise<void> {
  await repository.deleteProject(id);
}

async function requireProject(repository: ProjectRepository, id: string): Promise<FrameProject> {
  const project = await getProject(repository, id);
  if (project === null) {
    throw new PersistenceError(`Project "${id}" does not exist`);
  }
  return project;
}
