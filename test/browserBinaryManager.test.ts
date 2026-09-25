import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { silentLogger } from "../src/application/logging/logger";
import { BrowserBinaryManager } from "../src/infrastructure/browser/providers/browserBinaryManager";
import type { PlaywrightRuntimeProvider } from "../src/infrastructure/browser/playwrightRuntime";

describe("BrowserBinaryManager", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

  it("detecta una instalación ausente", async () => {
    const root = await mkdtemp(join(tmpdir(), "bcc-binary-")); roots.push(root);
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.reject(new Error("No debe cargar Playwright")) };
    const manager = new BrowserBinaryManager(root, runtime, silentLogger);
    await expect(manager.inspect()).resolves.toMatchObject({ state: "missing", playwrightVersion: "1.62.1" });
  });

  it("elimina solo artefactos administrados", async () => {
    const root = await mkdtemp(join(tmpdir(), "bcc-binary-")); roots.push(root);
    const keep = join(root, "keep.txt"); await writeFile(keep, "safe", "utf8");
    const runtime: PlaywrightRuntimeProvider = { load: () => Promise.reject(new Error("No debe cargar Playwright")) };
    const manager = new BrowserBinaryManager(root, runtime, silentLogger);
    await manager.remove();
    await expect(access(keep)).resolves.toBeUndefined();
    await expect(readFile(keep, "utf8")).resolves.toBe("safe");
  });
});
