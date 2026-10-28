import { describe, expect, it, vi } from "vitest";
import type { PlaywrightRuntime, PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";
import { silentLogger } from "../src/application/logging/logger";
import { createFormula } from "../src/domain/formulas/formula";
import type { JsonValue } from "../src/domain/manual/storageValue";
import { PlaywrightFormulaExecutionService } from "../src/infrastructure/formulas/playwrightFormulaExecutionService";

const serviceFor = (execution: () => Promise<unknown>): PlaywrightFormulaExecutionService => {
  const server = { wsEndpoint: () => "ws://sandbox", kill: vi.fn(() => Promise.resolve()) };
  const page = { addScriptTag: vi.fn(() => Promise.resolve()), evaluate: vi.fn(execution) };
  const context = {
    setOffline: vi.fn(() => Promise.resolve()), route: vi.fn(() => Promise.resolve()),
    routeWebSocket: vi.fn(() => Promise.resolve()), newPage: vi.fn(() => Promise.resolve(page)),
    close: vi.fn(() => Promise.resolve())
  };
  const browser = { newContext: vi.fn(() => Promise.resolve(context)), close: vi.fn(() => Promise.resolve()) };
  const chromium = { launchServer: vi.fn(() => Promise.resolve(server)), connect: vi.fn(() => Promise.resolve(browser)) };
  const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
  const selection = { resolveLaunchConfiguration: () => Promise.resolve({ providerId: "managed-chromium" as const, displayName: "Chromium administrado", engine: "chromium" as const, executablePath: "C:\\managed\\chrome.exe", channel: null }) };
  return new PlaywrightFormulaExecutionService(selection, runtime, silentLogger, 100);
};

describe("resultados de fórmulas", () => {
  it.each<[JsonValue | undefined, string]>([
    ["texto", "string"], [42, "number"], [true, "boolean"], [null, "null"],
    [{ value: 1 }, "object"], [[1, "dos"], "array"], [undefined, "undefined"]
  ])("acepta %j como %s", async (value, valueType) => {
    const result = await serviceFor(() => Promise.resolve(value)).execute(createFormula("formula", "Prueba"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ value, valueType });
  });

  it("propaga excepciones y rechazos asíncronos como resultado fallido", async () => {
    const result = await serviceFor(() => Promise.reject(new Error("fallo controlado"))).execute(createFormula("formula", "Prueba"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("fallo controlado");
  });

  it("rechaza retornos que no pertenecen al modelo JSON", async () => {
    const result = await serviceFor(() => Promise.resolve(1n)).execute(createFormula("formula", "Prueba"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("valor JSON");
  });
});
