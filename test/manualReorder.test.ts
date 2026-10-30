import { describe, expect, it } from "vitest";
import { moveEntry, type EntryDropPosition } from "../src/domain/manual/reorderEntries";
import { createEmptyManualProfile, createGeneratorBinding } from "../src/domain/manual/manualProfile";
import { deserializeProfile, serializeProfile } from "../src/infrastructure/persistence/profileSerializer";

describe("orden de las filas de Manual", () => {
  it.each([
    ["a", "c", "before", ["b", "a", "c", "d"]],
    ["a", "c", "after", ["b", "c", "a", "d"]],
    ["d", "b", "before", ["a", "d", "b", "c"]],
    ["d", "b", "after", ["a", "b", "d", "c"]],
    ["a", "b", "before", ["a", "b", "c", "d"]],
    ["b", "a", "after", ["a", "b", "c", "d"]],
    ["missing", "b", "before", ["a", "b", "c", "d"]],
    ["a", "missing", "after", ["a", "b", "c", "d"]],
    ["a", "a", "after", ["a", "b", "c", "d"]]
  ] satisfies [string, string, EntryDropPosition, string[]][])("mueve %s respecto a %s (%s) conservando todos los datos", (source, target, position, expected) => {
    const rows = ["a", "b", "c", "d"].map((id) => ({ id, value: `valor-${id}`, enabled: id !== "b" }));
    const originals = new Map(rows.map((row) => [row.id, row]));
    moveEntry(rows, source, target, position);
    expect(rows.map(({ id }) => id)).toEqual(expected);
    for (const row of rows) expect(row).toBe(originals.get(row.id));
  });

  it("conserva el nuevo orden al serializar perfiles v2 sin cambiar su identidad", () => {
    const profile = createEmptyManualProfile("saved-id", "Guardado", "2026-01-01T00:00:00.000Z");
    profile.generatorBindings = ["first", "second"].map((id) => ({ ...createGeneratorBinding(id), selector: `#${id}`, literalValue: id }));
    moveEntry(profile.generatorBindings, "second", "first", "before");
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored).toEqual({ ok: true, value: profile });
    expect(profile.id).toBe("saved-id");
    expect(profile.schemaVersion).toBe(2);
    expect(profile.generatorBindings.map(({ id }) => id)).toEqual(["second", "first"]);
  });
});
