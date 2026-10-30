import { ARRAY_RESOURCE_SCHEMA_VERSION, type ArrayResource } from "../../domain/arrays/arrayResource";
import { isJsonValue } from "../../domain/manual/storageValue";
import { failure, success, type Result } from "../../shared/result";
import type { DataCodec } from "../../application/persistence/applicationDataDao";
import { isOptionalEditorPreferences } from "../../domain/resources/editorPreferences";

export const isArrayResource = (value: unknown): value is ArrayResource => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === ARRAY_RESOURCE_SCHEMA_VERSION &&
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.name === "string" &&
    isOptionalEditorPreferences(record.preferences) &&
    Array.isArray(record.items) && record.items.every(isJsonValue) &&
    typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};

export const arrayResourceCodec: DataCodec<ArrayResource> = {
  serialize: (resource) => JSON.stringify(resource, null, 2),
  deserialize: (serialized): Result<ArrayResource> => {
    try {
      const value: unknown = JSON.parse(serialized);
      return isArrayResource(value) ? success(value) : failure("El array no tiene una estructura válida.");
    } catch {
      return failure("El array no contiene JSON válido.");
    }
  }
};
