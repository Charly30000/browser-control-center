import { describe, expect, it } from "vitest";
import { createEmptyManualProfile, createHeader } from "../src/domain/manual/manualProfile";
import { deserializeProfile, serializeProfile } from "../src/infrastructure/persistence/profileSerializer";

describe("serialización de perfiles", () => {
  it("conserva un perfil válido", () => {
    const profile = createEmptyManualProfile("profile-1", "QA", "2026-01-01T00:00:00.000Z");
    profile.headers.push({ ...createHeader("header-1"), key: "X-Test", value: "true" });
    const result = deserializeProfile(serializeProfile(profile));
    expect(result).toEqual({ ok: true, value: profile });
  });

  it("rechaza versiones desconocidas", () => {
    const serialized = JSON.stringify({ ...createEmptyManualProfile("profile-1", "QA"), schemaVersion: 99 });
    const result = deserializeProfile(serialized);
    expect(result.ok).toBe(false);
  });

  it("rechaza estructuras incompletas", () => {
    const result = deserializeProfile(JSON.stringify({ schemaVersion: 1, id: "profile-1" }));
    expect(result.ok).toBe(false);
  });
});
