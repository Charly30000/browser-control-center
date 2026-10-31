import { t } from "../../localization";
import { FORMULA_SCHEMA_VERSION, type FormulaResource } from "../../domain/formulas/formula";
import { failure, success, type Result } from "../../shared/result";
import type { DataCodec } from "../../application/persistence/applicationDataDao";
import { isOptionalEditorPreferences } from "../../domain/resources/editorPreferences";
import { migrateSchema } from "../../application/persistence/schemaMigration";
import { persistedSchemas } from "./migrations/registry";

export const isFormulaResource = (value: unknown): value is FormulaResource => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === FORMULA_SCHEMA_VERSION &&
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.name === "string" &&
    isOptionalEditorPreferences(record.preferences) &&
    typeof record.code === "string" &&
    typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};

export const formulaCodec: DataCodec<FormulaResource> = {
  serialize: (resource) => JSON.stringify(resource, null, 2),
  deserialize: (serialized): Result<FormulaResource> => {
    try {
      const value: unknown = JSON.parse(serialized);
      const migrated = migrateSchema(value, persistedSchemas.formulas);
      if (!migrated.ok) return migrated;
      return isFormulaResource(migrated.value) ? success(migrated.value) : failure(t("text.theFormulaHasAnInvalidStructure"));
    } catch {
      return failure(t("text.theFormulaDoesNotContainValidJSON"));
    }
  }
};
