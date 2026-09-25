import { createArrayResource, type ArrayResource } from "../../domain/arrays/arrayResource";
import { failure, success } from "../../shared/result";
import type { ResourceDataDao, ResourceMetadata, StateDataDao } from "../persistence/applicationDataDao";
import { ResourceCrudService } from "../resources/resourceCrudService";

export class ArrayResourceService extends ResourceCrudService<ArrayResource> {
  public constructor(dao: ResourceDataDao<ArrayResource>, metadata: StateDataDao<ResourceMetadata>) {
    super(dao, metadata, {
      baseName: "array",
      create: createArrayResource,
      validate: (resource) => resource.name.trim() === "" ? failure("El nombre del array es obligatorio.") : success(resource),
      withIdentity: (resource, id, name, now) => ({ ...structuredClone(resource), id, name, updatedAt: now })
    });
  }
}
