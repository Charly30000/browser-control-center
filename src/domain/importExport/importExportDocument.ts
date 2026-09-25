export const IMPORT_EXPORT_SCHEMA_VERSION = 1 as const;
export const CURRENT_EXTENSION_VERSION = "0.4.0";

export type ImportExportFormat =
  | "browser-control-center/manual-profile"
  | "browser-control-center/formulas"
  | "browser-control-center/arrays"
  | "browser-control-center/automations";

export interface ImportExportDocument<T> {
  readonly format: ImportExportFormat;
  readonly schemaVersion: typeof IMPORT_EXPORT_SCHEMA_VERSION;
  readonly extensionVersion: string;
  readonly exportedAt: string | null;
  readonly data: T;
}

export const createImportExportDocument = <T>(
  format: ImportExportFormat,
  data: T,
  exportedAt = new Date().toISOString()
): ImportExportDocument<T> => ({
  format,
  schemaVersion: IMPORT_EXPORT_SCHEMA_VERSION,
  extensionVersion: CURRENT_EXTENSION_VERSION,
  exportedAt,
  data
});
