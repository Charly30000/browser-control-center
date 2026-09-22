import { describe, expect, it } from "vitest";
import { createEmptyManualProfile, createGeneratorBinding, VIEWPORT_PRESETS } from "../src/domain/manual/manualProfile";
import { deserializeProfile } from "../src/infrastructure/persistence/profileSerializer";

describe("viewports y migración de perfiles", () => {
  it("expone los presets requeridos", () => {
    expect(VIEWPORT_PRESETS.desktop).toMatchObject({ width: 1920, height: 1080 });
    expect(VIEWPORT_PRESETS.laptop).toMatchObject({ width: 1366, height: 768 });
    expect(VIEWPORT_PRESETS.mobileLandscape.width).toBeGreaterThan(VIEWPORT_PRESETS.mobileLandscape.height);
  });

  it("migra perfiles v1 sin perder viewport ni generadores", () => {
    const current = createEmptyManualProfile("profile", "QA");
    const binding = createGeneratorBinding("binding");
    const legacyBinding = { ...binding } as Record<string, unknown>;
    delete legacyBinding.inputMode;
    delete legacyBinding.delayMs;
    const legacy = { ...current, schemaVersion: 1, viewport: { width: 800, height: 600 }, generatorBindings: [legacyBinding] };
    const result = deserializeProfile(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(2);
      expect(result.value.viewport).toMatchObject({ preset: "custom", width: 800, height: 600 });
      expect(result.value.generatorBindings[0]).toMatchObject({ inputMode: "instant", delayMs: 0 });
    }
  });
});
