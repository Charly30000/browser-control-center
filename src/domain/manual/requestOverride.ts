import { failure, success, type Result } from "../../shared/result";
import type { HeaderEntry, RequestOverrideEntry } from "./manualProfile";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isHeaderEntry = (value: unknown): value is HeaderEntry => isRecord(value)
  && typeof value.id === "string"
  && typeof value.key === "string"
  && typeof value.value === "string"
  && typeof value.enabled === "boolean";

export const isRequestOverrideEntry = (value: unknown): value is RequestOverrideEntry => {
  if (!isRecord(value)) return false;
  const candidate = value as unknown as RequestOverrideEntry;
  return typeof candidate.id === "string"
    && ["exact", "glob", "regex"].includes(candidate.matcherType)
    && typeof candidate.matcher === "string"
    && ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(candidate.method)
    && ["fulfill", "abort", "continue-modified"].includes(candidate.action)
    && typeof candidate.status === "number"
    && Array.isArray(candidate.headers)
    && candidate.headers.every(isHeaderEntry)
    && typeof candidate.body === "string"
    && typeof candidate.contentType === "string"
    && typeof candidate.enabled === "boolean";
};

export const validateRequestOverride = (override: RequestOverrideEntry): Result<RequestOverrideEntry> => {
  if (override.matcher.trim() === "") {
    return failure("El matcher del override es obligatorio.");
  }
  if (override.matcherType === "regex") {
    try {
      new RegExp(override.matcher);
    } catch {
      return failure("La expresión regular del override no es válida.");
    }
  }
  if (override.action === "fulfill" && (!Number.isInteger(override.status) || override.status < 100 || override.status > 599)) {
    return failure("El estado HTTP debe ser un entero entre 100 y 599.");
  }
  return success(override);
};
