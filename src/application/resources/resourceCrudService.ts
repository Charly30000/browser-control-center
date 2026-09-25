import { randomUUID } from "node:crypto";
import type { GlobalResource, GlobalResourceSummary, ResourceEditorState } from "../../domain/resources/globalResource";
import { hasDuplicateResourceName, nextResourceName } from "../../domain/resources/resourceNaming";
import type { Result } from "../../shared/result";
import { ResourceImportService, type ResourceIdentityFactory } from "../importExport/resourceImportService";
import type { ResourceDataDao, ResourceMetadata, StateDataDao } from "../persistence/applicationDataDao";

export interface ResourceDefinition<T extends GlobalResource> extends ResourceIdentityFactory<T> {
  readonly baseName: string;
  create(id: string, name: string, now: string): T;
  validate(resource: T): Result<T>;
}

export class ResourceCrudService<T extends GlobalResource> {
  private readonly importService = new ResourceImportService();

  public constructor(
    private readonly resourceDao: ResourceDataDao<T>,
    private readonly metadataDao: StateDataDao<ResourceMetadata>,
    private readonly definition: ResourceDefinition<T>
  ) {}

  public async getInitialState(): Promise<ResourceEditorState<T>> {
    const metadata = this.metadataDao.get();
    const ids = [metadata.selectedResourceId, ...metadata.resources.map(({ id }) => id)]
      .filter((id): id is string => id !== null);
    for (const id of new Set(ids)) {
      const resource = await this.resourceDao.load(id);
      if (resource !== null) return { resource, savedResource: structuredClone(resource), resources: metadata.resources };
    }
    return this.createDraft();
  }

  public createDraft(): ResourceEditorState<T> {
    const metadata = this.metadataDao.get();
    const name = nextResourceName(this.definition.baseName, metadata.resources.map((resource) => resource.name));
    const resource = this.definition.create(randomUUID(), name, new Date().toISOString());
    return { resource, savedResource: null, resources: metadata.resources };
  }

  public async select(id: string): Promise<ResourceEditorState<T>> {
    const metadata = this.metadataDao.get();
    const resource = await this.resourceDao.load(id);
    if (resource === null) throw new Error("El recurso seleccionado ya no existe.");
    await this.metadataDao.set({ ...metadata, selectedResourceId: id });
    return { resource, savedResource: structuredClone(resource), resources: metadata.resources };
  }

  public async save(draft: T): Promise<ResourceEditorState<T>> {
    const metadata = this.metadataDao.get();
    const validation = this.definition.validate(draft);
    if (!validation.ok) throw new Error(validation.error);
    const name = draft.name.trim();
    if (hasDuplicateResourceName(name, draft.id, metadata.resources)) {
      throw new Error(`Ya existe un recurso llamado «${name}».`);
    }
    const resource = this.definition.withIdentity(draft, draft.id, name, new Date().toISOString());
    await this.resourceDao.save(resource);
    const summary = this.toSummary(resource);
    const resources = [...metadata.resources.filter(({ id }) => id !== resource.id), summary]
      .sort((left, right) => left.name.localeCompare(right.name));
    await this.metadataDao.set({ version: 1, selectedResourceId: resource.id, resources });
    return { resource, savedResource: structuredClone(resource), resources };
  }

  public async deleteSelected(ids: readonly string[]): Promise<ResourceEditorState<T>> {
    const idSet = new Set(ids);
    await Promise.all([...idSet].map((id) => this.resourceDao.delete(id)));
    const metadata = this.metadataDao.get();
    const resources = metadata.resources.filter(({ id }) => !idSet.has(id));
    const selectedResourceId = resources.some(({ id }) => id === metadata.selectedResourceId)
      ? metadata.selectedResourceId
      : resources[0]?.id ?? null;
    const updated: ResourceMetadata = { version: 1, selectedResourceId, resources };
    await this.metadataDao.set(updated);
    if (selectedResourceId !== null) return this.select(selectedResourceId);
    return this.createDraft();
  }

  public async getAll(): Promise<T[]> {
    const resources: T[] = [];
    for (const summary of this.metadataDao.get().resources) {
      const resource = await this.resourceDao.load(summary.id);
      if (resource !== null) resources.push(resource);
    }
    return resources;
  }

  public getSummaries(): readonly GlobalResourceSummary[] { return this.metadataDao.get().resources; }

  public async importMany(imported: readonly T[]): Promise<ResourceEditorState<T>> {
    for (const resource of imported) {
      const validation = this.definition.validate(resource);
      if (!validation.ok) throw new Error(`No se puede importar «${resource.name}»: ${validation.error}`);
    }
    const existing = await this.getAll();
    const resolution = this.importService.resolve(existing, imported, randomUUID, this.definition);
    for (const resource of resolution.resourcesToSave) await this.resourceDao.save(resource);

    const metadata = this.metadataDao.get();
    const summaries = new Map(metadata.resources.map((summary) => [summary.id, summary]));
    for (const resource of resolution.resourcesToSave) summaries.set(resource.id, this.toSummary(resource));
    const resources = [...summaries.values()].sort((left, right) => left.name.localeCompare(right.name));
    const selectedResourceId = imported[0] === undefined
      ? metadata.selectedResourceId
      : resolution.idMap.get(imported[0].id) ?? metadata.selectedResourceId;
    await this.metadataDao.set({ version: 1, selectedResourceId, resources });
    if (selectedResourceId !== null) return this.select(selectedResourceId);
    return this.createDraft();
  }

  private toSummary(resource: T): GlobalResourceSummary {
    return { id: resource.id, name: resource.name, updatedAt: resource.updatedAt };
  }
}
