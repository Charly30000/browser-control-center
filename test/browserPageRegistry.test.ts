import type { Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { BrowserPageRegistry } from "../src/infrastructure/browser/browserPageRegistry";

class FakePage {
  private readonly listeners = new Map<string, Set<() => void>>();
  public currentUrl = "about:blank";
  public currentTitle = "New tab";
  public readonly bringToFront = vi.fn(() => Promise.resolve());
  public url(): string { return this.currentUrl; }
  public title(): Promise<string> { return Promise.resolve(this.currentTitle); }
  public on(event: string, listener: () => void): this { const values = this.listeners.get(event) ?? new Set(); values.add(listener); this.listeners.set(event, values); return this; }
  public off(event: string, listener: () => void): this { this.listeners.get(event)?.delete(listener); return this; }
  public close(): Promise<void> { for (const listener of this.listeners.get("close") ?? []) listener(); return Promise.resolve(); }
  public emit(event: string): void { for (const listener of this.listeners.get(event) ?? []) listener(); }
}

describe("BrowserPageRegistry", () => {
  it("registra, selecciona, actualiza y cierra pestañas por ID", async () => {
    const changes = vi.fn();
    const registry = new BrowserPageRegistry(changes);
    const first = new FakePage(); const second = new FakePage();
    const firstId = registry.register(first as unknown as Page);
    const secondId = registry.register(second as unknown as Page);
    await registry.select(firstId);
    expect(registry.snapshot().find(({ id }) => id === firstId)?.active).toBe(true);
    first.currentUrl = "https://example.test"; first.currentTitle = "Example"; first.emit("load");
    await Promise.resolve();
    expect(registry.snapshot().find(({ id }) => id === firstId)).toMatchObject({ url: "https://example.test", title: "Example" });
    await registry.close(secondId);
    expect(registry.snapshot()).toHaveLength(1);
  });
});
