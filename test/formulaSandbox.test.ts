import type { PlaywrightRuntime } from "../src/infrastructure/browser/playwrightRuntime";
import { describe, expect, it, vi } from "vitest";
import { silentLogger } from "../src/application/logging/logger";
import { createFormula } from "../src/domain/formulas/formula";
import { ChromiumFormulaExecutionService } from "../src/infrastructure/formulas/chromiumFormulaExecutionService";
import type { PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";

describe("sandbox de fórmulas", () => {
  it("mata el proceso dedicado cuando la fórmula excede el timeout", async () => {
    const kill = vi.fn(() => Promise.resolve());
    const server = { wsEndpoint: () => "ws://sandbox", kill };
    const page = {
      addScriptTag: vi.fn(() => Promise.resolve()),
      evaluate: vi.fn(() => new Promise<never>(() => undefined))
    };
    const context = {
      setOffline: vi.fn(() => Promise.resolve()),
      route: vi.fn(() => Promise.resolve()),
      routeWebSocket: vi.fn(() => Promise.resolve()),
      newPage: vi.fn(() => Promise.resolve(page)),
      close: vi.fn(() => Promise.resolve())
    };
    const browser = { newContext: vi.fn(() => Promise.resolve(context)), close: vi.fn(() => Promise.resolve()) };
    const chromium = { launchServer: vi.fn(() => Promise.resolve(server)), connect: vi.fn(() => Promise.resolve(browser)) };
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
    const binaries = { requireExecutablePath: () => Promise.resolve("C:\\managed\\chrome.exe") };
    const service = new ChromiumFormulaExecutionService(binaries, runtime, silentLogger, 10);
    const formula = { ...createFormula("formula", "Bloqueo"), code: "function generate() { while (true) {} }" };

    const result = await service.execute(formula);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("timeout");
    expect(kill).toHaveBeenCalled();
    expect(context.setOffline).toHaveBeenCalledWith(true);
    expect(context.route).toHaveBeenCalled();
    expect(context.routeWebSocket).toHaveBeenCalled();
  });
});
