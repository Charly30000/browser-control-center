import type { ResourceDataDao, ResourceMetadata, StateDataDao } from "../src/application/persistence/applicationDataDao";
import type { GlobalResource } from "../src/domain/resources/globalResource";

export class InMemoryResourceDao<T extends GlobalResource> implements ResourceDataDao<T> {
  public readonly values = new Map<string, T>();
  public load(id: string): Promise<T | null> { return Promise.resolve(structuredClone(this.values.get(id) ?? null)); }
  public save(resource: T): Promise<void> { this.values.set(resource.id, structuredClone(resource)); return Promise.resolve(); }
  public delete(id: string): Promise<void> { this.values.delete(id); return Promise.resolve(); }
}

export const createMetadataDao = (): StateDataDao<ResourceMetadata> => {
  let value: ResourceMetadata = { version: 1, selectedResourceId: null, resources: [] };
  return {
    get: () => structuredClone(value),
    set: (updated) => { value = structuredClone(updated); return Promise.resolve(); }
  };
};
