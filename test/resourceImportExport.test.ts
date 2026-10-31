import { describe, expect, it } from "vitest";
import { ImportExportDocumentService, decodeResourceCollection } from "../src/application/importExport/importExportDocumentService";
import { ResourceImportService } from "../src/application/importExport/resourceImportService";
import { createFormula, type FormulaResource } from "../src/domain/formulas/formula";
import { CURRENT_EXTENSION_VERSION } from "../src/shared/extensionVersion";
import { isFormulaResource } from "../src/infrastructure/persistence/formulaSerializer";

describe("importación y exportación de recursos", () => {
  it("genera y lee el envelope versionado", () => {
    const documents = formulaDocuments();
    const formula = createFormula("1", "test", "2026-01-01T00:00:00.000Z");
    const serialized = documents.serialize([formula]);
    const envelope = JSON.parse(serialized) as Record<string, unknown>;
    const parsed = documents.deserialize(serialized);

    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.extensionVersion).toBe(CURRENT_EXTENSION_VERSION);
    expect(typeof envelope.exportedAt).toBe("string");
    expect(parsed.ok && parsed.value.format).toBe("browser-control-center/formulas");
    expect(parsed.ok && parsed.value.data).toEqual([formula]);
  });

  it("reutiliza el recurso cuando coinciden el ID y todo el contenido serializado", () => {
    const formula = createFormula("same", "test", "2026-01-01T00:00:00.000Z");
    const result = resolve([formula], [structuredClone(formula)]);

    expect(result.resourcesToSave).toEqual([]);
    expect(result.idMap.get("same")).toBe("same");
  });

  it("regenera ID y nombre cuando el ID existe con contenido diferente", () => {
    const existing = createFormula("same", "test", "2026-01-01T00:00:00.000Z");
    const imported = { ...existing, code: "function generate() { return 'distinto'; }" };
    const result = resolve([existing], [imported]);

    expect(result.resourcesToSave[0]).toMatchObject({ id: "new-id", name: "test-1" });
    expect(result.idMap.get("same")).toBe("new-id");
  });

  it("regenera ID y nombre si solo coincide el nombre, sin distinguir mayúsculas", () => {
    const existing = createFormula("existing", "Test", "2026-01-01T00:00:00.000Z");
    const imported = createFormula("imported", " test ", "2026-01-01T00:00:00.000Z");
    const result = resolve([existing], [imported]);

    expect(result.resourcesToSave[0]).toMatchObject({ id: "new-id", name: "test-1" });
    expect(result.idMap.get("imported")).toBe("new-id");
  });

  it("conserva ID y nombre cuando no existe ninguna colisión", () => {
    const imported = createFormula("imported", "nueva", "2026-01-01T00:00:00.000Z");
    const result = resolve([], [imported]);

    expect(result.resourcesToSave[0]).toMatchObject({ id: "imported", name: "nueva" });
    expect(result.idMap.get("imported")).toBe("imported");
  });

  it("rechaza IDs duplicados dentro del mismo archivo", () => {
    const formula = createFormula("same", "uno", "2026-01-01T00:00:00.000Z");
    const serialized = JSON.stringify({
      format: "browser-control-center/formulas",
      schemaVersion: 1,
      extensionVersion: CURRENT_EXTENSION_VERSION,
      exportedAt: "2026-01-01T00:00:00.000Z",
      data: [formula, { ...formula, name: "dos" }]
    });

    const parsed = formulaDocuments().deserialize(serialized);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("duplicate ID");
  });
});

const formulaDocuments = () => new ImportExportDocumentService(
  "browser-control-center/formulas",
  decodeResourceCollection(isFormulaResource, "formulas")
);

const resolve = (existing: readonly FormulaResource[], imported: readonly FormulaResource[]) =>
  new ResourceImportService().resolve(existing, imported, () => "new-id", {
    withIdentity: (resource, id, name, now) => ({ ...resource, id, name, updatedAt: now })
  }, "2026-02-01T00:00:00.000Z");
