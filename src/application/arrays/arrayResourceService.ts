import { t } from "../../localization";
import { createArrayResource, type ArrayResource } from "../../domain/arrays/arrayResource";
import { failure, success } from "../../shared/result";
import type { ResourceDataDao, ResourceMetadata, StateDataDao } from "../persistence/applicationDataDao";
import { ResourceCrudService } from "../resources/resourceCrudService";

export class ArrayResourceService extends ResourceCrudService<ArrayResource> {
  public constructor(dao: ResourceDataDao<ArrayResource>, metadata: StateDataDao<ResourceMetadata>) {
    super(dao, metadata, {
      baseName: t("names.arrayBase"),
      create: createArrayResource,
      validate: (resource) => resource.name.trim() === "" ? failure(t("text.theArrayNameIsRequired")) : success(resource),
      withIdentity: (resource, id, name, now) => ({ ...structuredClone(resource), id, name, updatedAt: now })
    });
  }
}
