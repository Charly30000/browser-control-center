import { describe, expect, it, vi } from "vitest";
import type { ResourceImportResult } from "../src/application/resources/resourceCrudService";
import { ManualProfileBundleService, type PortableResourceRepository } from "../src/application/importExport/manualProfileBundleService";
import { createArrayResource, type ArrayResource } from "../src/domain/arrays/arrayResource";
import { createFormula, type FormulaResource } from "../src/domain/formulas/formula";
import { createManualProfileBundle } from "../src/domain/importExport/manualProfileBundle";
import { createEmptyManualProfile, createGeneratorBinding } from "../src/domain/manual/manualProfile";

const repository = <T extends FormulaResource | ArrayResource>(initial: readonly T[]) => {
  const stored = [...structuredClone(initial)];
  const importManyWithResolution = vi.fn(async (imported: readonly T[]): Promise<ResourceImportResult<T>> => {
    const idMap = new Map<string, string>();
    for (const resource of imported) {
      const id = `imported-${resource.id}`;
      idMap.set(resource.id, id);
      stored.push({ ...structuredClone(resource), id, name: `${resource.name} importado` } as T);
    }
    const resource = stored[0] ?? structuredClone(imported[0]);
    if (resource === undefined) throw new Error("El repositorio de prueba está vacío.");
    return {
      idMap,
      state: {
        resource,
        savedResource: structuredClone(resource),
        resources: stored.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      }
    };
  });
  const value: PortableResourceRepository<T> = { getAll: async () => structuredClone(stored), importManyWithResolution };
  return { value, stored, importManyWithResolution };
};

const profileWithResources = (formulaId: string, arrayId: string) => {
  const profile = createEmptyManualProfile("profile-1", "Perfil");
  const formulaBinding = createGeneratorBinding("binding-formula");
  formulaBinding.generatorType = "formula";
  formulaBinding.resourceId = formulaId;
  const arrayBinding = createGeneratorBinding("binding-array");
  arrayBinding.generatorType = "array";
  arrayBinding.resourceId = arrayId;
  profile.generatorBindings = [formulaBinding, arrayBinding];
  return profile;
};

describe("paquete portátil de Manual", () => {
  it("exporta únicamente las fórmulas y arrays referenciados por el perfil", async () => {
    const formula = createFormula("formula-1", "Usada");
    const unusedFormula = createFormula("formula-2", "No usada");
    const array = createArrayResource("array-1", "Usado");
    const unusedArray = createArrayResource("array-2", "No usado");
    const formulas = repository([formula, unusedFormula]);
    const arrays = repository([array, unusedArray]);
    const service = new ManualProfileBundleService(formulas.value, arrays.value);

    const bundle = await service.create(profileWithResources(formula.id, array.id));

    expect(bundle.formulas.map(({ id }) => id)).toEqual([formula.id]);
    expect(bundle.arrays.map(({ id }) => id)).toEqual([array.id]);
  });

  it("reutiliza recursos equivalentes y repara las referencias sin importar duplicados", async () => {
    const existingFormula = { ...createFormula("local-formula", "Local"), code: "function generate() { return 'mismo'; }" };
    const importedFormula = { ...createFormula("remote-formula", "Remota"), code: existingFormula.code };
    const existingArray = createArrayResource("local-array", "Local");
    existingArray.items = [{ a: 1, b: 2 }];
    const importedArray = createArrayResource("remote-array", "Remoto");
    importedArray.items = [{ b: 2, a: 1 }];
    const formulas = repository([existingFormula]);
    const arrays = repository([existingArray]);
    const service = new ManualProfileBundleService(formulas.value, arrays.value);

    const resolved = await service.resolve(createManualProfileBundle(
      profileWithResources(importedFormula.id, importedArray.id),
      { formulas: [importedFormula], arrays: [importedArray] }
    ));

    expect(resolved.generatorBindings.map(({ resourceId }) => resourceId)).toEqual([existingFormula.id, existingArray.id]);
    expect(formulas.importManyWithResolution).not.toHaveBeenCalled();
    expect(arrays.importManyWithResolution).not.toHaveBeenCalled();
  });

  it("importa una sola vez el contenido nuevo y lo reutiliza en resoluciones posteriores", async () => {
    const importedFormula = { ...createFormula("remote-formula", "Remota"), code: "function generate() { return 'nuevo'; }" };
    const importedArray = createArrayResource("remote-array", "Remoto");
    importedArray.items = ["nuevo"];
    const formulas = repository<FormulaResource>([]);
    const arrays = repository<ArrayResource>([]);
    const service = new ManualProfileBundleService(formulas.value, arrays.value);
    const bundle = createManualProfileBundle(
      profileWithResources(importedFormula.id, importedArray.id),
      { formulas: [importedFormula], arrays: [importedArray] }
    );

    const first = await service.resolve(bundle);
    const second = await service.resolve(bundle);

    expect(first.generatorBindings.map(({ resourceId }) => resourceId)).toEqual(["imported-remote-formula", "imported-remote-array"]);
    expect(second.generatorBindings.map(({ resourceId }) => resourceId)).toEqual(["imported-remote-formula", "imported-remote-array"]);
    expect(formulas.importManyWithResolution).toHaveBeenCalledTimes(1);
    expect(arrays.importManyWithResolution).toHaveBeenCalledTimes(1);
  });

  it("deduplica contenidos equivalentes incluidos varias veces en el mismo paquete", async () => {
    const firstFormula = { ...createFormula("formula-a", "A"), code: "function generate() { return 1; }" };
    const secondFormula = { ...createFormula("formula-b", "B"), code: firstFormula.code };
    const firstArray = createArrayResource("array-a", "A"); firstArray.items = [{ value: 1 }];
    const secondArray = createArrayResource("array-b", "B"); secondArray.items = [{ value: 1 }];
    const formulas = repository<FormulaResource>([]);
    const arrays = repository<ArrayResource>([]);
    const service = new ManualProfileBundleService(formulas.value, arrays.value);
    const profile = profileWithResources(secondFormula.id, secondArray.id);

    const resolved = await service.resolve(createManualProfileBundle(profile, {
      formulas: [firstFormula, secondFormula],
      arrays: [firstArray, secondArray]
    }));

    expect(resolved.generatorBindings.map(({ resourceId }) => resourceId)).toEqual(["imported-formula-a", "imported-array-a"]);
    expect(formulas.importManyWithResolution.mock.calls[0]?.[0]).toHaveLength(1);
    expect(arrays.importManyWithResolution.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
