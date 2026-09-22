import { createArrayResource, type ArrayResource } from "../../domain/arrays/arrayResource";
import type { ResourceRepository } from "../../domain/resources/resourceRepository";
import type { ResourceMetadataStore } from "../../infrastructure/persistence/resourceMetadataStore";
import { failure, success } from "../../shared/result";
import { ResourceCrudService } from "../resources/resourceCrudService";

export class ArrayResourceService extends ResourceCrudService<ArrayResource> {
  public constructor(repository: ResourceRepository<ArrayResource>, metadata: ResourceMetadataStore) {
    super(repository, metadata, {
      baseName: "array",
      create: createArrayResource,
      validate: (resource) => resource.name.trim() === "" ? failure("El nombre del array es obligatorio.") : success(resource),
      withIdentity: (resource, id, name, now) => ({ ...structuredClone(resource), id, name, updatedAt: now })
    });
  }
}
