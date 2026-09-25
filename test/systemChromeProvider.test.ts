import { describe, expect, it, vi } from "vitest";
import type { PlaywrightRuntime, PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";
import { SystemChromeProvider } from "../src/infrastructure/browser/providers/systemChromeProvider";

describe("SystemChromeProvider", () => {
  it("detecta Chrome mediante su canal estable sin usar un perfil personal", async () => {
    const close = vi.fn(() => Promise.resolve());
    const launch = vi.fn(() => Promise.resolve({ version: () => "140.0", close }));
    const runtime: PlaywrightRuntimeProvider = {
      load: () => Promise.resolve({ chromium: { launch } } as unknown as PlaywrightRuntime)
    };
    const provider = new SystemChromeProvider(runtime);

    expect(await provider.inspect()).toMatchObject({ state: "ready", browserVersion: "140.0" });
    expect(launch).toHaveBeenCalledWith({ channel: "chrome", headless: true });
    expect(await provider.resolveLaunchConfiguration()).toMatchObject({
      engine: "chromium",
      executablePath: null,
      channel: "chrome"
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("expone como no disponible una instalación que Playwright no puede iniciar", async () => {
    const runtime: PlaywrightRuntimeProvider = {
      load: () => Promise.resolve({ chromium: { launch: vi.fn(() => Promise.reject(new Error("Chrome no encontrado"))) } } as unknown as PlaywrightRuntime)
    };
    const provider = new SystemChromeProvider(runtime);

    expect(await provider.inspect()).toMatchObject({ state: "missing", detail: expect.stringContaining("Chrome no encontrado") });
    await expect(provider.resolveLaunchConfiguration()).rejects.toThrow("no está instalado");
  });
});
