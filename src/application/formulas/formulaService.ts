import { createFormula, type FormulaResource } from "../../domain/formulas/formula";
import { validateFormula } from "../../domain/formulas/formulaValidation";
import type { ResourceDataDao, ResourceMetadata, StateDataDao } from "../persistence/applicationDataDao";
import { ResourceCrudService } from "../resources/resourceCrudService";

export class FormulaService extends ResourceCrudService<FormulaResource> {
  public constructor(dao: ResourceDataDao<FormulaResource>, metadata: StateDataDao<ResourceMetadata>) {
    super(dao, metadata, {
      baseName: "formula",
      create: createFormula,
      validate: validateFormula,
      withIdentity: (resource, id, name, now) => ({ ...structuredClone(resource), id, name, updatedAt: now })
    });
  }
}
