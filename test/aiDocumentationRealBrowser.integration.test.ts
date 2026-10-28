import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;

realBrowserSuite("documentación para IA en el navegador", () => {
  let browser: Browser;
  const scripts = new Map<string, string>();

  beforeAll(async () => {
    for (const [name, path] of [["sidebar", "sidebar/index.ts"], ["documentation", "pages/AiDocumentation/index.ts"]]) {
      const result = await build({ entryPoints: [join(process.cwd(), "src/webviews", path!)], bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", loader: { ".css": "empty" }, logLevel: "silent" });
      scripts.set(name!, result.outputFiles[0]!.text);
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }, 20_000);

  afterAll(async () => { await browser?.close(); });

  it("el quinto botón lateral envía la solicitud de apertura", async () => {
    const page = await browser.newPage();
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.evaluate(() => {
        const messages: unknown[] = [];
        Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
      });
      await page.addScriptTag({ content: scripts.get("sidebar")! });
      const buttons = page.getByRole("navigation").getByRole("button");
      await buttons.nth(4).waitFor();
      expect(await buttons.count()).toBe(5);
      expect(await buttons.nth(4).innerText()).toBe("Documentación para IA");
      await buttons.nth(4).click();
      const messages = await page.evaluate(() => (window as unknown as { messages: unknown[] }).messages);
      expect(messages).toContainEqual({ type: "sidebar.openPage", pageId: "aiDocumentation" });
    } finally { await page.close(); }
  });

  it("muestra el contenido, cambia de sección y permite copiar y seleccionar todo", async () => {
    const page = await browser.newPage();
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text: string) => { Object.assign(window, { copied: text }); return Promise.resolve(); } } });
      });
      await page.addScriptTag({ content: scripts.get("documentation")! });
      const content = page.getByRole("textbox", { name: "Documentación para IA copiable" });
      await content.waitFor();
      expect(await content.inputValue()).toContain("## Estructura JSON exacta");
      await page.getByRole("combobox").selectOption("formulas");
      await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("— Fórmulas:"));
      expect(await content.inputValue()).not.toContain("## Estructura JSON exacta");
      await page.getByRole("button", { name: "Copiar documentación" }).click();
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("Documentación copiada"));
      expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(await content.inputValue());
      await page.getByRole("button", { name: "Seleccionar todo" }).click();
      expect(await content.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe((await content.inputValue()).length);
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("Sin portapapeles")) } });
        document.execCommand = () => false;
      });
      await page.getByRole("button", { name: "Copiar documentación" }).click();
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("Ctrl+C"));
      expect(await content.evaluate((element: HTMLTextAreaElement) => document.activeElement === element)).toBe(true);
    } finally { await page.close(); }
  });
});
