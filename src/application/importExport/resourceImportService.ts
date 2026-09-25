import type { GlobalResource } from "../../domain/resources/globalResource";
import { resolveImportedIdentity } from "./importIdentityResolver";

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
    const occupiedIds = new Set(existing.map(({ id }) => id));
    const occupiedNames = existing.map(({ name }) => name);
    const resourcesToSave: T[] = [];
    const idMap = new Map<string, string>();

    for (const resource of imported) {
      const identity = resolveImportedIdentity(resource, occupiedIds, occupiedNames, createId);
      const resolved = identityFactory.withIdentity(resource, identity.id, identity.name, now);
      resourcesToSave.push(resolved);
      occupiedIds.add(resolved.id);
      occupiedNames.push(resolved.name);
      idMap.set(resource.id, resolved.id);
    }
    return { resourcesToSave, idMap };
  }
}
