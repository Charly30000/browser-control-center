import { describe, expect, it } from "vitest";
import { ResourceDocumentService } from "../src/application/resources/resourceDocumentService";
import { ResourceImportService } from "../src/application/resources/resourceImportService";
import { createFormula, type FormulaResource } from "../src/domain/formulas/formula";
import { isFormulaResource } from "../src/infrastructure/persistence/formulaSerializer";

describe("importación y exportación de recursos", () => {
  it("genera y lee el envelope versionado", () => {
    const documents = new ResourceDocumentService("browser-control-center/formulas", isFormulaResource);
    const formula = createFormula("1", "test", "2026-01-01T00:00:00.000Z");
    const parsed = documents.deserialize(documents.serialize([formula]));
    expect(parsed.ok && parsed.value.format).toBe("browser-control-center/formulas");
    expect(parsed.ok && parsed.value.data).toEqual([formula]);
  });

  it("reutiliza mismo ID y contenido", () => {
    const formula = createFormula("same", "test", "2026-01-01T00:00:00.000Z");
    const result = resolve([formula], [structuredClone(formula)]);
    expect(result.resourcesToSave).toEqual([]);
    expect(result.idMap.get("same")).toBe("same");
  });

  it("genera UUID alternativo para contenido distinto", () => {
    const existing = createFormula("same", "test", "2026-01-01T00:00:00.000Z");
    const imported = { ...createFormula("same", "test", "2026-01-01T00:00:00.000Z"), code: "function generate() { return 2; }" };
    const result = resolve([existing], [imported]);
    expect(result.resourcesToSave[0]?.id).toBe("new-id");
    expect(result.idMap.get("same")).toBe("new-id");
  });
});

const resolve = (existing: readonly FormulaResource[], imported: readonly FormulaResource[]) =>
  new ResourceImportService().resolve(existing, imported, () => "new-id", {
    withIdentity: (resource, id, name, now) => ({ ...resource, id, name, updatedAt: now })
  }, "2026-02-01T00:00:00.000Z");
