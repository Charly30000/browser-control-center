import { describe, expect, it } from "vitest";
import type { DataCodec } from "../src/application/persistence/applicationDataDao";
import { createArrayResource } from "../src/domain/arrays/arrayResource";
import { createFormula } from "../src/domain/formulas/formula";
import { createAutomationDocument } from "../src/domain/automations/automation";
import type { EditorPreferences } from "../src/domain/resources/editorPreferences";
import { arrayResourceCodec } from "../src/infrastructure/persistence/arrayResourceSerializer";
import { formulaCodec } from "../src/infrastructure/persistence/formulaSerializer";
import { deserializeAutomation, serializeAutomation } from "../src/infrastructure/persistence/automationSerializer";
import { isArrayToExtensionMessage } from "../src/shared/messages/arrayMessages";
import { isFormulaToExtensionMessage } from "../src/shared/messages/formulaMessages";
import { isAutomationToExtensionMessage } from "../src/shared/messages/automationMessages";

const checkPreferences = <T extends { preferences?: EditorPreferences }>(value: T, codec: DataCodec<T>) => {
  expect(codec.deserialize(codec.serialize(value))).toEqual({ ok: true, value });
  for (const autoSaveEnabled of [true, false]) {
    const withPreferences = { ...value, preferences: { autoSaveEnabled } };
    expect(codec.deserialize(codec.serialize(withPreferences))).toEqual({ ok: true, value: withPreferences });
  }
  for (const preferences of [null, [], { autoSaveEnabled: "true" }, {}]) {
    expect(codec.deserialize(JSON.stringify({ ...value, preferences })).ok).toBe(false);
  }
};

describe("preferencias opcionales de guardado automático", () => {
  it("conserva las preferencias de arrays sin exigirlas a los anteriores", () => {
    checkPreferences(createArrayResource("array", "Array"), arrayResourceCodec);
  });
  it("conserva las preferencias de fórmulas sin exigirlas a las anteriores", () => {
    checkPreferences(createFormula("formula", "Fórmula"), formulaCodec);
  });
  it("conserva las preferencias del documento de automatizaciones", () => {
    checkPreferences(createAutomationDocument("automation"), { serialize: serializeAutomation, deserialize: deserializeAutomation });
  });
  it("valida la correlación de guardados y conserva mensajes anteriores", () => {
    const cases = [
      { guard: isArrayToExtensionMessage, message: { type: "array.save", resource: createArrayResource("array", "Array") } },
      { guard: isFormulaToExtensionMessage, message: { type: "formula.save", resource: createFormula("formula", "Fórmula") } },
      { guard: isAutomationToExtensionMessage, message: { type: "automation.save", document: createAutomationDocument("automation") } }
    ];
    for (const { guard, message } of cases) {
      expect(guard(message)).toBe(true);
      expect(guard({ ...message, requestId: "save-1" })).toBe(true);
      expect(guard({ ...message, requestId: 1 })).toBe(false);
    }
  });
});
