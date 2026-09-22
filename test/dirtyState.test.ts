import { describe, expect, it } from "vitest";
import { createEmptyManualProfile } from "../src/domain/manual/manualProfile";
import { isProfileDirty } from "../src/domain/manual/dirtyState";

describe("dirty state", () => {
  it("considera sucio un borrador nunca guardado", () => {
    expect(isProfileDirty(createEmptyManualProfile("1", "untitled"), null)).toBe(true);
  });

  it("ignora únicamente las fechas técnicas", () => {
    const saved = createEmptyManualProfile("1", "QA", "2026-01-01T00:00:00.000Z");
    const draft = { ...structuredClone(saved), updatedAt: "2026-02-01T00:00:00.000Z" };
    expect(isProfileDirty(draft, saved)).toBe(false);
    draft.url = "https://changed.example.com";
    expect(isProfileDirty(draft, saved)).toBe(true);
  });
});
