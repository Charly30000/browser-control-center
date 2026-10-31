import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompleteAutomationExample } from "../src/domain/automations/exampleAutomation";
import { PlaywrightAutomationSession } from "../src/infrastructure/automations/playwrightAutomationSession";
import { RequestOverrideRouter } from "../src/infrastructure/browser/requestOverrideRouter";
import { ProcessRunner } from "../src/application/automations/processRunner";
import { ExecutionControl } from "../src/application/automations/cancellation";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { silentLogger } from "../src/application/logging/logger";
import type { AutomationBrowserSessionFactory } from "../src/application/automations/automationBrowserSession";
import type { GeneratorValueResolver } from "../src/application/manual/generatorValueResolver";
import { success } from "../src/shared/result";
import { createCookie, createHeader, createStorageEntry, defaultViewport } from "../src/domain/manual/manualProfile";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;

realBrowserSuite("session removal and negative validations in a real browser", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await chromium.launch({ channel: "chrome", headless: true }); });
  afterAll(async () => { await browser?.close(); });

  const sessions: AutomationBrowserSessionFactory = {
    create: async (viewport) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: "block" });
      const router = new RequestOverrideRouter();
      await router.attach(context);
      return new PlaywrightAutomationSession({ stop: () => context.close() }, context, await context.newPage(), router, viewport, silentLogger);
    }
  };

  it.each(["19", "20", "21", "22"])("runs the complete offline example %s through the runner", async (ordinal) => {
    let sequence = 0;
    const group = createCompleteAutomationExample(() => `example-${++sequence}`);
    const process = group.processes.find(({ name }) => name.startsWith(`${ordinal} ·`))!;
    const errors: string[] = [];
    const generators = { resolve: () => Promise.resolve(success("unused")) } as unknown as GeneratorValueResolver;
    const runner = new ProcessRunner(sessions, createDefaultNodeRegistry(), generators, silentLogger);
    const result = await runner.run(group.name, process, new ExecutionControl(), (snapshot) => {
      if (snapshot.error !== null) errors.push(snapshot.error);
    });
    expect(errors).toEqual([]);
    expect(result.success).toBe(true);
  }, 20_000);

  it("preserves other domains, paths and storage scopes during targeted removal", async () => {
    const session = await sessions.create(defaultViewport());
    try {
      await session.setRequestOverrides([{ id: "page", matcherType: "glob", matcher: "https://session.test/**", method: "ANY", action: "fulfill", status: 200, headers: [], body: "<h1>Ready</h1><input id='name' value='Ada Lovelace'>", contentType: "text/html", enabled: true }]);
      await session.navigate("https://session.test/page", 3_000);
      await session.setCookies([
        { ...createCookie("one"), name: "same", value: "one", domain: "session.test", path: "/" },
        { ...createCookie("two"), name: "same", value: "two", domain: "other.test", path: "/" },
        { ...createCookie("three"), name: "same", value: "three", domain: "session.test", path: "/nested" }
      ]);
      await session.removeCookies(["same"], "session.test", "/");
      await session.assertData("cookie", "exists", { key: "same", path: "value" }, 1_000);
      await session.removeCookies(["same"], "session.test", "/nested");
      await session.assertData("cookie", "equals", { key: "same", path: "domain", expected: "other.test" }, 1_000);
      for (const scope of ["local", "session"] as const) await session.setStorage(scope, [{ ...createStorageEntry(scope), key: "same", value: scope }]);
      await session.removeStorage("local", null);
      await session.assertData("localStorage", "not-exists", { key: "same", path: "" }, 1_000);
      await session.assertData("sessionStorage", "equals", { key: "same", path: "", expected: "session" }, 1_000);
      await session.removeCookies(["missing"], "", "");
      await session.removeStorage("session", ["missing"]);
      await expect(session.assert("text-not-contains", { selector: "#absent", expected: "x" }, 50)).rejects.toThrow();
      await expect(session.assert("value-not-equals", { selector: "#name", expected: "Ada Lovelace" }, 1_000)).rejects.toThrow();
      await expect(session.assert("url-not-contains", { expected: "session.test" }, 1_000)).rejects.toThrow();
      await expect(session.assert("response-status-not-equals", { expected: "200" }, 1_000)).rejects.toThrow();
      await session.setHeaders([{ ...createHeader("header"), key: "X-Test", value: "one" }]);
      await session.removeHeaders(["missing"]);
    } finally { await session.close(false); }
  });
});
