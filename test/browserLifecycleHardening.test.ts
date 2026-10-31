import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { silentLogger } from "../src/application/logging/logger";
import { defaultViewport } from "../src/domain/manual/manualProfile";
import { BrowserLifecycleManager } from "../src/infrastructure/browser/browserLifecycleManager";
import type { PlaywrightRuntime, PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";

const configuration = { providerId: "managed-chromium" as const, displayName: "Managed Chromium", engine: "chromium" as const, executablePath: "C:\\managed\\chrome.exe", channel: null };

describe("hardening del ciclo de navegador", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

  const root = async (): Promise<string> => { const value = await mkdtemp(join(tmpdir(), "bcc-hardening-")); roots.push(value); return value; };

  it("limpia la sesión y publica crashed al desconectarse el navegador", async () => {
    let disconnected: (() => void) | undefined;
    const server = { wsEndpoint: () => "ws://test", close: vi.fn(() => Promise.resolve()), kill: vi.fn(() => Promise.resolve()) };
    const browser = {
      newContext: vi.fn(() => Promise.resolve({ close: vi.fn(() => Promise.resolve()) })),
      once: vi.fn((_event: string, listener: () => void) => { disconnected = listener; })
    };
    const chromium = { launchServer: vi.fn(() => Promise.resolve(server)), connect: vi.fn(() => Promise.resolve(browser)) };
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
    const runtimeRoot = await root();
    const lifecycle = new BrowserLifecycleManager(runtime, runtimeRoot, silentLogger);

    await lifecycle.start(configuration, defaultViewport());
    disconnected?.();

    await vi.waitFor(() => expect(lifecycle.getState()).toBe("crashed"));
    await vi.waitFor(async () => expect(await readdir(runtimeRoot)).toHaveLength(0));
  });

  it("fuerza la parada si falla el cierre normal", async () => {
    const server = { wsEndpoint: () => "ws://test", close: vi.fn(() => Promise.reject(new Error("fallo"))), kill: vi.fn(() => Promise.resolve()) };
    const browser = { newContext: vi.fn(() => Promise.resolve({ close: vi.fn(() => Promise.resolve()) })), once: vi.fn() };
    const chromium = { launchServer: vi.fn(() => Promise.resolve(server)), connect: vi.fn(() => Promise.resolve(browser)) };
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
    const lifecycle = new BrowserLifecycleManager(runtime, await root(), silentLogger);

    await lifecycle.start(configuration, defaultViewport());
    await lifecycle.stop("graceful");

    expect(server.kill).toHaveBeenCalledOnce();
    expect(lifecycle.getState()).toBe("stopped");
  });

  it("mata el servidor y limpia temporales si falla la creación del contexto", async () => {
    const server = { wsEndpoint: () => "ws://test", close: vi.fn(() => Promise.resolve()), kill: vi.fn(() => Promise.resolve()) };
    const browser = { newContext: vi.fn(() => Promise.reject(new Error("contexto no disponible"))), once: vi.fn() };
    const chromium = { launchServer: vi.fn(() => Promise.resolve(server)), connect: vi.fn(() => Promise.resolve(browser)) };
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
    const runtimeRoot = await root();
    const lifecycle = new BrowserLifecycleManager(runtime, runtimeRoot, silentLogger);

    await expect(lifecycle.start(configuration, defaultViewport())).rejects.toThrow("contexto no disponible");
    expect(server.kill).toHaveBeenCalledOnce();
    expect(lifecycle.getState()).toBe("crashed");
    expect(await readdir(runtimeRoot)).toHaveLength(0);
  });
});
