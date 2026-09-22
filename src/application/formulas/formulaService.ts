import { createFormula, type FormulaResource } from "../../domain/formulas/formula";
import { validateFormula } from "../../domain/formulas/formulaValidation";
import type { ResourceRepository } from "../../domain/resources/resourceRepository";
import type { ResourceMetadataStore } from "../../infrastructure/persistence/resourceMetadataStore";
import { ResourceCrudService } from "../resources/resourceCrudService";

export class FormulaService extends ResourceCrudService<FormulaResource> {
  public constructor(repository: ResourceRepository<FormulaResource>, metadata: ResourceMetadataStore) {
    super(repository, metadata, {
      baseName: "formula",
      create: createFormula,
      validate: validateFormula,
      withIdentity: (resource, id, name, now) => ({ ...structuredClone(resource), id, name, updatedAt: now })
    });
  }
}
