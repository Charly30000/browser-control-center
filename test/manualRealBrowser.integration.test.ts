import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserActionsService } from "../src/application/manual/browserActionsService";
import type { GeneratorValueResolver } from "../src/application/manual/generatorValueResolver";
import { silentLogger } from "../src/application/logging/logger";
import { createCookie, createEmptyManualProfile, createGeneratorBinding, createRequestOverride, defaultViewport } from "../src/domain/manual/manualProfile";
import type { ManualToExtensionMessage } from "../src/shared/messages/manualMessages";
import { PlaywrightBrowserBridge } from "../src/infrastructure/browser/playwrightBrowserBridge";
import type { BrowserLifecycleManager } from "../src/infrastructure/browser/browserLifecycleManager";
import { success } from "../src/shared/result";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;

realBrowserSuite("Manual con navegador real", () => {
  let browser: Browser;
  let script: string;

  beforeAll(async () => {
    const result = await build({ entryPoints: [join(process.cwd(), "src/webviews/pages/Manual/index.ts")], bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", loader: { ".css": "empty" }, logLevel: "silent" });
    script = result.outputFiles[0]!.text;
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }, 20_000);

  afterAll(async () => { await browser?.close(); });

  it("mueve el único botón Aplicar al minimizar y no aplica al cargar, editar ni recibir estados", async () => {
    const page = await browser.newPage();
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.evaluate(() => {
        const messages: unknown[] = [];
        Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
      });
      await page.addScriptTag({ content: script });
      const profile = createEmptyManualProfile("profile-v2", "Perfil existente");
      profile.generatorBindings = [{ ...createGeneratorBinding("binding"), selector: "#name", literalValue: "Ada" }];
      profile.cookies = [{ ...createCookie("cookie"), name: "session", value: "test", domain: "manual.test" }];
      profile.requestOverrides = [{ ...createRequestOverride("override"), matcher: "https://manual.test/**" }];
      await page.evaluate((profile) => window.postMessage({ type: "manual.state", state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), profile);
      const row = page.locator(".row-details");
      await row.waitFor();
      await row.getByText("Texto", { exact: true }).locator("..").locator("input").fill("Grace");
      await page.evaluate(() => window.postMessage({ type: "browser.state", browser: { lifecycle: "running", pages: [], activePageId: null } }, "*"));
      expect((await page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages)).filter(({ type }) => type === "browser.apply")).toHaveLength(0);

      for (const selector of [".row-details", ".session-details", ".request-override-row"]) {
        const entry = page.locator(selector);
        await entry.evaluate((element: HTMLDetailsElement) => { element.open = false; });
        await entry.locator("summary").getByRole("button", { name: "Aplicar", exact: true }).waitFor();
        expect(await entry.getByRole("button", { name: "Aplicar", exact: true, includeHidden: true }).count()).toBe(1);
        await entry.locator("summary").getByRole("button", { name: "Aplicar", exact: true }).click();
        expect(await entry.evaluate((element: HTMLDetailsElement) => element.open)).toBe(false);
        await entry.evaluate((element: HTMLDetailsElement) => { element.open = true; });
        await entry.locator("summary").getByRole("button", { name: "Aplicar", exact: true }).waitFor({ state: "detached" });
        expect(await entry.getByRole("button", { name: "Aplicar", exact: true, includeHidden: true }).count()).toBe(1);
        expect(await entry.getByRole("button", { name: "Aplicar", exact: true }).isVisible()).toBe(true);
      }
      const messages = await page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages);
      expect(messages.filter(({ type }) => type === "browser.apply")).toHaveLength(3);
      expect(messages.find((message) => message.type === "browser.apply" && message.target === "generators")).toMatchObject({ rowId: "binding", profile: { generatorBindings: [expect.objectContaining({ literalValue: "Grace" })] } });
    } finally { await page.close(); }
  });

  it("continúa tras un selector ausente, no lo reintenta después y no envía formularios al escribir", async () => {
    const context = await browser.newContext();
    const lifecycle = { onDidChange: () => ({ dispose: () => undefined }), getState: () => "running", start: () => Promise.resolve({ context }), getSession: () => ({ context }), stop: () => Promise.resolve() };
    const bridge = new PlaywrightBrowserBridge({ resolveLaunchConfiguration: () => Promise.resolve({ providerId: "system-chrome", displayName: "Chrome", engine: "chromium", executablePath: null, channel: "chrome" }) }, lifecycle as unknown as BrowserLifecycleManager, silentLogger);
    try {
      let submissions = 0;
      await bridge.start({ viewport: defaultViewport() });
      await context.route("https://manual.test/**", async (route) => {
        if (route.request().url().includes("/submit")) { submissions += 1; await route.fulfill({ body: "Enviado" }); return; }
        await route.fulfill({ contentType: "text/html", body: '<form action="/submit" method="post"><input id="name" value="original"><input id="unready" readonly><input id="last"><textarea id="notes"></textarea><button type="submit">Enviar</button></form><script>document.addEventListener("input", () => { const form = document.querySelector("form"); form.requestSubmit(); form.submit(); });</script>' });
      });
      await bridge.open("https://manual.test/form", { viewport: defaultViewport() });
      const page = context.pages()[0]!;
      const generators = { resolve: () => Promise.resolve(success("Ada\n")) } as unknown as GeneratorValueResolver;
      const service = new BrowserActionsService(bridge, generators);
      const profile = createEmptyManualProfile("profile", "Perfil existente");
      profile.generatorBindings = [
        { ...createGeneratorBinding("missing"), selector: "#missing" },
        { ...createGeneratorBinding("name"), selector: "#name", inputMode: "sequential", delayMs: 5 },
        { ...createGeneratorBinding("unready"), selector: "#unready" },
        { ...createGeneratorBinding("last"), selector: "#last" },
        { ...createGeneratorBinding("notes"), selector: "#notes", inputMode: "sequential", delayMs: 5 }
      ];
      expect(await page.locator("#name").inputValue()).toBe("original");
      const result = await service.apply(profile, "generators", null);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Aplicados 3 de 5");
      expect(await page.locator("#last").inputValue()).toContain("Ada");
      expect(await page.locator("#notes").inputValue()).toBe("Ada\n");
      await page.evaluate(() => { const input = document.createElement("input"); input.id = "missing"; document.body.append(input); });
      expect(await page.locator("#missing").inputValue()).toBe("");
      expect(submissions).toBe(0);
      await page.getByRole("button", { name: "Enviar", exact: true }).click();
      await page.waitForURL("https://manual.test/submit");
      expect(submissions).toBe(1);
    } finally { await bridge.stop("graceful"); await context.close(); }
  }, 15_000);
});
