import { describe, expect, it } from "vitest";
import { isManualToExtensionMessage } from "../src/shared/messages/manualMessages";

describe("mensajes de la página Manual", () => {
  it("acepta una solicitud de borrado completa", () => {
    expect(isManualToExtensionMessage({ type: "manual.delete", id: "profile-1", name: "QA" })).toBe(true);
  });

  it("rechaza una solicitud de borrado sin nombre", () => {
    expect(isManualToExtensionMessage({ type: "manual.delete", id: "profile-1" })).toBe(false);
  });
});
