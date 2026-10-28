import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import { BrowserAutomationLogger } from "../src/extension/logging/browserAutomationLogger";

const outputChannel = () => {
  const calls = {
    clear: vi.fn(),
    show: vi.fn(),
    appendLine: vi.fn(),
    dispose: vi.fn()
  };
  return { calls, channel: calls as unknown as vscode.OutputChannel };
};

describe("BrowserAutomationLogger", () => {
  it("muestra el panel Salida conservando el foco", () => {
    const output = outputChannel();
    const logger = new BrowserAutomationLogger(output.channel);

    logger.show();

    expect(output.calls.show).toHaveBeenCalledWith(true);
  });

  it("limpia la salida una sola vez al preparar una ejecución", () => {
    const output = outputChannel();
    const logger = new BrowserAutomationLogger(output.channel);

    logger.prepareForExecution();

    expect(output.calls.clear).toHaveBeenCalledTimes(1);
    expect(output.calls.show).toHaveBeenCalledOnce();
    expect(output.calls.show).toHaveBeenCalledWith(false);
    expect(output.calls.clear.mock.invocationCallOrder[0]).toBeLessThan(output.calls.show.mock.invocationCallOrder[0] ?? 0);
  });

  it("envía éxitos y errores al canal de salida", () => {
    const output = outputChannel();
    const logger = new BrowserAutomationLogger(output.channel);
    const error = new Error("fallo visible");

    logger.info("[OK] Proceso correcto");
    logger.error("[ERROR] Proceso fallido", error);

    expect(output.calls.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[info\] \[OK\] Proceso correcto$/));
    expect(output.calls.appendLine).toHaveBeenCalledWith(expect.stringContaining("[error] [ERROR] Proceso fallido"));
    expect(output.calls.appendLine).toHaveBeenCalledWith(expect.stringContaining("fallo visible"));
  });

  it("redacta credenciales antes de escribir mensajes y errores", () => {
    const output = outputChannel();
    const logger = new BrowserAutomationLogger(output.channel);

    logger.error("Authorization: Bearer secreto https://example.test/?token=abc", new Error('{"password":"clave"}'));

    const serialized = output.calls.appendLine.mock.calls.join("\n");
    expect(serialized).not.toContain("secreto");
    expect(serialized).not.toContain("token=abc");
    expect(serialized).not.toContain("clave");
    expect(serialized).toContain("[REDACTADO]");
  });
});
