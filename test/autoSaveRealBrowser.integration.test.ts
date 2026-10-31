import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createArrayResource, type ArrayResource } from "../src/domain/arrays/arrayResource";
import { createFormula, type FormulaResource } from "../src/domain/formulas/formula";
import { createCompleteAutomationExample } from "../src/domain/automations/exampleAutomation";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationDocument } from "../src/domain/automations/automation";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const cases = [
  { page: "Arrays", prefix: "array", editor: ".editor-content input" },
  { page: "Formulas", prefix: "formula", editor: ".editor-content input" },
  { page: "Automatizaciones", prefix: "automation", editor: ".process-toolbar input" }
] as const;
interface SaveRequest { type: string; requestId: string; resource?: ArrayResource | FormulaResource; document?: AutomationDocument; }
const post = (page: Page, message: unknown) => page.evaluate((serialized) => window.postMessage(JSON.parse(serialized) as unknown, "*"), JSON.stringify(message));
const messages = (page: Page) => page.evaluate(() => (window as unknown as { messages: { type: string }[] }).messages);
const requests = async (page: Page) => (await messages(page)).filter(({ type }) => type.endsWith(".save")) as SaveRequest[];

const resourcePreviewPalette = (dark: boolean) => `:root {
  --vscode-font-family: 'Segoe UI', sans-serif; --vscode-font-size: 13px; --vscode-editor-font-family: Consolas, monospace; --vscode-editor-font-size: 13px;
  --vscode-foreground: ${dark ? "#e6e8ef" : "#273244"}; --vscode-descriptionForeground: ${dark ? "#a3aab9" : "#566175"};
  --vscode-editor-background: ${dark ? "#151921" : "#f5f7fa"}; --vscode-editorWidget-background: ${dark ? "#1d2430" : "#fff"}; --vscode-sideBar-background: ${dark ? "#181e28" : "#fff"};
  --vscode-panel-border: ${dark ? "#344051" : "#ccd4df"}; --vscode-editorWidget-border: ${dark ? "#344051" : "#ccd4df"};
  --vscode-input-foreground: ${dark ? "#e6e8ef" : "#273244"}; --vscode-input-background: ${dark ? "#111720" : "#fff"};
  --vscode-button-secondaryForeground: ${dark ? "#dfe7f4" : "#273244"}; --vscode-button-secondaryBackground: ${dark ? "#303b4e" : "#e3e9f1"};
  --vscode-button-background: #2778b8; --vscode-button-foreground: #fff; --vscode-focusBorder: #66a9ff;
  --vscode-list-inactiveSelectionBackground: ${dark ? "#253349" : "#e9f1fc"}; --vscode-list-hoverBackground: ${dark ? "#303b4e" : "#eef2f8"};
  --vscode-testing-iconPassed: ${dark ? "#63c598" : "#247947"}; --vscode-editorWarning-foreground: ${dark ? "#e5c07b" : "#895c0d"};
  --vscode-charts-blue: ${dark ? "#6ba9ec" : "#2675b9"}; --vscode-symbolIcon-functionForeground: ${dark ? "#b68cdd" : "#8251b5"};
}`;

const editorState = (prefix: string, value: ArrayResource | FormulaResource | AutomationDocument) => prefix === "automation"
  ? { document: value, descriptors: [], resources: { formulas: [], arrays: [] } }
  : { state: { resource: value, savedResource: value, resources: [{ id: value.id, name: value.name, updatedAt: value.updatedAt }] } };

const acknowledge = async (page: Page, prefix: string, request: SaveRequest) => {
  const value = request.resource ?? request.document;
  if (value === undefined) throw new Error("Falta el documento guardado.");
  await post(page, { type: `${prefix}.saved`, requestId: request.requestId, ...editorState(prefix, value) });
  await vi.waitFor(async () => expect(await page.locator(".dirty-state").textContent()).not.toBe("Saving…"));
};

realBrowserSuite("guardado automático compartido", () => {
  let browser: Browser;
  const bundles = new Map<string, { script: string; style: string }>();

  beforeAll(async () => {
    for (const { page } of cases) {
      const result = await build({ entryPoints: [join(process.cwd(), `src/webviews/pages/${page}/index.ts`)], outfile: "test.js", bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", logLevel: "silent" });
      bundles.set(page, { script: result.outputFiles.find(({ path }) => path.endsWith(".js"))!.text, style: result.outputFiles.find(({ path }) => path.endsWith(".css"))!.text });
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }, 20_000);
  afterAll(async () => { await browser?.close(); });

  const open = async (name: string, prefix: string, secureOrigin = false) => {
    const page = await browser.newPage();
    const markup = "<!doctype html><html><body></body></html>";
    if (secureOrigin) {
      await page.route("https://extension.test/**", (route) => route.fulfill({ contentType: "text/html", body: markup }));
      await page.goto("https://extension.test/automations");
    } else await page.setContent(markup);
    await page.addStyleTag({ content: bundles.get(name)!.style });
    await page.evaluate(() => {
      const messages: unknown[] = [];
      Object.assign(window, { messages, acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }) });
    });
    await page.addScriptTag({ content: bundles.get(name)!.script });
    const value = prefix === "array" ? { ...createArrayResource("array", "Original"), items: ["Inicial"] }
      : prefix === "formula" ? createFormula("formula", "Original") : createAutomationDocument("automation");
    if ("groups" in value) value.groups = [{ ...createAutomationGroup("group", "Original"), processes: [createAutomationProcess("process")] }];
    await post(page, { type: `${prefix}.state`, ...editorState(prefix, value) });
    await page.getByRole("switch", { name: "Auto-save", exact: true }).waitFor();
    await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-30T12:00:01Z"));
    return page;
  };

  it.each(cases.filter(({ prefix }) => prefix !== "automation"))("$page: permite abandonar un borrador sin editar y protege los cambios reales", async ({ page: name, prefix, editor }) => {
    const page = await open(name, prefix);
    try {
      const draft = prefix === "array" ? createArrayResource("untouched", "New draft") : createFormula("untouched", "New draft");
      const other = { id: "saved-other", name: "Other", updatedAt: draft.updatedAt };
      const field = page.locator(editor).first();
      const loadDraft = async () => {
        await post(page, { type: `${prefix}.state`, state: { resource: draft, savedResource: null, resources: [other] } });
        await vi.waitFor(async () => expect(await field.inputValue()).toBe("New draft"));
      };
      await loadDraft();
      expect(await page.locator(".dirty-state").textContent()).toBe("Not saved yet");
      await page.getByRole("checkbox", { name: "Select Other", exact: true }).check();
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);
      await page.locator(".resource-name").click();
      await vi.waitFor(async () => expect((await messages(page)).filter(({ type }) => type === `${prefix}.select`)).toHaveLength(1));
      expect(await page.locator("unsaved-changes-dialog").count()).toBe(0);

      await loadDraft();
      await field.fill("Edited draft");
      await page.locator(".resource-name").click();
      await page.getByRole("dialog").waitFor();
      expect((await messages(page)).filter(({ type }) => type === `${prefix}.select`)).toHaveLength(1);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(await field.inputValue()).toBe("Edited draft");
      await field.fill("New draft");
      await page.locator(".resource-name").click();
      await vi.waitFor(async () => expect((await messages(page)).filter(({ type }) => type === `${prefix}.select`)).toHaveLength(2));
      expect(await page.locator("unsaved-changes-dialog").count()).toBe(0);
    } finally { await page.close(); }
  });

  it.each(cases.filter(({ prefix }) => prefix !== "automation"))("$page: cambia de recurso sin avisos al abrirlo y después de guardarlo", async ({ page: name, prefix, editor }) => {
    const page = await open(name, prefix);
    try {
      const field = page.locator(editor).first();
      const original = prefix === "array" ? { ...createArrayResource("original", "Original"), items: ["value"] } : createFormula("original", "Original");
      const other = { id: "saved-other", name: "Other", updatedAt: original.updatedAt };
      await post(page, { type: `${prefix}.state`, ...editorState(prefix, original) });
      await post(page, { type: `${prefix}.resources`, resources: [other] });
      await page.locator(".resource-name").click();
      await vi.waitFor(async () => expect((await messages(page)).filter(({ type }) => type === `${prefix}.select`)).toHaveLength(1));
      expect(await page.locator("unsaved-changes-dialog").count()).toBe(0);

      await post(page, { type: `${prefix}.state`, ...editorState(prefix, original) });
      await post(page, { type: `${prefix}.resources`, resources: [other] });
      await field.fill("Saved edit");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const request = (await requests(page))[0]!;
      await acknowledge(page, prefix, request);
      await post(page, { type: `${prefix}.resources`, resources: [other] });
      await page.locator(".resource-name").click();
      await vi.waitFor(async () => expect((await messages(page)).filter(({ type }) => type === `${prefix}.select`)).toHaveLength(2));
      expect(await page.locator("unsaved-changes-dialog").count()).toBe(0);
      expect(await requests(page)).toHaveLength(1);
    } finally { await page.close(); }
  });

  it("selecciona procesos desde el fondo de la tarjeta y con teclado sin interferir con sus botones", async () => {
    const page = await open("Automatizaciones", "automation");
    try {
      const first = createAutomationProcess("first", "First process");
      const second = createAutomationProcess("second", "Second process");
      first.nodes = [createAutomationNode("first-node", "navigate", { x: 80, y: 70 })];
      second.nodes = [createAutomationNode("second-node", "click", { x: 80, y: 70 })];
      const document = { ...createAutomationDocument("cards"), groups: [{ ...createAutomationGroup("cards-group", "Cards"), processes: [first, second] }] };
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      const firstCard = page.locator('[data-process-id="first"]');
      const secondCard = page.locator('[data-process-id="second"]');
      await secondCard.locator(".process-heading .tree-kind").click();
      await page.locator('[data-node-id="second-node"]').waitFor();
      await firstCard.click({ position: { x: 2, y: 2 } });
      await page.locator('[data-node-id="first-node"]').waitFor();
      await secondCard.focus();
      await page.keyboard.press("Space");
      await page.locator('[data-node-id="second-node"]').waitFor();
      await firstCard.getByRole("button", { name: "Copy process", exact: true }).click();
      expect(await secondCard.getAttribute("class")).toContain("selected");
      expect(await page.locator('[data-node-id="first-node"]').count()).toBe(0);
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);
      expect((await messages(page)).some(({ type }) => type.includes(".run"))).toBe(false);
    } finally { await page.close(); }
  });

  it.each(cases)("$page: guarda por defecto sin tocar el interruptor", async ({ page: name, prefix, editor }) => {
    const page = await open(name, prefix);
    try {
      await page.locator(editor).first().fill("Cambio con guardado predeterminado");
      await page.clock.runFor(4_999);
      expect(await requests(page)).toHaveLength(0);
      await page.clock.runFor(1);
      const saves = await requests(page);
      expect(saves).toHaveLength(1);
      await acknowledge(page, prefix, saves[0]!);
      expect(await page.locator(".dirty-state").textContent()).toBe("Saved");
    } finally { await page.close(); }
  });

  it.each(cases)("$page: switch al principio, espera reiniciable, errores y ediciones durante el guardado", async ({ page: name, prefix, editor }) => {
    const page = await open(name, prefix);
    try {
      const control = page.getByRole("switch", { name: "Auto-save", exact: true });
      expect(await control.count()).toBe(1);
      expect(await page.locator("main > :first-child").getAttribute("class")).toBe("auto-save-bar");
      expect(await control.isChecked()).toBe(true);
      await control.uncheck();
      const field = page.locator(editor).first();
      await field.fill("Primer cambio");
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);

      await control.check();
      await page.clock.runFor(4_000);
      await field.press("ArrowLeft");
      await page.clock.runFor(4_000);
      await field.hover();
      await page.getByRole("heading", { level: 1 }).click();
      await page.mouse.wheel(0, 20);
      await page.clock.runFor(999);
      expect(await requests(page)).toHaveLength(0);
      await page.clock.runFor(1);
      const first = (await requests(page))[0]!;
      expect(first.resource?.preferences ?? first.document?.preferences).toEqual({ autoSaveEnabled: true });

      await field.fill("Cambio posterior");
      await post(page, { type: `${prefix}.resources`, resources: prefix === "automation" ? { formulas: [], arrays: [] } : [] });
      expect(await field.inputValue()).toBe("Cambio posterior");
      await acknowledge(page, prefix, first);
      expect(await field.inputValue()).toBe("Cambio posterior");
      expect(await page.locator(".dirty-state").textContent()).toBe("Unsaved changes");
      await page.clock.runFor(5_000);
      expect(await requests(page)).toHaveLength(2);
      const second = (await requests(page))[1]!;
      await post(page, { type: `${prefix}.saved`, requestId: first.requestId, ...editorState(prefix, first.resource ?? first.document!) });
      expect(await page.locator(".dirty-state").textContent()).toBe("Saving…");
      await post(page, { type: `${prefix}.saveFailed`, requestId: second.requestId, error: "Error de guardado" });
      await vi.waitFor(async () => expect(await page.locator(".dirty-state").textContent()).toBe("Unsaved changes"));
      await page.clock.runFor(10_000);
      expect(await requests(page)).toHaveLength(2);

      await control.uncheck();
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(2);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const third = (await requests(page))[2]!;
      expect(third.resource?.preferences ?? third.document?.preferences).toEqual({ autoSaveEnabled: false });
      await acknowledge(page, prefix, third);
      expect(await page.locator(".dirty-state").textContent()).toBe("Saved");
      await post(page, { type: `${prefix}.state`, ...editorState(prefix, third.resource ?? third.document!) });
      expect(await control.isChecked()).toBe(false);
      await page.clock.runFor(10_000);
      expect(await requests(page)).toHaveLength(3);
      expect((await messages(page)).some(({ type }) => type.endsWith(".test") || type.includes(".run"))).toBe(false);
      if (process.env.BCC_CAPTURE_PREVIEWS === "1" && prefix !== "automation") {
        await post(page, { type: `${prefix}.notice`, tone: "info", message: "" });
        const preview = prefix === "array"
          ? { ...third.resource as ArrayResource, name: "Ciudades para formularios", items: ["Madrid", "Barcelona", "Valencia", "Sevilla"] }
          : { ...third.resource as FormulaResource, name: "Generar emails de prueba", code: 'function generate() {\n  const id = Math.floor(Math.random() * 10000);\n  return "usuario" + id + "@example.test";\n}' };
        await post(page, { type: `${prefix}.state`, ...editorState(prefix, preview) });
        await post(page, { type: `${prefix}.resources`, resources: [preview, { ...preview, id: "other", name: prefix === "array" ? "Códigos postales de las oficinas de prueba" : "Nombres para completar formularios de registro" }, { ...preview, id: "third", name: prefix === "array" ? "Tipos de cuenta disponibles" : "Generar identificadores de pedidos" }] });
        await page.getByRole("checkbox", { name: `Select ${preview.name}`, exact: true }).check();
        for (const theme of ["dark", "light"] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize({ width: 1320, height: 1020 });
          const palette = await page.addStyleTag({ content: resourcePreviewPalette(theme === "dark") });
          await page.screenshot({ path: join(process.cwd(), `test-results/${prefix}-design-${theme}.png`), fullPage: true });
          await palette.evaluate((element) => element.parentNode?.removeChild(element));
        }
      }
    } finally { await page.close(); }
  });

  it("espera a terminar el arrastre de un nodo antes de contar los 5 segundos", async () => {
    const page = await open("Automatizaciones", "automation");
    try {
      const document = createAutomationDocument("automation");
      const process = createAutomationProcess("process");
      process.nodes = [createAutomationNode("node", "navigate", { x: 80, y: 70 })];
      document.groups = [{ ...createAutomationGroup("group"), processes: [process] }];
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      const node = page.locator(".flow-node");
      await node.waitFor();
      await page.getByRole("switch", { name: "Auto-save", exact: true }).check();
      const bounds = await node.boundingBox();
      if (bounds === null) throw new Error("No se encontró el nodo para arrastrarlo.");
      await page.mouse.move(bounds.x + 20, bounds.y + 20);
      await page.mouse.down();
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);
      await page.mouse.move(bounds.x + 50, bounds.y + 40);
      await page.mouse.up();
      await page.clock.runFor(4_999);
      expect(await requests(page)).toHaveLength(0);
      await page.clock.runFor(1);
      const saved = (await requests(page))[0]?.document;
      expect(saved?.groups[0]?.processes[0]?.nodes[0]?.position).not.toEqual({ x: 80, y: 70 });
      expect(await requests(page)).toHaveLength(1);
    } finally { await page.close(); }
  });

  it("Arrays no guarda contenido JSON inválido y permite corregirlo antes de guardar", async () => {
    const page = await open("Arrays", "array");
    try {
      await page.getByRole("switch", { name: "Auto-save", exact: true }).check();
      await page.locator(".code-editor").fill("[incompleto");
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);
      await page.locator(".code-editor").fill('["Corregido"]');
      await page.clock.runFor(5_000);
      const request = (await requests(page))[0]!;
      expect(request.resource).toMatchObject({ items: ["Corregido"] });
      await page.locator(".code-editor").fill('["Editado mientras se guarda"]');
      await acknowledge(page, "array", request);
      expect(await page.locator(".code-editor").inputValue()).toBe('["Editado mientras se guarda"]');
      await page.clock.runFor(5_000);
      expect((await requests(page))[1]!.resource).toMatchObject({ items: ["Editado mientras se guarda"] });
    } finally { await page.close(); }
  });

  it("permite usar la rueda mientras se sostiene un grupo y lo suelta en el destino visible", async () => {
    const page = await open("Automatizaciones", "automation");
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.addStyleTag({ content: ".automation-tree { height: 500px; overflow-y: auto; }" });
      const document = createAutomationDocument("automation");
      document.preferences = { autoSaveEnabled: true };
      document.groups = Array.from({ length: 15 }, (_, index) => ({ ...createAutomationGroup(`group-${index}`, `Group ${index + 1}`), expanded: false }));
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      const tree = page.locator(".automation-tree");
      const handle = tree.locator('.tree-group-heading .row-drag-handle').first();
      const bounds = await handle.boundingBox();
      if (bounds === null) throw new Error("No se encontró el asa del grupo.");
      await page.mouse.move(bounds.x + 12, bounds.y + 12);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 25, bounds.y + 35, { steps: 3 });
      await page.mouse.wheel(0, 500);
      await vi.waitFor(async () => expect(await tree.evaluate((element) => element.scrollTop)).toBeGreaterThan(100));
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(0);
      expect(await tree.locator(".tree-group").first().getAttribute("data-group-id")).toBe("group-0");
      await page.mouse.up();
      await vi.waitFor(async () => expect(await tree.locator(".tree-group").first().getAttribute("data-group-id")).not.toBe("group-0"));
      await page.clock.runFor(5_000);
      const saved = (await requests(page))[0]?.document;
      expect(saved?.groups.map(({ id }) => id).sort()).toEqual(document.groups.map(({ id }) => id).sort());
      expect(saved?.groups.every(({ expanded }) => expanded === false)).toBe(true);
      expect((await messages(page)).some(({ type }) => type.includes(".run"))).toBe(false);
      await acknowledge(page, "automation", (await requests(page))[0]!);
      await tree.evaluate((element) => { element.scrollTop = 0; });
      const cancelHandle = tree.locator(".tree-group-heading .row-drag-handle").first();
      const cancelBounds = await cancelHandle.boundingBox();
      if (cancelBounds === null) throw new Error("No se encontró el asa para cancelar el arrastre.");
      await page.mouse.move(cancelBounds.x + 12, cancelBounds.y + 12);
      await page.mouse.down();
      await page.mouse.move(cancelBounds.x + 25, cancelBounds.y + 35);
      await page.mouse.wheel(0, 100);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      expect(await page.locator(".row-drag-preview, .row-is-dragging").count()).toBe(0);
      expect(await tree.locator(".tree-group").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-group-id")))).toEqual(saved!.groups.map(({ id }) => id));
      await page.clock.runFor(6_000);
      expect(await requests(page)).toHaveLength(1);
    } finally { await page.mouse.up(); await page.close(); }
  });

  it("ordena grupos y procesos con drag and drop y conserva grupos plegados en JSON", async () => {
    const page = await open("Automatizaciones", "automation");
    try {
      await page.setViewportSize({ width: 1440, height: 1200 });
      const document = createAutomationDocument("automation");
      document.groups = [
        { ...createAutomationGroup("one", "Primero"), processes: [createAutomationProcess("first", "Uno"), createAutomationProcess("second", "Dos")] },
        { ...createAutomationGroup("two", "Segundo"), processes: [createAutomationProcess("third", "Tres")] },
        { ...createAutomationGroup("empty", "Vacío"), expanded: false }
      ];
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      const group = (id: string) => page.locator(`[data-group-id="${id}"]`);
      const row = (id: string) => page.locator(`[data-process-id="${id}"]`);
      const groupHandle = (id: string) => group(id).locator(".tree-group-heading .row-drag-handle");
      const groupOrder = () => page.locator(".tree-group").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-group-id")));
      const processOrder = (id: string) => group(id).locator(".process-row").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-process-id")));
      await group("empty").waitFor();
      await group("one").getByRole("button", { name: "Collapse group", exact: true }).click();
      expect(await group("one").locator(".process-list").isVisible()).toBe(false);
      await groupHandle("empty").dragTo(group("one").locator(".tree-group-header"), { targetPosition: { x: 16, y: 3 } });
      await vi.waitFor(async () => expect(await groupOrder()).toEqual(["empty", "one", "two"]));
      expect(await group("one").getByRole("button", { name: "Expand group", exact: true }).getAttribute("aria-expanded")).toBe("false");
      await group("one").getByRole("button", { name: "Expand group", exact: true }).click();

      await row("second").locator(".row-drag-handle").dragTo(row("first"), { targetPosition: { x: 16, y: 3 } });
      await vi.waitFor(async () => expect(await processOrder("one")).toEqual(["second", "first"]));
      await row("first").locator(".row-drag-handle").dragTo(row("third"), { targetPosition: { x: 16, y: 3 } });
      await vi.waitFor(async () => expect(await processOrder("two")).toEqual(["first", "third"]));
      expect(await processOrder("one")).toEqual(["second"]);
      await row("third").locator(".row-drag-handle").dragTo(group("empty").locator(".tree-group-header"));
      await vi.waitFor(async () => expect(await processOrder("empty")).toEqual(["third"]));
      expect(await group("empty").locator(".process-list").isVisible()).toBe(false);
      expect(await group("empty").locator(".tree-count").textContent()).toBe("1 process");

      await groupHandle("one").focus();
      await page.keyboard.press("Alt+ArrowDown");
      await vi.waitFor(async () => expect(await groupOrder()).toEqual(["empty", "two", "one"]));
      await group("one").getByRole("button", { name: "Collapse group", exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const saved = (await requests(page))[0]!;
      expect(saved.document?.groups.map(({ id, expanded, processes }) => ({ id, expanded, processes: processes.map(({ id }) => id) }))).toEqual([
        { id: "empty", expanded: false, processes: ["third"] },
        { id: "two", expanded: undefined, processes: ["first"] },
        { id: "one", expanded: false, processes: ["second"] }
      ]);
      await acknowledge(page, "automation", saved);
      await post(page, { type: "automation.state", ...editorState("automation", saved.document!) });
      expect(await group("one").locator(".process-list").isVisible()).toBe(false);
      expect(await group("empty").locator(".process-list").isVisible()).toBe(false);
      expect(await group("two").locator(".process-list").isVisible()).toBe(true);
      await page.getByRole("switch", { name: "Auto-save", exact: true }).check();
      await groupHandle("one").dragTo(group("two").locator(".tree-group-header"), { targetPosition: { x: 16, y: 3 } });
      await page.clock.runFor(4_999);
      expect(await requests(page)).toHaveLength(1);
      await page.clock.runFor(1);
      expect((await requests(page))[1]?.document?.groups.map(({ id }) => id)).toEqual(["empty", "one", "two"]);
      expect((await messages(page)).some(({ type }) => type.includes(".run"))).toBe(false);
    } finally { await page.close(); }
  }, 20_000);

  it("configures session removal and negative checks from the palette and retains their JSON", async () => {
    const page = await open("Automatizaciones", "automation", true);
    page.setDefaultTimeout(2_000);
    try {
      const document = createAutomationDocument("inspector-document");
      document.groups = [{ ...createAutomationGroup("group", "Checks"), processes: [createAutomationProcess("process", "Cleanup")] }];
      await post(page, { type: "automation.state", ...editorState("automation", document), descriptors: createDefaultNodeRegistry().descriptors() });
      await page.locator(".process-name").click();
      const palette = page.locator(".node-palette");
      for (const label of ["Remove Headers", "Remove Cookies", "Remove Storage"]) expect(await palette.getByRole("button", { name: new RegExp(label) }).count()).toBe(1);
      await palette.getByRole("button", { name: /Remove Storage/ }).click();
      const inspector = page.locator(".node-inspector");
      await inspector.getByLabel("Storage scope").selectOption("session");
      await inspector.getByLabel("Removal mode").selectOption("all");
      expect(await inspector.locator("name-list-editor").count()).toBe(0);
      await inspector.getByLabel("Removal mode").selectOption("selected");
      const names = inspector.locator("name-list-editor");
      const addName = names.getByRole("button", { name: "+ Add", exact: true });
      await addName.click();
      await names.getByRole("textbox").nth(0).fill("to");
      await page.keyboard.type("ken");
      expect(await names.getByRole("textbox").nth(0).inputValue()).toBe("token");
      await addName.click();
      await names.getByRole("textbox").nth(1).fill("discard");
      await addName.click();
      await names.getByRole("textbox").nth(2).fill("user");
      const confirmRowRemoval = async (confirmed: boolean) => {
        await names.getByRole("button", { name: "Delete", exact: true }).nth(1).click();
        const request = (await messages(page)).filter(({ type }) => type === "ui.confirmDestructiveAction").at(-1) as { type: string; requestId: string };
        await post(page, { type: "ui.destructiveActionConfirmed", requestId: request.requestId, confirmed });
        await vi.waitFor(async () => expect(await names.getByRole("textbox").count()).toBe(confirmed ? 2 : 3));
      };
      await confirmRowRemoval(false);
      await confirmRowRemoval(true);
      await inspector.getByLabel("Removal mode").selectOption("all");
      await inspector.getByLabel("Removal mode").selectOption("selected");
      expect(await names.getByRole("textbox").evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value))).toEqual(["token", "user"]);

      await palette.getByRole("button", { name: /Assertion/ }).click();
      await inspector.getByLabel("Type").selectOption("url-not-contains");
      expect(await inspector.getByLabel("Selector", { exact: true }).count()).toBe(0);
      await inspector.getByLabel("Expected", { exact: true }).fill("error");

      await palette.getByRole("button", { name: /Validate Data/ }).click();
      await inspector.getByLabel("Source").selectOption("sessionStorage");
      await inspector.getByLabel("Key", { exact: true }).fill("message");
      const operator = inspector.getByLabel("Operator");
      for (const value of ["not-contains", "not-matches", "json-not-equals"]) expect(await operator.locator(`option[value="${value}"]`).count()).toBe(1);
      await operator.selectOption("not-contains");
      await inspector.getByLabel("Expected value", { exact: true }).fill("error");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const saved = (await requests(page))[0]!.document!;
      expect(saved.schemaVersion).toBe(2);
      expect(saved.groups[0]?.processes[0]?.nodes.map(({ type, config }) => ({ type, config }))).toEqual([
        { type: "remove-storage", config: { scope: "session", mode: "selected", names: "token\nuser" } },
        { type: "assertion", config: { kind: "url-not-contains", selector: "", expected: "error" } },
        { type: "validate-data", config: { source: "sessionStorage", urlPattern: "", key: "message", pathPreset: "", path: "", operator: "not-contains", expected: "error" } }
      ]);
    } finally { await page.close(); }
  });

  it("shows English guidance for an existing Spanish example without renaming user data", async () => {
    const page = await open("Automatizaciones", "automation");
    try {
      let sequence = 0;
      const group = createCompleteAutomationExample(() => `legacy-${sequence += 1}`);
      group.processes = [group.processes.at(-1)!];
      group.processes[0]!.name = "18 · Todos concatenados";
      const document = { ...createAutomationDocument("legacy-document"), groups: [group] };
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      await page.locator(".process-name").click();
      expect(await page.locator(".example-guide summary").textContent()).toBe("How the connected example works");
      expect(await page.locator(".process-name").inputValue()).toBe("18 · Todos concatenados");
      expect(await page.locator(".dirty-state").textContent()).toBe("Saved");
    } finally { await page.close(); }
  });

  it("distingue los grupos de sus procesos y permite renombrarlos sin perder sus identidades", async () => {
    const page = await open("Automatizaciones", "automation", true);
    page.setDefaultTimeout(3_000);
    try {
      await page.setViewportSize({ width: 1440, height: 1100 });
      const document = createAutomationDocument("automation");
      const first = createAutomationProcess("first", "Primer proceso");
      const second = createAutomationProcess("second", "Segundo proceso");
      document.groups = [
        { ...createAutomationGroup("group", "Grupo principal"), processes: [first, second] },
        createAutomationGroup("other", "Grupo de comprobaciones")
      ];
      await post(page, { type: "automation.state", ...editorState("automation", document) });
      const group = page.locator('[data-group-id="group"]');
      const processRow = group.locator('[data-process-id="second"]');
      await processRow.waitFor();
      expect(await group.locator(".tree-group-heading .tree-kind").textContent()).toContain("Group");
      expect(await processRow.locator(".tree-kind").textContent()).toBe("Process");
      const groupName = "Acceso y validación de la cuenta de pruebas";
      const processName = "Comprobar los datos completos del formulario";
      await group.getByRole("textbox", { name: "Group name", exact: true }).fill(groupName);
      await processRow.getByRole("textbox", { name: "Process name", exact: true }).fill(processName);
      const identity = page.locator(".process-identity");
      expect(await identity.getByRole("textbox", { name: "Group name", exact: true }).inputValue()).toBe(groupName);
      expect(await identity.getByRole("textbox", { name: "Process name", exact: true }).inputValue()).toBe(processName);
      const sidebarWidth = await processRow.getByRole("textbox", { name: "Process name", exact: true }).evaluate((input) => input.getBoundingClientRect().width);
      expect(sidebarWidth).toBeGreaterThan(240);
      for (const input of await identity.locator("input").all()) {
        expect(await input.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(300);
      }

      await group.getByRole("button", { name: "Add process", exact: true }).click();
      const added = group.locator(".process-row").last();
      await vi.waitFor(async () => expect(await added.getByRole("textbox", { name: "Process name", exact: true }).evaluate((input: HTMLInputElement) => globalThis.document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length)).toBe(true));
      await page.keyboard.type("Consultar el resumen final");
      expect(await added.getByRole("textbox", { name: "Process name", exact: true }).inputValue()).toBe("Consultar el resumen final");
      await added.getByRole("combobox", { name: "Move process to group", exact: true }).selectOption("other");
      const moved = page.locator('[data-group-id="other"] .process-row');
      await moved.waitFor();
      expect(await moved.getByRole("textbox", { name: "Process name", exact: true }).inputValue()).toBe("Consultar el resumen final");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const saved = (await requests(page))[0]!.document!;
      expect(saved.groups[0]?.id).toBe("group");
      expect(saved.groups[0]?.name).toBe(groupName);
      expect(saved.groups[0]?.processes.map(({ id, name }) => [id, name])).toEqual([["first", "Primer proceso"], ["second", processName]]);
      expect(saved.groups[1]?.processes[0]?.name).toBe("Consultar el resumen final");
      expect((await messages(page)).some(({ type }) => type.includes(".run"))).toBe(false);
      await acknowledge(page, "automation", (await requests(page))[0]!);
      await page.getByRole("switch", { name: "Auto-save", exact: true }).check();
      await moved.getByRole("textbox", { name: "Process name", exact: true }).fill("Verificar el resumen final");
      await page.clock.runFor(5_000);
      expect((await requests(page))[1]?.document?.groups[1]?.processes[0]?.name).toBe("Verificar el resumen final");

      if (process.env.BCC_CAPTURE_PREVIEWS === "1") {
        const palette = await page.addStyleTag({ content: ":root { --vscode-font-family: 'Segoe UI', sans-serif; --vscode-font-size: 13px; --vscode-foreground: #e6e8ef; --vscode-descriptionForeground: #a3aab9; --vscode-editor-background: #151921; --vscode-editorWidget-background: #1d2430; --vscode-sideBar-background: #181e28; --vscode-sideBarSectionHeader-background: #252e3e; --vscode-panel-border: #344051; --vscode-input-foreground: #e6e8ef; --vscode-input-background: #111720; --vscode-button-secondaryForeground: #dfe7f4; --vscode-button-secondaryBackground: #303b4e; --vscode-button-background: #2778b8; --vscode-button-foreground: #fff; --vscode-focusBorder: #66a9ff; --vscode-disabledForeground: #7c8799; --vscode-symbolIcon-classForeground: #b68cdd; }" });
        await page.screenshot({ path: join(process.cwd(), "test-results/automation-group-hierarchy.png"), fullPage: true });
        await palette.evaluate((element) => element.parentNode?.removeChild(element));
      }
    } finally { await page.close(); }
  }, 15_000);
});
