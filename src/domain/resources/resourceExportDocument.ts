export const RESOURCE_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const EXTENSION_VERSION = "0.2.0";

export type ResourceDocumentFormat =
  | "browser-control-center/formulas"
  | "browser-control-center/arrays";

export interface ResourceExportDocument<T> {
  readonly format: ResourceDocumentFormat;
  readonly schemaVersion: typeof RESOURCE_DOCUMENT_SCHEMA_VERSION;
  readonly extensionVersion: string;
  readonly data: readonly T[];
}

export const createResourceExportDocument = <T>(
  format: ResourceDocumentFormat,
  data: readonly T[]
): ResourceExportDocument<T> => ({
  format,
  schemaVersion: RESOURCE_DOCUMENT_SCHEMA_VERSION,
  extensionVersion: EXTENSION_VERSION,
  data
});
