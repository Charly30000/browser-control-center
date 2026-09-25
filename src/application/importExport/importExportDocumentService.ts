import {
  IMPORT_EXPORT_SCHEMA_VERSION,
  createImportExportDocument,
  type ImportExportDocument,
  type ImportExportFormat
} from "../../domain/importExport/importExportDocument";
import { failure, success, type Result } from "../../shared/result";

export type ImportDataDecoder<T> = (value: unknown) => Result<T>;
export type LegacyDocumentDecoder<T> = (serialized: string) => Result<T>;

export class ImportExportDocumentService<T> {
  public constructor(
    private readonly format: ImportExportFormat,
    private readonly decodeData: ImportDataDecoder<T>,
    private readonly decodeLegacy?: LegacyDocumentDecoder<T>
  ) {}

  public serialize(data: T): string {
    return JSON.stringify(createImportExportDocument(this.format, data), null, 2);
  }

  public deserialize(serialized: string): Result<ImportExportDocument<T>> {
    let value: unknown;
    try { value = JSON.parse(serialized); }
    catch { return failure("El documento no contiene JSON válido."); }
    if (typeof value !== "object" || value === null || Array.isArray(value)) return failure("El documento debe ser un objeto JSON.");
    const record = value as Record<string, unknown>;
    if (record.format === undefined && this.decodeLegacy !== undefined) {
      const legacy = this.decodeLegacy(serialized);
      return legacy.ok ? success({ ...createImportExportDocument(this.format, legacy.value), exportedAt: null }) : legacy;
    }
    if (record.format !== this.format) return failure(`El formato esperado es ${this.format}.`);
    if (record.schemaVersion !== IMPORT_EXPORT_SCHEMA_VERSION) return failure(`Versión de importación no compatible. Se esperaba ${IMPORT_EXPORT_SCHEMA_VERSION}.`);
    if (typeof record.extensionVersion !== "string" || record.extensionVersion.trim() === "") return failure("El documento no indica una versión válida de la extensión.");
    if (record.exportedAt !== undefined && record.exportedAt !== null && (typeof record.exportedAt !== "string" || Number.isNaN(Date.parse(record.exportedAt)))) return failure("La fecha de exportación no es válida.");
    const decoded = this.decodeData(record.data);
    if (!decoded.ok) return decoded;
    return success({
      format: this.format,
      schemaVersion: IMPORT_EXPORT_SCHEMA_VERSION,
      extensionVersion: record.extensionVersion,
      exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : null,
      data: decoded.value
    });
  }
}

export const decodeWithGuard = <T>(guard: (value: unknown) => value is T, error: string): ImportDataDecoder<T> =>
  (value) => guard(value) ? success(value) : failure(error);

export const decodeResourceCollection = <T extends { readonly id: string }>(
  guard: (value: unknown) => value is T,
  label: string
): ImportDataDecoder<readonly T[]> => (value) => {
  if (!Array.isArray(value) || !value.every(guard)) return failure(`Los datos de ${label} no son válidos.`);
  const ids = new Set<string>();
  for (const resource of value) {
    if (ids.has(resource.id)) return failure(`El documento contiene el ID duplicado «${resource.id}».`);
    ids.add(resource.id);
  }
  return success(value);
};
