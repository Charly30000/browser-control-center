import { describe, expect, it } from "vitest";
import { FormulaService } from "../src/application/formulas/formulaService";
import type { FormulaResource } from "../src/domain/formulas/formula";
import { createMetadataDao, InMemoryResourceDao } from "./resourceTestUtils";

describe("CRUD de recursos", () => {
  it("crea, guarda, selecciona y elimina fórmulas", async () => {
    const dao = new InMemoryResourceDao<FormulaResource>();
    const service = new FormulaService(dao, createMetadataDao());
    const draft = service.createDraft().resource;
    const saved = await service.save({ ...draft, name: "randomEmail" });
    expect(saved.resources.map(({ name }) => name)).toEqual(["randomEmail"]);
    expect((await service.select(draft.id)).resource.name).toBe("randomEmail");
    const afterDelete = await service.deleteSelected([draft.id]);
    expect(afterDelete.resources).toEqual([]);
    expect(afterDelete.savedResource).toBeNull();
  });

  it("rechaza nombres duplicados", async () => {
    const dao = new InMemoryResourceDao<FormulaResource>();
    const service = new FormulaService(dao, createMetadataDao());
    const first = service.createDraft().resource;
    await service.save({ ...first, name: "duplicate" });
    const second = service.createDraft().resource;
    await expect(service.save({ ...second, name: "DUPLICATE" })).rejects.toThrow("Ya existe");
  });
});
