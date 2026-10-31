import { t } from "../../localization";
import { ARRAY_RESOURCE_SCHEMA_VERSION, type ArrayResource } from "../../domain/arrays/arrayResource";
import { isJsonValue } from "../../domain/manual/storageValue";
import { failure, success, type Result } from "../../shared/result";
import type { DataCodec } from "../../application/persistence/applicationDataDao";
import { isOptionalEditorPreferences } from "../../domain/resources/editorPreferences";
import { migrateSchema } from "../../application/persistence/schemaMigration";
import { persistedSchemas } from "./migrations/registry";

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
      const migrated = migrateSchema(value, persistedSchemas.arrays);
      if (!migrated.ok) return migrated;
      return isArrayResource(migrated.value) ? success(migrated.value) : failure(t("text.theArrayHasAnInvalidStructure"));
    } catch {
      return failure(t("text.theArrayDoesNotContainValidJSON"));
    }
  }
};
