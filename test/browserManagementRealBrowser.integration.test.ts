import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { BrowserProviderId } from "../src/domain/browser/browserProvider";
import type { BrowserManagementToExtensionMessage, ExtensionToBrowserManagementMessage } from "../src/shared/messages/browserManagementMessages";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const state = (selectedProviderId: BrowserProviderId): ExtensionToBrowserManagementMessage => ({
  type: "browserManagement.state",
  selectedProviderId,
  providers: [
    { id: "managed-chromium", displayName: "Managed Chromium", state: "ready", browserVersion: "1.0", executablePath: null, detail: "Ready", installable: true },
    { id: "system-chrome", displayName: "Installed Google Chrome", state: "ready", browserVersion: "2.0", executablePath: null, detail: "Ready", installable: false }
  ],
  managedInstallation: { state: "ready", playwrightVersion: "1.0", requiredRevision: "1", browserVersion: "1.0", executablePath: null, detail: "Ready" },
  lifecycle: "stopped",
  busy: false,
  progress: ""
});

const post = (page: Page, message: ExtensionToBrowserManagementMessage) => page.evaluate((serialized) => window.postMessage(JSON.parse(serialized) as unknown, "*"), JSON.stringify(message));
const messages = (page: Page) => page.evaluate(() => (window as unknown as { messages: BrowserManagementToExtensionMessage[] }).messages);

realBrowserSuite("Manage Browser: selección del navegador activo", () => {
  let browser: Browser;
  let script: string;

  beforeAll(async () => {
    const result = await build({ entryPoints: [join(process.cwd(), "src/webviews/pages/BrowserManagement/index.ts")], outfile: "test.js", bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", logLevel: "silent" });
    script = result.outputFiles.find(({ path }) => path.endsWith(".js"))!.text;
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }, 20_000);
  afterAll(async () => { await browser?.close(); });

  const open = async () => {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.evaluate(() => {
      const messages: unknown[] = [];
      Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
    });
    await page.addScriptTag({ content: script });
    await page.getByRole("combobox", { name: "Active browser" }).waitFor();
    return page;
  };

  const expectSelection = async (page: Page, id: BrowserProviderId) => {
    await vi.waitFor(async () => {
      expect(await page.getByRole("combobox", { name: "Active browser" }).inputValue()).toBe(id);
      expect(await page.locator(".selected-browser strong").first().textContent()).toBe(id === "system-chrome" ? "Installed Google Chrome" : "Managed Chromium");
    });
  };

  it.each(["managed-chromium", "system-chrome"] as const)("marca %s al recibir las opciones por primera vez", async (id) => {
    const page = await open();
    try {
      await post(page, state(id));
      await expectSelection(page, id);
      expect(await messages(page)).toEqual([{ type: "browserManagement.ready" }]);
    } finally { await page.close(); }
  });

  it("sincroniza cambios confirmados y restaura la selección cuando el cambio no se acepta", async () => {
    const page = await open();
    try {
      await post(page, state("system-chrome"));
      await expectSelection(page, "system-chrome");
      await page.getByRole("combobox", { name: "Active browser" }).selectOption("managed-chromium");
      expect((await messages(page)).at(-1)).toEqual({ type: "browserManagement.selectProvider", providerId: "managed-chromium" });

      await post(page, state("system-chrome"));
      await expectSelection(page, "system-chrome");
      await page.getByRole("combobox", { name: "Active browser" }).selectOption("managed-chromium");
      await post(page, state("managed-chromium"));
      await expectSelection(page, "managed-chromium");
      await post(page, state("system-chrome"));
      await expectSelection(page, "system-chrome");
      expect((await messages(page)).filter(({ type }) => type === "browserManagement.selectProvider")).toHaveLength(2);
    } finally { await page.close(); }
  });
});
