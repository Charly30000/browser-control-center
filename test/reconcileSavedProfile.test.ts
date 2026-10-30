import { describe, expect, it } from "vitest";
import { createEmptyManualProfile, createGeneratorBinding } from "../src/domain/manual/manualProfile";
import { reconcileSavedProfile } from "../src/domain/manual/reconcileSavedProfile";

describe("respuesta de guardado de Manual", () => {
  it("conserva las ediciones posteriores al envío y aplica el nombre normalizado", () => {
    const submitted = createEmptyManualProfile("profile", " QA ");
    submitted.generatorBindings = [{ ...createGeneratorBinding("input"), expanded: true }];
    const draft = structuredClone(submitted);
    draft.url = "https://changed.test";
    draft.generatorBindings[0]!.expanded = false;
    draft.preferences = { autoSaveEnabled: false };
    const saved = { ...structuredClone(submitted), name: "QA", updatedAt: "2026-10-30T12:00:00Z" };
    expect(reconcileSavedProfile(draft, submitted, saved, true)).toEqual({ ...draft, name: "QA", updatedAt: saved.updatedAt });
    draft.name = "Otro nombre";
    expect(reconcileSavedProfile(draft, submitted, saved, true).name).toBe("Otro nombre");
  });

  it("resuelve los recursos de las filas conservando su orden y los valores nuevos", () => {
    const submitted = createEmptyManualProfile("profile", "QA");
    submitted.generatorBindings = [{ ...createGeneratorBinding("formula"), generatorType: "formula", resourceId: "portable" }];
    const saved = structuredClone(submitted);
    saved.generatorBindings[0]!.resourceId = "resolved";
    const draft = structuredClone(submitted);
    draft.generatorBindings.unshift({ ...createGeneratorBinding("new"), generatorType: "formula", resourceId: "portable" });
    draft.generatorBindings.push({ ...createGeneratorBinding("other"), generatorType: "array", resourceId: "portable" });
    const merged = reconcileSavedProfile(draft, submitted, saved, true);
    expect(merged.generatorBindings.map(({ id, resourceId }) => [id, resourceId])).toEqual([["new", "resolved"], ["formula", "resolved"], ["other", "portable"]]);
    expect(draft.generatorBindings[0]!.resourceId).toBe("portable");
  });

  it("mantiene las referencias del JSON si los recursos se editaron durante el guardado", () => {
    const submitted = createEmptyManualProfile("profile", "QA");
    submitted.generatorBindings = [{ ...createGeneratorBinding("input"), generatorType: "formula", resourceId: "portable" }];
    const saved = structuredClone(submitted);
    saved.generatorBindings[0]!.resourceId = "resolved";
    expect(reconcileSavedProfile(submitted, submitted, saved, false).generatorBindings[0]!.resourceId).toBe("portable");
  });
});
