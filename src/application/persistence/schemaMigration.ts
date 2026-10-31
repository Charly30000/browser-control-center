import { t } from "../../localization";
import { failure, success, type Result } from "../../shared/result";

export type VersionedRecord = Record<string, unknown>;
export interface SchemaMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(value: VersionedRecord): VersionedRecord;
}
export interface VersionedSchema {
  readonly name: string;
  readonly firstVersion: number;
  readonly currentVersion: number;
  readonly migrations: readonly SchemaMigration[];
}

export const migrateSchema = (value: unknown, schema: VersionedSchema): Result<VersionedRecord> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return failure(t("migration.invalidDocument", { schema: schema.name }));
  const original = value as VersionedRecord;
  const version = original.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < schema.firstVersion) return failure(t("migration.invalidVersion", { schema: schema.name }));
  if (version > schema.currentVersion) return failure(t("migration.futureVersion", { schema: schema.name, version, current: schema.currentVersion }));
  const steps = new Map<number, SchemaMigration>();
  for (const step of schema.migrations) {
    if (step.fromVersion < schema.firstVersion || step.toVersion !== step.fromVersion + 1 || step.toVersion > schema.currentVersion || steps.has(step.fromVersion)) return failure(t("migration.invalidChain", { schema: schema.name }));
    steps.set(step.fromVersion, step);
  }
  for (let previous = schema.firstVersion; previous < schema.currentVersion; previous += 1) {
    if (!steps.has(previous)) return failure(t("migration.missingStep", { schema: schema.name, from: previous, to: previous + 1 }));
  }
  try {
    let migrated = structuredClone(original);
    for (let previous = version; previous < schema.currentVersion; previous += 1) {
      const step = steps.get(previous)!;
      migrated = { ...step.migrate(migrated), schemaVersion: step.toVersion };
    }
    return success(migrated);
  } catch (error: unknown) {
    return failure(t("migration.failed", { schema: schema.name, error: error instanceof Error ? error.message : String(error) }));
  }
};
