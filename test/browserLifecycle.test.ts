import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlaywrightRuntime } from "../src/infrastructure/browser/playwrightRuntime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { silentLogger } from "../src/application/logging/logger";
import { defaultViewport } from "../src/domain/manual/manualProfile";
import { BrowserLifecycleManager } from "../src/infrastructure/browser/browserLifecycleManager";
import type { PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";

describe("BrowserLifecycleManager", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

  it("crea contextos independientes y limpia los directorios de sesión", async () => {
    const root = await mkdtemp(join(tmpdir(), "bcc-runtime-")); roots.push(root);
    let contexts = 0;
    const context = () => ({ close: vi.fn(() => Promise.resolve()) });
    const newContext = vi.fn(() => { contexts += 1; return Promise.resolve(context()); });
    const browser = () => ({
      newContext,
      once: vi.fn()
    });
    const server = () => ({ wsEndpoint: () => "ws://test", close: vi.fn(() => Promise.resolve()), kill: vi.fn(() => Promise.resolve()) });
    const chromium = { launchServer: vi.fn((_options: unknown) => Promise.resolve(server())), connect: vi.fn(() => Promise.resolve(browser())) };
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.resolve({ chromium } as unknown as PlaywrightRuntime) };
    const lifecycle = new BrowserLifecycleManager(runtime, root, silentLogger);

    const configuration = { providerId: "managed-chromium" as const, displayName: "Chromium administrado", engine: "chromium" as const, executablePath: "C:\\managed\\chrome.exe", channel: null };
    await lifecycle.start(configuration, defaultViewport());
    expect(lifecycle.getState()).toBe("running");
    expect(contexts).toBe(1);
    expect(newContext).toHaveBeenCalledWith(expect.objectContaining({
      viewport: { width: 1366, height: 768 },
      screen: { width: 1366, height: 768 }
    }));
    expect(await readdir(root)).toHaveLength(1);

    await lifecycle.restart({ providerId: "system-chrome", displayName: "Google Chrome instalado", engine: "chromium", executablePath: null, channel: "chrome" }, defaultViewport());
    expect(contexts).toBe(2);
    expect(chromium.launchServer).toHaveBeenLastCalledWith(expect.objectContaining({ channel: "chrome" }));
    expect(chromium.launchServer.mock.calls.at(-1)?.[0]).not.toHaveProperty("executablePath");
    expect(await readdir(root)).toHaveLength(1);

    await lifecycle.stop("force");
    expect(lifecycle.getState()).toBe("stopped");
    expect(await readdir(root)).toHaveLength(0);
  });
});
