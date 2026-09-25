import { describe, expect, it, vi } from "vitest";
import type { BrowserProvider } from "../src/application/browser/browserProvider";
import { BrowserSelectionService } from "../src/application/browser/browserSelectionService";
import type { StateDataDao } from "../src/application/persistence/applicationDataDao";
import type { BrowserPreferences } from "../src/domain/browser/browserProvider";

const provider = (id: BrowserProvider["id"], displayName: string): BrowserProvider => ({
  id,
  inspect: vi.fn(() => Promise.resolve({
    id,
    displayName,
    state: "ready" as const,
    browserVersion: "1.0",
    executablePath: null,
    detail: "Disponible",
    installable: id === "managed-chromium"
  })),
  resolveLaunchConfiguration: vi.fn(() => Promise.resolve({
    providerId: id,
    displayName,
    engine: "chromium" as const,
    executablePath: id === "managed-chromium" ? "C:\\managed\\chrome.exe" : null,
    channel: id === "system-chrome" ? "chrome" : null
  }))
});

describe("BrowserSelectionService", () => {
  it("persiste la selección y resuelve siempre el proveedor activo", async () => {
    let preferences: BrowserPreferences = { version: 1, selectedProviderId: "managed-chromium" };
    const preferencesDao: StateDataDao<BrowserPreferences> = {
      get: () => preferences,
      set: vi.fn((value) => { preferences = value; return Promise.resolve(); })
    };
    const managed = provider("managed-chromium", "Chromium administrado");
    const chrome = provider("system-chrome", "Google Chrome instalado");
    const service = new BrowserSelectionService([managed, chrome], preferencesDao);

    expect((await service.resolveLaunchConfiguration()).providerId).toBe("managed-chromium");
    await service.select("system-chrome");

    expect(preferences.selectedProviderId).toBe("system-chrome");
    expect((await service.resolveLaunchConfiguration()).channel).toBe("chrome");
    expect(chrome.resolveLaunchConfiguration).toHaveBeenCalledOnce();
  });

  it("rechaza proveedores no registrados aunque llegue un identificador externo inválido", async () => {
    const preferencesDao: StateDataDao<BrowserPreferences> = {
      get: () => ({ version: 1, selectedProviderId: "managed-chromium" }),
      set: () => Promise.resolve()
    };
    const service = new BrowserSelectionService([provider("managed-chromium", "Chromium administrado")], preferencesDao);

    await expect(service.select("unknown" as never)).rejects.toThrow("no está registrado");
  });
});
