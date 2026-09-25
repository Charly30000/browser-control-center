import { describe, expect, it } from "vitest";
import { isAutomationToExtensionMessage } from "../src/shared/messages/automationMessages";

describe("mensajes de Automatizaciones", () => {
  it("acepta una petición de selección interactiva para el campo selector", () => {
    expect(isAutomationToExtensionMessage({ type: "automation.selectElement", nodeId: "node-1", fieldKey: "selector" })).toBe(true);
  });

  it("rechaza campos arbitrarios en la selección interactiva", () => {
    expect(isAutomationToExtensionMessage({ type: "automation.selectElement", nodeId: "node-1", fieldKey: "url" })).toBe(false);
  });

  it("valida las solicitudes de confirmación destructiva", () => {
    expect(isAutomationToExtensionMessage({ type: "ui.confirmDestructiveAction", requestId: "request-1", confirmation: { question: "¿Eliminar?" } })).toBe(true);
    expect(isAutomationToExtensionMessage({ type: "ui.confirmDestructiveAction", requestId: 1, confirmation: { question: "¿Eliminar?" } })).toBe(false);
  });
});
