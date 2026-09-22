import type { BrowserContext, Route } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { createRequestOverride } from "../src/domain/manual/manualProfile";
import { matchesOverride, RequestOverrideRouter } from "../src/infrastructure/browser/requestOverrideRouter";

describe("matching de overrides", () => {
  it("respeta URL exacta y método", () => {
    const override = { ...createRequestOverride("1"), matcher: "https://example.test/api", method: "POST" as const };
    expect(matchesOverride(override, override.matcher, "POST")).toBe(true);
    expect(matchesOverride(override, override.matcher, "GET")).toBe(false);
  });

  it("admite glob y expresión regular", () => {
    const glob = { ...createRequestOverride("1"), matcherType: "glob" as const, matcher: "https://example.test/**/users/*" };
    const regex = { ...createRequestOverride("2"), matcherType: "regex" as const, matcher: "example\\.test/api/[0-9]+" };
    expect(matchesOverride(glob, "https://example.test/v1/users/1", "GET")).toBe(true);
    expect(matchesOverride(regex, "https://example.test/api/42", "GET")).toBe(true);
  });

  it("deja de interceptar cuando la lista sincronizada queda vacía", async () => {
    let handler: ((route: Route) => Promise<void> | void) | undefined;
    const context = { route: vi.fn((_matcher: string, callback: (route: Route) => Promise<void> | void) => { handler = callback; return Promise.resolve(); }) };
    const fulfill = vi.fn(() => Promise.resolve());
    const continueRequest = vi.fn(() => Promise.resolve());
    const route = {
      request: () => ({ url: () => "https://example.test/api", method: () => "GET", headers: () => ({}) }),
      fulfill,
      continue: continueRequest,
      abort: vi.fn(() => Promise.resolve())
    } as unknown as Route;
    const router = new RequestOverrideRouter();
    await router.attach(context as unknown as BrowserContext);
    const override = { ...createRequestOverride("1"), matcher: "https://example.test/api" };
    router.update([override]);
    await handler?.(route);
    expect(fulfill).toHaveBeenCalledOnce();

    router.update([]);
    fulfill.mockClear();
    await handler?.(route);
    expect(fulfill).not.toHaveBeenCalled();
    expect(continueRequest).toHaveBeenCalledOnce();
  });
});
