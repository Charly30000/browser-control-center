import { describe, expect, it } from "vitest";
import { ImportExportDocumentService, decodeWithGuard } from "../src/application/importExport/importExportDocumentService";
import { success } from "../src/shared/result";

const isPayload = (value: unknown): value is { readonly value: string } =>
  typeof value === "object" && value !== null && (value as Record<string, unknown>).value === "válido";

const documents = () => new ImportExportDocumentService(
  "browser-control-center/manual-profile",
  decodeWithGuard(isPayload, "Payload no válido."),
  (serialized) => serialized === JSON.stringify({ value: "válido" })
    ? success({ value: "válido" })
    : { ok: false as const, error: "Documento heredado no válido." }
);

describe("documento común de importación y exportación", () => {
  it("rechaza formatos pertenecientes a otra pantalla", () => {
    const serialized = JSON.stringify({
      format: "browser-control-center/arrays",
      schemaVersion: 1,
      extensionVersion: "0.4.0",
      exportedAt: null,
      data: { value: "válido" }
    });
    const parsed = documents().deserialize(serialized);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("expected format");
  });

  it("rechaza versiones de envelope no compatibles", () => {
    const serialized = JSON.stringify({
      format: "browser-control-center/manual-profile",
      schemaVersion: 99,
      extensionVersion: "0.4.0",
      exportedAt: null,
      data: { value: "válido" }
    });
    const parsed = documents().deserialize(serialized);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("Unsupported import version");
  });

  it("mantiene compatibilidad con documentos directos heredados", () => {
    const parsed = documents().deserialize(JSON.stringify({ value: "válido" }));

    expect(parsed.ok && parsed.value.exportedAt).toBeNull();
    expect(parsed.ok && parsed.value.data).toEqual({ value: "válido" });
  });
});
