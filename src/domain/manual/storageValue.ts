import { t } from "../../localization";
import { failure, success, type Result } from "../../shared/result";
import type { StorageValueType } from "./manualProfile";

export type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
};

export const parseStorageValue = (type: StorageValueType, rawValue: string): Result<JsonValue> => {
  switch (type) {
    case "string":
      return success(rawValue);
    case "number": {
      if (rawValue.trim() === "") {
        return failure(t("text.theNumericValueCannotBeEmpty"));
      }
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? success(parsed) : failure(t("text.theNumberIsInvalid"));
    }
    case "boolean":
      if (rawValue === "true") return success(true);
      if (rawValue === "false") return success(false);
      return failure(t("text.theBooleanMustBeTrueOrFalse"));
    case "json":
      try {
        const parsed: unknown = JSON.parse(rawValue);
        return isJsonValue(parsed) ? success(parsed) : failure(t("text.theJSONContainsAnUnsupportedValue"));
      } catch {
        return failure(t("text.theJSONIsInvalid"));
      }
    case "null":
      return rawValue.trim() === "" || rawValue.trim() === "null"
        ? success(null)
        : failure(t("text.theNullTypeOnlyAcceptsAnEmptyValueOrNull"));
  }
};
