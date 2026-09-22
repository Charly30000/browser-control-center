import { describe, expect, it } from "vitest";
import { FormulaService } from "../src/application/formulas/formulaService";
import type { FormulaResource } from "../src/domain/formulas/formula";
import { createMetadataStore, InMemoryResourceRepository } from "./resourceTestUtils";

describe("CRUD de recursos", () => {
  it("crea, guarda, selecciona y elimina fórmulas", async () => {
    const repository = new InMemoryResourceRepository<FormulaResource>();
    const service = new FormulaService(repository, createMetadataStore());
    await service.initialize();
    const draft = service.createDraft().resource;
    const saved = await service.save({ ...draft, name: "randomEmail" });
    expect(saved.resources.map(({ name }) => name)).toEqual(["randomEmail"]);
    expect((await service.select(draft.id)).resource.name).toBe("randomEmail");
    const afterDelete = await service.deleteSelected([draft.id]);
    expect(afterDelete.resources).toEqual([]);
    expect(afterDelete.savedResource).toBeNull();
  });

  it("rechaza nombres duplicados", async () => {
    const repository = new InMemoryResourceRepository<FormulaResource>();
    const service = new FormulaService(repository, createMetadataStore());
    const first = service.createDraft().resource;
    await service.save({ ...first, name: "duplicate" });
    const second = service.createDraft().resource;
    await expect(service.save({ ...second, name: "DUPLICATE" })).rejects.toThrow("Ya existe");
  });
});
