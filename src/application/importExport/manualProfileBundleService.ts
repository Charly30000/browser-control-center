import { isDeepStrictEqual } from "node:util";
import type { ResourceImportResult } from "../resources/resourceCrudService";
import type { ArrayResource } from "../../domain/arrays/arrayResource";
import type { FormulaResource } from "../../domain/formulas/formula";
import { createManualProfileBundle, type ManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import type { ManualProfile } from "../../domain/manual/manualProfile";

export interface PortableResourceRepository<T extends FormulaResource | ArrayResource> {
  getAll(): Promise<T[]>;
  importManyWithResolution(imported: readonly T[]): Promise<ResourceImportResult<T>>;
}

export class ManualProfileBundleService {
  public constructor(
    private readonly formulas: PortableResourceRepository<FormulaResource>,
    private readonly arrays: PortableResourceRepository<ArrayResource>
  ) {}

  public async create(profile: ManualProfile): Promise<ManualProfileBundle> {
    const formulaIds = new Set(profile.generatorBindings
      .filter(({ generatorType, resourceId }) => generatorType === "formula" && resourceId !== null)
      .map(({ resourceId }) => resourceId));
    const arrayIds = new Set(profile.generatorBindings
      .filter(({ generatorType, resourceId }) => generatorType === "array" && resourceId !== null)
      .map(({ resourceId }) => resourceId));
    const [formulas, arrays] = await Promise.all([this.formulas.getAll(), this.arrays.getAll()]);
    return createManualProfileBundle(profile, {
      formulas: formulas.filter(({ id }) => formulaIds.has(id)),
      arrays: arrays.filter(({ id }) => arrayIds.has(id))
    });
  }

  public async resolve(bundle: ManualProfileBundle): Promise<ManualProfile> {
    const [existingFormulas, existingArrays] = await Promise.all([this.formulas.getAll(), this.arrays.getAll()]);
    const formulaMap = new Map<string, string>();
    const arrayMap = new Map<string, string>();
    const formulaAliases = new Map<string, string>();
    const arrayAliases = new Map<string, string>();
    const formulasToImport: FormulaResource[] = [];
    const arraysToImport: ArrayResource[] = [];
    for (const resource of bundle.formulas) {
      const existing = existingFormulas.find(({ code }) => code === resource.code);
      if (existing !== undefined) { formulaMap.set(resource.id, existing.id); continue; }
      const equivalentPending = formulasToImport.find(({ code }) => code === resource.code);
      if (equivalentPending !== undefined) { formulaAliases.set(resource.id, equivalentPending.id); continue; }
      formulasToImport.push(resource);
    }
    for (const resource of bundle.arrays) {
      const existing = existingArrays.find(({ items }) => isDeepStrictEqual(items, resource.items));
      if (existing !== undefined) { arrayMap.set(resource.id, existing.id); continue; }
      const equivalentPending = arraysToImport.find(({ items }) => isDeepStrictEqual(items, resource.items));
      if (equivalentPending !== undefined) { arrayAliases.set(resource.id, equivalentPending.id); continue; }
      arraysToImport.push(resource);
    }
    if (formulasToImport.length > 0) {
      const result = await this.formulas.importManyWithResolution(formulasToImport);
      for (const [sourceId, resolvedId] of result.idMap) formulaMap.set(sourceId, resolvedId);
      for (const [sourceId, canonicalId] of formulaAliases) {
        const resolvedId = result.idMap.get(canonicalId);
        if (resolvedId !== undefined) formulaMap.set(sourceId, resolvedId);
      }
    }
    if (arraysToImport.length > 0) {
      const result = await this.arrays.importManyWithResolution(arraysToImport);
      for (const [sourceId, resolvedId] of result.idMap) arrayMap.set(sourceId, resolvedId);
      for (const [sourceId, canonicalId] of arrayAliases) {
        const resolvedId = result.idMap.get(canonicalId);
        if (resolvedId !== undefined) arrayMap.set(sourceId, resolvedId);
      }
    }
    return {
      ...structuredClone(bundle.profile),
      generatorBindings: bundle.profile.generatorBindings.map((binding) => ({
        ...structuredClone(binding),
        resourceId: binding.resourceId === null
          ? null
          : binding.generatorType === "formula"
            ? formulaMap.get(binding.resourceId) ?? binding.resourceId
            : binding.generatorType === "array"
              ? arrayMap.get(binding.resourceId) ?? binding.resourceId
              : binding.resourceId
      }))
    };
  }
}
