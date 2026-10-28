import { describe, expect, it } from "vitest";
import {
  assessDocumentByteCount,
  DOCUMENT_SIZE_WARNING_BYTES,
  MAX_DOCUMENT_BYTES,
  measureUtf8Bytes
} from "../src/domain/importExport/documentSize";

describe("límite documental", () => {
  it("mide bytes UTF-8 y no caracteres UTF-16", () => {
    expect(measureUtf8Bytes("á")).toBe(2);
  });

  it("avisa desde el 80 % y bloquea por encima de 100 MiB", () => {
    expect(assessDocumentByteCount(DOCUMENT_SIZE_WARNING_BYTES - 1).shouldWarn).toBe(false);
    expect(assessDocumentByteCount(DOCUMENT_SIZE_WARNING_BYTES).shouldWarn).toBe(true);
    expect(assessDocumentByteCount(MAX_DOCUMENT_BYTES).exceedsLimit).toBe(false);
    expect(assessDocumentByteCount(MAX_DOCUMENT_BYTES + 1).exceedsLimit).toBe(true);
  });
});
