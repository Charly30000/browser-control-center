import type { VersionedSchema } from "../../../application/persistence/schemaMigration";
import { t } from "../../../localization";
import { MANUAL_PROFILE_SCHEMA_VERSION, defaultViewport } from "../../../domain/manual/manualProfile";
import { FORMULA_SCHEMA_VERSION } from "../../../domain/formulas/formula";
import { ARRAY_RESOURCE_SCHEMA_VERSION } from "../../../domain/arrays/arrayResource";
import { AUTOMATION_SCHEMA_VERSION } from "../../../domain/automations/automation";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Append a one-version step whenever a persisted contract changes; never replace historical steps. */
export const persistedSchemas = {
  manual: {
    name: t("navigation.manual"), firstVersion: 1, currentVersion: MANUAL_PROFILE_SCHEMA_VERSION,
    migrations: [{
      fromVersion: 1, toVersion: 2,
      migrate: (value) => ({
        ...value,
        viewport: record(value.viewport) && typeof value.viewport.width === "number" && typeof value.viewport.height === "number"
          ? { ...defaultViewport(), preset: "custom", width: value.viewport.width, height: value.viewport.height }
          : defaultViewport(),
        generatorBindings: Array.isArray(value.generatorBindings)
          ? value.generatorBindings.map((binding: unknown) => record(binding) ? { ...binding, inputMode: "instant", delayMs: 0 } : binding)
          : value.generatorBindings
      })
    }]
  },
  formulas: { name: t("navigation.formulas"), firstVersion: 1, currentVersion: FORMULA_SCHEMA_VERSION, migrations: [] },
  arrays: { name: t("navigation.arrays"), firstVersion: 1, currentVersion: ARRAY_RESOURCE_SCHEMA_VERSION, migrations: [] },
  automations: { name: t("navigation.automations"), firstVersion: 1, currentVersion: AUTOMATION_SCHEMA_VERSION, migrations: [] }
} satisfies Record<string, VersionedSchema>;
