import { t } from "../../localization";
import {
  IMPORT_EXPORT_SCHEMA_VERSION,
  createImportExportDocument,
  type ImportExportDocument,
  type ImportExportFormat
} from "../../domain/importExport/importExportDocument";
import { assessDocumentSize, documentSizeLimitMessage } from "../../domain/importExport/documentSize";
import { failure, success, type Result } from "../../shared/result";
import type { DataCodec } from "../persistence/applicationDataDao";

export type ImportDataDecoder<T> = (value: unknown) => Result<T>;
export type LegacyDocumentDecoder<T> = (serialized: string) => Result<T>;

export class ImportExportDocumentService<T> {
  public constructor(
    private readonly format: ImportExportFormat,
    private readonly decodeData: ImportDataDecoder<T>,
    private readonly decodeLegacy?: LegacyDocumentDecoder<T>
  ) {}

  public serialize(data: T): string {
    const serialized = JSON.stringify(createImportExportDocument(this.format, data), null, 2);
    const size = assessDocumentSize(serialized);
    if (size.exceedsLimit) throw new Error(documentSizeLimitMessage(size.bytes));
    return serialized;
  }

  public deserialize(serialized: string): Result<ImportExportDocument<T>> {
    const size = assessDocumentSize(serialized);
    if (size.exceedsLimit) return failure(documentSizeLimitMessage(size.bytes));
    let value: unknown;
    try { value = JSON.parse(serialized); }
    catch { return failure(t("text.theDocumentDoesNotContainValidJSON")); }
    if (typeof value !== "object" || value === null || Array.isArray(value)) return failure(t("text.theDocumentMustBeAJSONObject"));
    const record = value as Record<string, unknown>;
    if (record.format === undefined && this.decodeLegacy !== undefined) {
      const legacy = this.decodeLegacy(serialized);
      return legacy.ok ? success({ ...createImportExportDocument(this.format, legacy.value), exportedAt: null }) : legacy;
    }
    if (record.format !== this.format) return failure(t("text.theExpectedFormatIsArg0", { arg0: this.format }));
    if (record.schemaVersion !== IMPORT_EXPORT_SCHEMA_VERSION) return failure(t("text.unsupportedImportVersionExpectedArg0", { arg0: IMPORT_EXPORT_SCHEMA_VERSION }));
    if (typeof record.extensionVersion !== "string" || record.extensionVersion.trim() === "") return failure(t("text.theDocumentDoesNotSpecifyAValidExtensionVersion"));
    if (record.exportedAt !== undefined && record.exportedAt !== null && (typeof record.exportedAt !== "string" || Number.isNaN(Date.parse(record.exportedAt)))) return failure(t("text.theExportDateIsInvalid"));
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

export const decodeWithCodec = <T>(codec: DataCodec<T>): ImportDataDecoder<T> =>
  (value) => codec.deserialize(JSON.stringify(value) ?? "null");

export const decodeResourceCollection = <T extends { readonly id: string }>(
  guard: (value: unknown) => value is T,
  label: string,
  codec?: DataCodec<T>
): ImportDataDecoder<readonly T[]> => (value) => {
  if (!Array.isArray(value)) return failure(t("text.theArg0DataIsInvalid", { arg0: label }));
  const resources: T[] = [];
  for (const item of value as unknown[]) {
    if (codec !== undefined) {
      const decoded = decodeWithCodec(codec)(item);
      if (!decoded.ok) return decoded;
      resources.push(decoded.value);
    } else if (guard(item)) resources.push(item);
    else return failure(t("text.theArg0DataIsInvalid", { arg0: label }));
  }
  const ids = new Set<string>();
  for (const resource of resources) {
    if (ids.has(resource.id)) return failure(t("text.theDocumentContainsDuplicateIDArg0", { arg0: resource.id }));
    ids.add(resource.id);
  }
  return success(resources);
};
