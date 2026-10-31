import { t } from "../../localization";
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const DOCUMENT_SIZE_WARNING_BYTES = Math.floor(MAX_DOCUMENT_BYTES * 0.8);

export interface DocumentSizeAssessment {
  readonly bytes: number;
  readonly exceedsLimit: boolean;
  readonly shouldWarn: boolean;
}

export const measureUtf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength;

export const assessDocumentByteCount = (bytes: number): DocumentSizeAssessment => ({
  bytes,
  exceedsLimit: bytes > MAX_DOCUMENT_BYTES,
  shouldWarn: bytes >= DOCUMENT_SIZE_WARNING_BYTES
});

export const assessDocumentSize = (serialized: string): DocumentSizeAssessment => {
  // Un carácter UTF-16 ocupa como máximo cuatro bytes en UTF-8. Evita codificar
  // el documento completo en cada pulsación mientras esté lejos del aviso.
  if (serialized.length < DOCUMENT_SIZE_WARNING_BYTES / 4) return assessDocumentByteCount(serialized.length);
  return assessDocumentByteCount(measureUtf8Bytes(serialized));
};

export const formatBytes = (bytes: number): string => {
  const mebibytes = bytes / 1024 / 1024;
  return `${mebibytes.toFixed(mebibytes >= 10 ? 0 : 1)} MiB`;
};

export const documentSizeLimitMessage = (bytes: number): string =>
  t("text.theDocumentUsesArg0ExceedingTheArg1Limit", { arg0: formatBytes(bytes), arg1: formatBytes(MAX_DOCUMENT_BYTES) });
