import { describe, expect, it } from "vitest";
import { FormulaService } from "../src/application/formulas/formulaService";
import { ArrayResourceService } from "../src/application/arrays/arrayResourceService";
import type { ArrayResource } from "../src/domain/arrays/arrayResource";
import type { FormulaResource } from "../src/domain/formulas/formula";
import type { GlobalResource } from "../src/domain/resources/globalResource";
import type { ResourceCrudService } from "../src/application/resources/resourceCrudService";
import { createMetadataDao, InMemoryResourceDao } from "./resourceTestUtils";

const verifyMissingFiles = async <T extends GlobalResource>(create: (dao: InMemoryResourceDao<T>, metadata: ReturnType<typeof createMetadataDao>) => ResourceCrudService<T>): Promise<void> => {
    const dao = new InMemoryResourceDao<T>();
    const metadata = createMetadataDao();
    const service = create(dao, metadata);
    const first = await service.save(service.createDraft().resource);
    const second = await service.save(service.createDraft().resource);
    dao.values.delete(second.resource.id);
    expect((await service.getSummaries()).map(({ id }) => id)).toEqual([first.resource.id]);
    expect((await service.getInitialState()).resource.id).toBe(first.resource.id);
    dao.values.clear();
    expect(await service.getSummaries()).toEqual([]);
    expect(metadata.get().selectedResourceId).toBeNull();
};

describe("CRUD de recursos", () => {
  it("no muestra fórmulas cuyo archivo se ha eliminado", () => verifyMissingFiles<FormulaResource>((dao, metadata) => new FormulaService(dao, metadata)));
  it("no muestra arrays cuyo archivo se ha eliminado", () => verifyMissingFiles<ArrayResource>((dao, metadata) => new ArrayResourceService(dao, metadata)));

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
    await expect(service.save({ ...second, name: "DUPLICATE" })).rejects.toThrow("already exists");
  });
});
