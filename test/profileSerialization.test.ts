import { describe, expect, it } from "vitest";
import { createCookie, createEmptyManualProfile, createGeneratorBinding, createHeader, createRequestOverride } from "../src/domain/manual/manualProfile";
import { deserializeProfile, serializeProfile } from "../src/infrastructure/persistence/profileSerializer";

describe("serialización de perfiles", () => {
  it("conserva un perfil válido", () => {
    const profile = createEmptyManualProfile("profile-1", "QA", "2026-01-01T00:00:00.000Z");
    profile.headers.push({ ...createHeader("header-1"), key: "X-Test", value: "true" });
    const result = deserializeProfile(serializeProfile(profile));
    expect(result).toEqual({ ok: true, value: profile });
  });

  it("conserva texto fijo y admite bindings v2 anteriores sin ese campo", () => {
    const profile = createEmptyManualProfile("profile-1", "QA");
    profile.generatorBindings.push({ ...createGeneratorBinding("binding-1"), literalValue: "Ada" });
    expect(deserializeProfile(serializeProfile(profile))).toEqual({ ok: true, value: profile });

    const legacyShape = structuredClone(profile);
    delete legacyShape.generatorBindings[0]?.literalValue;
    expect(deserializeProfile(JSON.stringify(legacyShape)).ok).toBe(true);
  });

  it("rechaza versiones desconocidas", () => {
    const serialized = JSON.stringify({ ...createEmptyManualProfile("profile-1", "QA"), schemaVersion: 99 });
    const result = deserializeProfile(serialized);
    expect(result.ok).toBe(false);
  });

  it("conserva las preferencias de expansión y guardado automático sin exigirlas a perfiles anteriores", () => {
    const profile = createEmptyManualProfile("profile", "Preferencias");
    profile.preferences = { autoSaveEnabled: true };
    profile.cookies = [{ ...createCookie("cookie"), expanded: true }];
    profile.requestOverrides = [{ ...createRequestOverride("override"), expanded: false }];
    profile.generatorBindings = [{ ...createGeneratorBinding("input"), expanded: false }];
    expect(deserializeProfile(serializeProfile(profile))).toEqual({ ok: true, value: profile });

    delete profile.preferences;
    for (const row of [...profile.cookies, ...profile.requestOverrides, ...profile.generatorBindings]) delete row.expanded;
    expect(deserializeProfile(serializeProfile(profile))).toEqual({ ok: true, value: profile });
  });

  it("rechaza preferencias de tipos incorrectos", () => {
    const profile = createEmptyManualProfile("profile", "Preferencias");
    expect(deserializeProfile(JSON.stringify({ ...profile, preferences: { autoSaveEnabled: "true" } })).ok).toBe(false);
    for (const [field, row] of [
      ["cookies", createCookie("cookie")], ["requestOverrides", createRequestOverride("override")], ["generatorBindings", createGeneratorBinding("input")]
    ] as const) {
      expect(deserializeProfile(JSON.stringify({ ...profile, [field]: [{ ...row, expanded: "false" }] })).ok).toBe(false);
    }
  });

  it("rechaza estructuras incompletas", () => {
    const result = deserializeProfile(JSON.stringify({ schemaVersion: 1, id: "profile-1" }));
    expect(result.ok).toBe(false);
  });
});
