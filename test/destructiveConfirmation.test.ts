import { describe, expect, it } from "vitest";
import type { DestructiveConfirmationRequestMessage } from "../src/shared/messages/destructiveConfirmationMessages";
import { DestructiveConfirmationClient } from "../src/webviews/components/confirmDestructiveAction";

describe("confirmación de acciones destructivas", () => {
  it("espera la respuesta del diálogo modal de VS Code", async () => {
    let request: DestructiveConfirmationRequestMessage | undefined;
    const client = new DestructiveConfirmationClient((message) => { request = message; });
    const result = client.confirm({ question: "¿Eliminar?", detail: "Se perderán sus hijos." });

    expect(request).toMatchObject({
      type: "ui.confirmDestructiveAction",
      confirmation: { question: "¿Eliminar?", detail: "Se perderán sus hijos." }
    });
    if (request === undefined) throw new Error("No se envió la solicitud de confirmación.");
    client.resolve({ type: "ui.destructiveActionConfirmed", requestId: request.requestId, confirmed: true });

    await expect(result).resolves.toBe(true);
  });

  it("cancela solicitudes pendientes al desmontar la vista", async () => {
    const client = new DestructiveConfirmationClient(() => undefined);
    const result = client.confirm({ question: "¿Eliminar?" });

    client.cancelPending();

    await expect(result).resolves.toBe(false);
  });
});
