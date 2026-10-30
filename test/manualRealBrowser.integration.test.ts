import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BrowserActionsService } from "../src/application/manual/browserActionsService";
import type { GeneratorValueResolver } from "../src/application/manual/generatorValueResolver";
import { silentLogger } from "../src/application/logging/logger";
import { createCookie, createEmptyManualProfile, createGeneratorBinding, createHeader, createQueryParam, createRequestOverride, createStorageEntry, defaultViewport, type ManualProfile } from "../src/domain/manual/manualProfile";
import type { ManualToExtensionMessage } from "../src/shared/messages/manualMessages";
import { PlaywrightBrowserBridge } from "../src/infrastructure/browser/playwrightBrowserBridge";
import type { BrowserLifecycleManager } from "../src/infrastructure/browser/browserLifecycleManager";
import { success } from "../src/shared/result";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;

const showProfile = async (page: Page, profile: ManualProfile) => {
  await page.evaluate((profile) => window.postMessage({ type: "manual.state", state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), profile);
  await page.locator(".profile-name input").waitFor();
};

const savedRequests = (page: Page) => page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages.filter((message) => message.type === "manual.save"));

const freezeClock = async (page: Page) => {
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-30T12:00:01Z"));
};

const acknowledgeSave = async (page: Page, request: Extract<ManualToExtensionMessage, { type: "manual.save" }>) => {
  await page.evaluate(({ requestId, profile }) => window.postMessage({ type: "manual.saved", requestId, state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), { requestId: request.requestId, profile: request.profile });
  await vi.waitFor(async () => expect(await page.locator(".save-state").textContent()).not.toBe("Guardando…"));
};

realBrowserSuite("Manual con navegador real", () => {
  let browser: Browser;
  let script: string;
  let stylesheet: string;

  beforeAll(async () => {
    const result = await build({ entryPoints: [join(process.cwd(), "src/webviews/pages/Manual/index.ts")], outfile: "manual-test.js", bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", logLevel: "silent" });
    script = result.outputFiles.find(({ path }) => path.endsWith(".js"))!.text;
    stylesheet = result.outputFiles.find(({ path }) => path.endsWith(".css"))!.text;
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }, 20_000);

  afterAll(async () => { await browser?.close(); });

  const openProfile = async (profile: ManualProfile) => {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addStyleTag({ content: stylesheet });
    await page.evaluate(() => {
      const messages: unknown[] = [];
      Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
    });
    await page.addScriptTag({ content: script });
    await showProfile(page, profile);
    return page;
  };

  it("mueve el único botón Aplicar al minimizar y no aplica al cargar, editar ni recibir estados", async () => {
    const page = await browser.newPage();
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addStyleTag({ content: stylesheet });
      await page.evaluate(() => {
        const messages: unknown[] = [];
        Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
      });
      await page.addScriptTag({ content: script });
      const profile = createEmptyManualProfile("profile-v2", "Perfil existente");
      profile.generatorBindings = [{ ...createGeneratorBinding("binding"), selector: "#name", literalValue: "Ada", delayMs: 0 }];
      profile.cookies = [{ ...createCookie("cookie"), name: "session", value: "test", domain: "manual.test" }];
      profile.requestOverrides = [{ ...createRequestOverride("override"), matcher: "https://manual.test/**" }];
      await page.evaluate((profile) => window.postMessage({ type: "manual.state", state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), profile);
      const row = page.locator(".row-details");
      await row.waitFor();
      await row.getByText("Texto", { exact: true }).locator("..").locator("input").fill("Grace");
      const writingMode = row.getByText("Escritura", { exact: true }).locator("..").locator("select");
      await writingMode.selectOption("sequential");
      const delay = row.getByText("Retraso por tecla (ms)", { exact: true }).locator("..").locator("input");
      expect(await delay.inputValue()).toBe("100");
      await delay.fill("145");
      await writingMode.selectOption("instant");
      await writingMode.selectOption("sequential");
      expect(await delay.inputValue()).toBe("145");
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

  it("expande y contrae solo el grupo elegido y guarda su preferencia sin aplicar valores", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addStyleTag({ content: stylesheet });
      await page.evaluate(() => {
        const messages: unknown[] = [];
        Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
      });
      await page.addScriptTag({ content: script });
      const profile = createEmptyManualProfile("saved-profile", "Pruebas de formulario");
      profile.generatorBindings = ["first", "second"].map((id) => ({ ...createGeneratorBinding(id), selector: `#${id}`, literalValue: "Ejemplo" }));
      profile.cookies = ["first", "second"].map((id) => ({ ...createCookie(id), name: id, domain: "example.test" }));
      profile.requestOverrides = ["first", "second"].map((id) => ({ ...createRequestOverride(id), matcher: `https://example.test/api/${id}` }));
      await page.evaluate((profile) => window.postMessage({ type: "manual.state", state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), profile);
      await page.locator(".row-details").first().waitFor();
      for (const heading of ["Cookies", "Request Overrides", "Inputs / Generadores"]) {
        const group = page.locator(`section-card[heading="${heading}"]`);
        const before = await page.locator("section-card").evaluateAll((cards, current) => cards.filter((card) => card.getAttribute("heading") !== current).flatMap((card) => [...card.querySelectorAll("details")].map((row) => row.open)), heading);
        expect(await group.locator('[part="count"]').textContent()).toBe("2");
        await group.getByRole("button", { name: "Expandir todos", exact: true }).click();
        await page.waitForFunction((heading) => [...document.querySelectorAll(`section-card[heading="${heading}"] details`)].every((row) => (row as HTMLDetailsElement).open), heading);
        await group.getByRole("button", { name: "Contraer todos", exact: true }).click();
        await page.waitForFunction((heading) => [...document.querySelectorAll(`section-card[heading="${heading}"] details`)].every((row) => !(row as HTMLDetailsElement).open), heading);
        expect(await group.getByRole("button", { name: "Aplicar", exact: true, includeHidden: true }).count()).toBe(2);
        expect(await group.getByRole("button", { name: "Aplicar", exact: true }).count()).toBe(2);
        const after = await page.locator("section-card").evaluateAll((cards, current) => cards.filter((card) => card.getAttribute("heading") !== current).flatMap((card) => [...card.querySelectorAll("details")].map((row) => row.open)), heading);
        expect(after).toEqual(before);
      }
      expect(await page.locator(".save-state").textContent()).toBe("Cambios sin guardar");
      const messages = await page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages);
      expect(messages.filter(({ type }) => type === "browser.apply" || type === "manual.save")).toHaveLength(0);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      const [request] = await savedRequests(page);
      if (request === undefined) throw new Error("No se recibió el guardado de las preferencias.");
      for (const field of ["cookies", "requestOverrides", "generatorBindings"] as const) expect(request.profile[field].map(({ expanded }) => expanded)).toEqual([false, false]);
      await acknowledgeSave(page, request);
      await showProfile(page, JSON.parse(JSON.stringify(request.profile)) as ManualProfile);
      expect(await page.locator("details").evaluateAll((rows) => rows.every((row) => !(row as HTMLDetailsElement).open))).toBe(true);
      expect(await page.locator(".save-state").textContent()).toBe("Guardado");

      if (process.env.BCC_CAPTURE_PREVIEWS === "1") {
        for (const theme of ["dark", "light"] as const) {
          const dark = theme === "dark";
          await page.emulateMedia({ colorScheme: theme });
          const palette = await page.addStyleTag({ content: `:root { --vscode-font-family: 'Segoe UI', sans-serif; --vscode-font-size: 13px; --vscode-editor-font-family: Consolas, monospace; --vscode-foreground: ${dark ? "#e6e8ef" : "#273244"}; --vscode-descriptionForeground: ${dark ? "#a3aab9" : "#566175"}; --vscode-editor-background: ${dark ? "#151921" : "#f5f7fa"}; --vscode-editorWidget-background: ${dark ? "#1d2430" : "#ffffff"}; --vscode-panel-border: ${dark ? "#344051" : "#ccd4df"}; --vscode-input-foreground: ${dark ? "#e6e8ef" : "#273244"}; --vscode-input-background: ${dark ? "#111720" : "#ffffff"}; --vscode-button-secondaryForeground: ${dark ? "#dfe7f4" : "#273244"}; --vscode-button-secondaryBackground: ${dark ? "#303b4e" : "#e3e9f1"}; --vscode-button-background: #2778b8; --vscode-button-foreground: #ffffff; --vscode-testing-iconPassed: ${dark ? "#63c598" : "#247947"}; --vscode-disabledForeground: #7c8799; --vscode-focusBorder: #66a9ff; }` });
          await page.screenshot({ path: join(process.cwd(), `test-results/manual-sections-${theme}.png`), fullPage: true });
          await palette.evaluate((element) => element.parentNode?.removeChild(element));
        }
      }

      await page.evaluate((profile) => {
        const empty = { ...profile, cookies: [], requestOverrides: [], generatorBindings: [] };
        window.postMessage({ type: "manual.state", state: { profile: empty, savedProfile: empty, profiles: [], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*");
      }, profile);
      await page.waitForFunction(() => document.querySelectorAll(".row-details, .session-details, .request-override-row").length === 0);
      for (const heading of ["Cookies", "Request Overrides", "Inputs / Generadores"]) {
        const group = page.locator(`section-card[heading="${heading}"]`);
        expect(await group.locator('[part="count"]').textContent()).toBe("0");
        expect(await group.getByRole("button", { name: "Expandir todos", exact: true }).isDisabled()).toBe(true);
        expect(await group.getByRole("button", { name: "Contraer todos", exact: true }).isDisabled()).toBe(true);
      }
    } finally { await page.close(); }
  });

  it("guarda por defecto sin tocar el interruptor en perfiles sin preferencia", async () => {
    const page = await openProfile(createEmptyManualProfile("default-auto-save", "Perfil sin preferencia"));
    try {
      await freezeClock(page);
      await page.locator(".profile-name input").fill("Cambio con guardado predeterminado");
      await page.clock.runFor(4_999);
      expect(await savedRequests(page)).toHaveLength(0);
      await page.clock.runFor(1);
      const requests = await savedRequests(page);
      expect(requests).toHaveLength(1);
      expect(requests[0]!.profile.name).toBe("Cambio con guardado predeterminado");
      await acknowledgeSave(page, requests[0]!);
      expect(await page.locator(".save-state").textContent()).toBe("Guardado");
    } finally { await page.close(); }
  });

  it("guarda tras 5 segundos de inactividad, conserva ediciones durante el guardado y se puede desactivar", async () => {
    const profile = createEmptyManualProfile("auto-save", "Guardado automático");
    profile.generatorBindings = [{ ...createGeneratorBinding("input"), expanded: false }];
    const page = await openProfile(profile);
    try {
      await freezeClock(page);
      const name = page.locator(".profile-name input");
      expect(await page.getByRole("switch", { name: "Guardado automático", exact: true }).isChecked()).toBe(true);
      await page.getByRole("switch", { name: "Guardado automático", exact: true }).uncheck();
      await name.fill("Sin guardado automático");
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(0);

      await page.getByRole("switch", { name: "Guardado automático", exact: true }).check();
      await page.clock.runFor(4_000);
      await name.fill("Primer borrador");
      await page.clock.runFor(4_999);
      expect(await savedRequests(page)).toHaveLength(0);
      await page.clock.runFor(1);
      const [first] = await savedRequests(page);
      if (first === undefined) throw new Error("No se ejecutó el guardado automático.");
      expect(first.profile.preferences?.autoSaveEnabled).toBe(true);

      await name.fill("Edición durante el guardado");
      await acknowledgeSave(page, first);
      expect(await name.inputValue()).toBe("Edición durante el guardado");
      expect(await page.locator(".save-state").textContent()).toBe("Cambios sin guardar");
      await page.clock.runFor(5_000);
      const requests = await savedRequests(page);
      expect(requests).toHaveLength(2);
      expect(requests[1]!.profile.name).toBe("Edición durante el guardado");
      await acknowledgeSave(page, requests[1]!);
      await page.clock.runFor(10_000);
      expect(await savedRequests(page)).toHaveLength(2);

      await name.fill("No guardar aún");
      await page.clock.runFor(4_000);
      await page.getByRole("switch", { name: "Guardado automático", exact: true }).uncheck();
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(2);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      const manualSave = (await savedRequests(page))[2]!;
      expect(manualSave.profile.preferences?.autoSaveEnabled).toBe(false);
      await acknowledgeSave(page, manualSave);
      await showProfile(page, manualSave.profile);
      expect(await page.getByRole("switch", { name: "Guardado automático", exact: true }).isChecked()).toBe(false);
      expect(await page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages.some(({ type }) => type === "browser.apply"))).toBe(false);
    } finally { await page.close(); }
  });

  it("aísla las preferencias entre perfiles y suspende el guardado durante la edición JSON o una transición", async () => {
    const profile = createEmptyManualProfile("preferences", "Preferencias");
    profile.preferences = { autoSaveEnabled: true };
    profile.cookies = [{ ...createCookie("same-id"), expanded: true }];
    profile.requestOverrides = [{ ...createRequestOverride("same-id"), expanded: false }];
    profile.generatorBindings = [{ ...createGeneratorBinding("same-id"), expanded: false }];
    const page = await openProfile(profile);
    try {
      await freezeClock(page);
      expect(await page.locator(".session-details").evaluate((row: HTMLDetailsElement) => row.open)).toBe(true);
      expect(await page.locator(".request-override-row").evaluate((row: HTMLDetailsElement) => row.open)).toBe(false);
      expect(await page.locator(".row-details").evaluate((row: HTMLDetailsElement) => row.open)).toBe(false);
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(0);

      await page.locator(".profile-name input").fill("Edición");
      await page.evaluate(() => window.postMessage({ type: "manual.jsonDocument", serialized: "{}" }, "*"));
      await page.locator(".json-editor-dialog").waitFor();
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(0);
      await page.locator("json-document-editor").evaluate((editor) => editor.dispatchEvent(new CustomEvent("json-editor-close")));
      await page.getByRole("button", { name: "Nuevo", exact: true }).click();
      await page.getByRole("dialog", { name: "Cambios sin guardar", exact: true }).waitFor();
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(0);
      await page.locator("unsaved-changes-dialog").evaluate((dialog) => dialog.dispatchEvent(new CustomEvent("unsaved-choice", { detail: "discard" })));
      await page.clock.runFor(6_000);
      expect(await savedRequests(page)).toHaveLength(0);

      const other = { ...structuredClone(profile), id: "other", preferences: { autoSaveEnabled: false } };
      for (const row of [...other.cookies, ...other.requestOverrides, ...other.generatorBindings]) delete row.expanded;
      await showProfile(page, other);
      expect(await page.locator(".session-details").evaluate((row: HTMLDetailsElement) => row.open)).toBe(false);
      expect(await page.locator(".request-override-row").evaluate((row: HTMLDetailsElement) => row.open)).toBe(true);
      expect(await page.locator(".row-details").evaluate((row: HTMLDetailsElement) => row.open)).toBe(true);
    } finally { await page.close(); }
  });

  it("reordena todas las listas con drag and drop, conserva estados y guarda el orden sin aplicar datos", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
    try {
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addStyleTag({ content: stylesheet });
      await page.evaluate(() => {
        const messages: unknown[] = [];
        Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
      });
      await page.addScriptTag({ content: script });
      const profile = createEmptyManualProfile("saved-profile", "Orden guardado");
      const ids = ["first", "second"];
      profile.queryParams = ids.map((id) => ({ ...createQueryParam(id), key: id, value: `query-${id}` }));
      profile.headers = ids.map((id) => ({ ...createHeader(id), key: `X-${id}`, value: `header-${id}` }));
      profile.cookies = ids.map((id) => ({ ...createCookie(id), name: id, domain: "example.test" }));
      profile.localStorage = ids.map((id) => ({ ...createStorageEntry(id), key: id, value: `local-${id}` }));
      profile.sessionStorage = ids.map((id) => ({ ...createStorageEntry(id), key: id, value: `session-${id}` }));
      profile.requestOverrides = ids.map((id) => ({ ...createRequestOverride(id), matcher: `https://example.test/${id}`, headers: ids.map((headerId) => ({ ...createHeader(headerId), key: headerId, value: headerId })) }));
      profile.generatorBindings = ids.map((id) => ({ ...createGeneratorBinding(id), selector: `#${id}`, literalValue: `value-${id}` }));
      await page.evaluate((profile) => window.postMessage({ type: "manual.state", state: { profile, savedProfile: profile, profiles: [{ id: profile.id, name: profile.name, updatedAt: profile.updatedAt }], browser: { lifecycle: "running", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } } }, "*"), profile);
      await page.locator(".row-details").first().waitFor();
      await page.locator('section-card[heading="Inputs / Generadores"]').getByRole("button", { name: "Contraer todos", exact: true }).click();
      await page.locator('section-card[heading="Request Overrides"]').getByRole("button", { name: "Contraer todos", exact: true }).click();
      const firstCookie = page.locator('[data-reorder-group="cookies"][data-reorder-row="first"]');
      await firstCookie.evaluate((element: HTMLDetailsElement) => { element.open = true; });
      await firstCookie.locator(".session-details-grid").waitFor();
      const fields = ["queryParams", "headers", "cookies", "localStorage", "sessionStorage", "requestOverrides", "generatorBindings"] as const;
      for (const field of fields) {
        const rows = page.locator(`[data-reorder-group="${field}"]`);
        await rows.nth(1).locator(".row-drag-handle").first().dragTo(rows.nth(0), { targetPosition: { x: 16, y: 3 } });
        await page.waitForFunction((group) => document.querySelector(`[data-reorder-group="${group}"]`)?.getAttribute("data-reorder-row") === "second", field);
        expect(await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-reorder-row")))).toEqual(["second", "first"]);
      }
      expect(await firstCookie.evaluate((element: HTMLDetailsElement) => element.open)).toBe(true);
      expect(await page.locator('[data-reorder-group="cookies"][data-reorder-row="second"]').evaluate((element: HTMLDetailsElement) => element.open)).toBe(false);
      expect(await page.locator('[data-reorder-group="generatorBindings"] .row-drag-handle').count()).toBe(2);

      const firstOverride = page.locator('[data-reorder-group="requestOverrides"][data-reorder-row="first"]');
      await firstOverride.evaluate((element: HTMLDetailsElement) => { element.open = true; });
      const nested = page.locator('[data-reorder-group="overrideHeaders:first"]');
      await nested.nth(1).locator(".row-drag-handle").dragTo(nested.nth(0), { targetPosition: { x: 16, y: 3 } });
      await page.waitForFunction(() => document.querySelector('[data-reorder-group="overrideHeaders:first"]')?.getAttribute("data-reorder-row") === "second");
      expect(await page.locator('[data-reorder-group="overrideHeaders:second"]').evaluateAll((elements) => elements.map((element) => element.getAttribute("data-reorder-row")))).toEqual(["first", "second"]);

      const headerRows = page.locator('[data-reorder-group="headers"]');
      await headerRows.first().locator(".row-drag-handle").dragTo(firstCookie, { targetPosition: { x: 16, y: 3 } });
      expect(await headerRows.first().getAttribute("data-reorder-row")).toBe("second");
      expect(await page.locator('[data-reorder-group="cookies"]').first().getAttribute("data-reorder-row")).toBe("second");
      await headerRows.first().locator(".row-drag-handle").focus();
      await page.keyboard.press("Alt+ArrowDown");
      await page.waitForFunction(() => document.querySelector('[data-reorder-group="headers"]')?.getAttribute("data-reorder-row") === "first");

      expect(await page.locator(".save-state").textContent()).toBe("Cambios sin guardar");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      const messages = await page.evaluate(() => (window as unknown as { messages: ManualToExtensionMessage[] }).messages);
      expect(messages.some(({ type }) => type === "browser.apply" || type === "browser.syncOverrides")).toBe(false);
      const saved = messages.find((message) => message.type === "manual.save");
      if (saved?.type !== "manual.save") throw new Error("No se recibió el perfil para guardar.");
      expect(saved.profile.id).toBe(profile.id);
      expect(saved.profile.schemaVersion).toBe(2);
      for (const field of fields) expect(saved.profile[field].map(({ id }) => id)).toEqual(field === "headers" ? ids : ["second", "first"]);
      expect(saved.profile.requestOverrides.find(({ id }) => id === "first")?.headers.map(({ id }) => id)).toEqual(["second", "first"]);
      expect(saved.profile.generatorBindings.find(({ id }) => id === "first")?.literalValue).toBe("value-first");
      expect(saved.profile.localStorage.find(({ id }) => id === "second")?.value).toBe("local-second");
    } finally { await page.close(); }
  }, 25_000);

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
