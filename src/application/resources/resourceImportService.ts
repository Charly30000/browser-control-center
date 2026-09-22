import type { GlobalResource } from "../../domain/resources/globalResource";
import { uniqueImportedResourceName } from "../../domain/resources/resourceNaming";

export interface ResourceImportResolution<T extends GlobalResource> {
  readonly resourcesToSave: readonly T[];
  readonly idMap: ReadonlyMap<string, string>;
}

export interface ResourceIdentityFactory<T extends GlobalResource> {
  withIdentity(resource: T, id: string, name: string, now: string): T;
}

export class ResourceImportService {
  public resolve<T extends GlobalResource>(
    existing: readonly T[],
    imported: readonly T[],
    createId: () => string,
    identityFactory: ResourceIdentityFactory<T>,
    now = new Date().toISOString()
  ): ResourceImportResolution<T> {
    const byId = new Map(existing.map((resource) => [resource.id, resource]));
    const occupiedNames = existing.map(({ name }) => name);
    const resourcesToSave: T[] = [];
    const idMap = new Map<string, string>();

    for (const resource of imported) {
      const collision = byId.get(resource.id);
      if (collision !== undefined && JSON.stringify(collision) === JSON.stringify(resource)) {
        idMap.set(resource.id, collision.id);
        continue;
      }
      const id = collision === undefined ? resource.id : createId();
      const name = uniqueImportedResourceName(resource.name, occupiedNames);
      const resolved = identityFactory.withIdentity(resource, id, name, now);
      resourcesToSave.push(resolved);
      byId.set(id, resolved);
      occupiedNames.push(name);
      idMap.set(resource.id, id);
    }
    return { resourcesToSave, idMap };
  }
}
