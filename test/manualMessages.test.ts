import { describe, expect, it } from "vitest";
import { isManualToExtensionMessage } from "../src/shared/messages/manualMessages";
import { createEmptyManualProfile } from "../src/domain/manual/manualProfile";

describe("mensajes de la página Manual", () => {
  it("acepta una solicitud de borrado completa", () => {
    expect(isManualToExtensionMessage({ type: "manual.delete", id: "profile-1", name: "QA" })).toBe(true);
  });

  it("rechaza una solicitud de borrado sin nombre", () => {
    expect(isManualToExtensionMessage({ type: "manual.delete", id: "profile-1" })).toBe(false);
  });

  it("valida la sincronización de overrides con el perfil completo", () => {
    expect(isManualToExtensionMessage({ type: "browser.syncOverrides", profile: createEmptyManualProfile("profile-1", "QA") })).toBe(true);
    expect(isManualToExtensionMessage({ type: "browser.syncOverrides", profile: {} })).toBe(false);
  });

  it("valida las solicitudes de confirmación destructiva", () => {
    expect(isManualToExtensionMessage({ type: "ui.confirmDestructiveAction", requestId: "request-1", confirmation: { question: "¿Eliminar?", detail: "Detalle" } })).toBe(true);
    expect(isManualToExtensionMessage({ type: "ui.confirmDestructiveAction", requestId: "request-1", confirmation: { question: 1 } })).toBe(false);
  });
});
