import { describe, expect, it } from "vitest";
import { createArrayResource } from "../src/domain/arrays/arrayResource";
import { createAutomationDocument } from "../src/domain/automations/automation";
import { createFormula } from "../src/domain/formulas/formula";
import { createEmptyManualProfile } from "../src/domain/manual/manualProfile";
import { isArrayToExtensionMessage } from "../src/shared/messages/arrayMessages";
import { isAutomationToExtensionMessage } from "../src/shared/messages/automationMessages";
import { isFormulaToExtensionMessage } from "../src/shared/messages/formulaMessages";
import { isManualToExtensionMessage } from "../src/shared/messages/manualMessages";

describe("mensajes del editor JSON", () => {
  it("acepta abrir el JSON del elemento concreto de cada pantalla", () => {
    expect(isManualToExtensionMessage({ type: "manual.viewJson", profile: createEmptyManualProfile("profile-1", "QA"), resources: null })).toBe(true);
    expect(isFormulaToExtensionMessage({ type: "formula.viewJson", resource: createFormula("formula-1", "Email") })).toBe(true);
    expect(isArrayToExtensionMessage({ type: "array.viewJson", resource: createArrayResource("array-1", "Países") })).toBe(true);
    expect(isAutomationToExtensionMessage({ type: "automation.viewJson", document: createAutomationDocument("automation-1"), scope: { kind: "group", groupId: "group-1" } })).toBe(true);
  });

  it("exige JSON serializado e identidad actual al aplicar", () => {
    expect(isManualToExtensionMessage({ type: "manual.applyJson", serialized: "{}", currentId: "profile-1" })).toBe(true);
    expect(isFormulaToExtensionMessage({ type: "formula.applyJson", serialized: "{}", currentId: "formula-1" })).toBe(true);
    expect(isArrayToExtensionMessage({ type: "array.applyJson", serialized: "{}", currentId: "array-1" })).toBe(true);
    expect(isAutomationToExtensionMessage({ type: "automation.applyJson", serialized: "{}", scope: { kind: "process", groupId: "group-1", processId: "process-1" } })).toBe(true);

    expect(isManualToExtensionMessage({ type: "manual.applyJson", serialized: "{}" })).toBe(false);
    expect(isFormulaToExtensionMessage({ type: "formula.applyJson", currentId: "formula-1" })).toBe(false);
  });
});
