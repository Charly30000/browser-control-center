import { describe, expect, it } from "vitest";
import historical from "./fixtures/persistence/historical.json";
import automationV2 from "./fixtures/persistence/automation-v2.json";
import { ImportExportDocumentService, decodeWithCodec } from "../src/application/importExport/importExportDocumentService";
import { serializeAutomation } from "../src/infrastructure/persistence/automationSerializer";
import { migrateSchema, type VersionedSchema } from "../src/application/persistence/schemaMigration";
import { persistedSchemas } from "../src/infrastructure/persistence/migrations/registry";
import { deserializeProfile } from "../src/infrastructure/persistence/profileSerializer";
import { deserializeAutomation } from "../src/infrastructure/persistence/automationSerializer";
import { formulaCodec } from "../src/infrastructure/persistence/formulaSerializer";
import { arrayResourceCodec } from "../src/infrastructure/persistence/arrayResourceSerializer";

const readers = { manual: deserializeProfile, automations: deserializeAutomation, formulas: (serialized: string) => formulaCodec.deserialize(serialized), arrays: (serialized: string) => arrayResourceCodec.deserialize(serialized) };
describe("versioned persisted JSON migrations", () => {
  it("retains every historical automation value while upgrading the supported node contract", () => {
    const decoded = deserializeAutomation(JSON.stringify(historical.automations));
    expect(decoded).toEqual({ ok: true, value: { ...historical.automations, schemaVersion: 2 } });
    expect(deserializeAutomation(JSON.stringify(automationV2))).toEqual({ ok: true, value: automationV2 });
  });

  it("upgrades historical automation imports through the same codec", () => {
    const service = new ImportExportDocumentService("browser-control-center/automations", decodeWithCodec({ serialize: serializeAutomation, deserialize: deserializeAutomation }));
    const decoded = service.deserialize(JSON.stringify({ format: "browser-control-center/automations", schemaVersion: 1, extensionVersion: "0.4.0", exportedAt: null, data: historical.automations }));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.data).toEqual({ ...historical.automations, schemaVersion: 2 });
  });
  it.each(Object.keys(readers) as (keyof typeof readers)[])("reads historical %s data and preserves identity and dates", (name) => {
    const original = structuredClone(historical[name]);
    const decoded = readers[name](JSON.stringify(original));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.value.schemaVersion).toBe(persistedSchemas[name].currentVersion);
    expect(decoded.value).toMatchObject({ id: original.id, name: original.name, createdAt: original.createdAt, updatedAt: original.updatedAt });
    expect(historical[name]).toEqual(original);
  });

  it("applies multiple sequential steps without mutating the source", () => {
    const original = { schemaVersion: 1, id: "keep-id", custom: { keep: true } };
    const schema: VersionedSchema = { name: "Test", firstVersion: 1, currentVersion: 3, migrations: [
      { fromVersion: 1, toVersion: 2, migrate: (value) => ({ ...value, added: "first" }) },
      { fromVersion: 2, toVersion: 3, migrate: (value) => ({ ...value, final: value.added }) }
    ] };
    expect(migrateSchema(original, schema)).toEqual({ ok: true, value: { ...original, schemaVersion: 3, added: "first", final: "first" } });
    expect(original).toEqual({ schemaVersion: 1, id: "keep-id", custom: { keep: true } });
  });

  it("fails when a version is increased without registering every historical step", () => {
    const schema: VersionedSchema = { name: "Test", firstVersion: 1, currentVersion: 3, migrations: [] };
    expect(migrateSchema({ schemaVersion: 1 }, schema)).toMatchObject({ ok: false });
    expect(migrateSchema({ schemaVersion: 3 }, schema)).toMatchObject({ ok: false });
  });

  it.each(Object.keys(readers) as (keyof typeof readers)[])("rejects future %s versions", (name) => {
    const decoded = readers[name](JSON.stringify({ ...historical[name], schemaVersion: 999 }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toContain("newer");
  });

  it("preserves the existing Manual v1 values while adding v2 fields", () => {
    const decoded = deserializeProfile(JSON.stringify(historical.manual));
    expect(decoded).toMatchObject({ ok: true, value: { headers: historical.manual.headers, cookies: historical.manual.cookies, viewport: { width: 800, height: 600 }, generatorBindings: [{ ...historical.manual.generatorBindings[0], inputMode: "instant", delayMs: 0 }] } });
  });
});
