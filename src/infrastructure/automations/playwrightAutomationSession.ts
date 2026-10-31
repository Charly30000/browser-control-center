import { t } from "../../localization";
import type { BrowserContext, Page, Response } from "playwright-core";
import { randomUUID } from "node:crypto";
import type { Logger } from "../../application/logging/logger";
import type { BrowserLaunchConfigurationProvider } from "../../application/browser/browserProvider";
import type { AssertionKind, AutomationBrowserSession, AutomationBrowserSessionFactory, BrowserUserAction, ExtractProperty, WaitKind } from "../../application/automations/automationBrowserSession";
import type { CookieEntry, HeaderEntry, InputMode, RequestOverrideEntry, StorageEntry, ViewportConfiguration } from "../../domain/manual/manualProfile";
import type { JsonValue } from "../../domain/manual/storageValue";
import { BrowserLifecycleManager } from "../browser/browserLifecycleManager";
import type { PlaywrightRuntimeProvider } from "../browser/playwrightRuntime";
import { RequestOverrideRouter } from "../browser/requestOverrideRouter";
import { toCookieParams, toHeaderRecord, toStorageValues } from "../browser/browserValueMapping";
import { readDataPath, validateDataValue, type DataAssertionOperator, type DataAssertionSource } from "../../domain/automations/dataAssertion";

const textValue = (value: JsonValue): string => typeof value === "string" ? value : JSON.stringify(value);
const optionText = (options: Readonly<Record<string, JsonValue>>, key: string, fallback = ""): string => typeof options[key] === "string" ? options[key] : fallback;
const optionNumber = (options: Readonly<Record<string, JsonValue>>, key: string, fallback = 0): number => typeof options[key] === "number" ? options[key] : fallback;

export class PlaywrightAutomationSessionFactory implements AutomationBrowserSessionFactory {
  public constructor(private readonly browserSelection: BrowserLaunchConfigurationProvider, private readonly runtime: PlaywrightRuntimeProvider, private readonly runtimeRoot: string, private readonly logger: Logger) {}
  public async create(viewport: ViewportConfiguration): Promise<AutomationBrowserSession> {
    const lifecycle = new BrowserLifecycleManager(this.runtime, this.runtimeRoot, this.logger);
    const configuration = await this.browserSelection.resolveLaunchConfiguration();
    const runtime = await lifecycle.start(configuration, viewport);
    try {
      const router = new RequestOverrideRouter();
      await router.attach(runtime.context);
      const page = await runtime.context.newPage();
      const viewportSize = { width: viewport.width, height: viewport.height };
      await page.setViewportSize(viewportSize);
      return new PlaywrightAutomationSession(lifecycle, runtime.context, page, router, viewportSize, this.logger);
    } catch (error: unknown) {
      await lifecycle.stop("force").catch(() => undefined);
      throw error;
    }
  }
}

class PlaywrightAutomationSession implements AutomationBrowserSession {
  private lastResponseStatus: number | null = null;
  private readonly observedRequests: Array<{ readonly url: string; readonly method: string; readonly headers: Record<string, string>; readonly body: string | null }> = [];
  private readonly observedResponses: Array<{ readonly response: Response; readonly url: string; readonly status: number; readonly headers: Record<string, string> }> = [];
  private promptBindingInstalled = false;
  private readonly promptBindingName = `__browserControl_${randomUUID().replace(/-/g, "")}`;
  private activePromptMessage: string | null = null;
  private promptResolver: ((action: BrowserUserAction) => void) | null = null;
  public constructor(private readonly lifecycle: BrowserLifecycleManager, private readonly context: BrowserContext, private readonly page: Page, private readonly router: RequestOverrideRouter, private readonly viewportSize: { readonly width: number; readonly height: number }, private readonly logger: Logger) {
    page.on("request", (request) => {
      this.remember(this.observedRequests, { url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() });
    });
    page.on("response", (response) => {
      this.lastResponseStatus = response.status();
      this.remember(this.observedResponses, { response, url: response.url(), status: response.status(), headers: response.headers() });
    });
    page.on("domcontentloaded", () => { if (this.activePromptMessage !== null) void this.renderUserPrompt(this.activePromptMessage).catch(() => undefined); });
    page.on("close", () => { const resolve = this.promptResolver; this.promptResolver = null; this.activePromptMessage = null; resolve?.("dismissed"); });
  }
  public async navigate(url: string, timeoutMs: number): Promise<void> {
    await this.page.setViewportSize(this.viewportSize);
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await this.page.setViewportSize(this.viewportSize);
    await this.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const diagnostics = await this.viewportDiagnostics();
    if (diagnostics.innerWidth !== this.viewportSize.width || diagnostics.innerHeight !== this.viewportSize.height) {
      this.logger.warn(t("text.viewportRequestedArg0Arg1ButTheDOMReportsArg2Arg3Arg4", { arg0: this.viewportSize.width, arg1: this.viewportSize.height, arg2: diagnostics.innerWidth, arg3: diagnostics.innerHeight, arg4: this.formatViewportDiagnostics(diagnostics) }));
    }
  }
  public async click(selector: string, timeoutMs: number): Promise<void> { await this.page.locator(selector).first().click({ timeout: timeoutMs }); }
  public async fill(selector: string, value: JsonValue, mode: InputMode, delayMs: number, timeoutMs: number): Promise<void> {
    const locator = this.page.locator(selector).first(); const valueText = textValue(value);
    if (mode === "sequential") { await locator.fill("", { timeout: timeoutMs }); await locator.pressSequentially(valueText, { delay: delayMs, timeout: timeoutMs }); }
    else await locator.fill(valueText, { timeout: timeoutMs });
  }
  public async setHeaders(entries: readonly HeaderEntry[]): Promise<void> { await this.context.setExtraHTTPHeaders(toHeaderRecord(entries)); }
  public async setCookies(entries: readonly CookieEntry[]): Promise<void> {
    const url = this.page.url();
    if (url === "about:blank" && entries.some(({ enabled, domain }) => enabled && domain.trim() === "")) throw new Error(t("text.navigateFirstOrSpecifyTheCookieDomain"));
    await this.context.addCookies(toCookieParams(entries, url));
  }
  public async setStorage(scope: "local" | "session", entries: readonly StorageEntry[]): Promise<void> {
    const values = toStorageValues(entries);
    await this.page.evaluate(({ storageScope, storageEntries }) => { const storage = storageScope === "local" ? localStorage : sessionStorage; for (const entry of storageEntries) storage.setItem(entry.key, entry.value); }, { storageScope: scope, storageEntries: values });
  }
  public setRequestOverrides(entries: readonly RequestOverrideEntry[]): Promise<void> { this.router.update(entries.filter(({ enabled }) => enabled)); return Promise.resolve(); }
  public async wait(kind: WaitKind, options: Readonly<Record<string, JsonValue>>, timeoutMs: number): Promise<void | JsonValue> {
    switch (kind) {
      case "fixed": await this.page.waitForTimeout(Math.max(0, optionNumber(options, "durationMs"))); return;
      case "random": {
        const min = Math.max(0, optionNumber(options, "durationMs")); const max = Math.max(min, optionNumber(options, "maxDurationMs", min));
        await this.page.waitForTimeout(min + Math.floor(Math.random() * (max - min + 1))); return;
      }
      case "element": await this.page.locator(optionText(options, "selector")).first().waitFor({ state: "visible", timeout: timeoutMs }); return;
      case "url": await this.page.waitForURL(optionText(options, "url"), { timeout: timeoutMs }); return;
      case "navigation": await this.page.waitForLoadState("load", { timeout: timeoutMs }); return;
      case "response": {
        const pattern = optionText(options, "url"); const status = optionNumber(options, "status", 0);
        const response = await this.page.waitForResponse((candidate) => (pattern === "" || candidate.url().includes(pattern)) && (status === 0 || candidate.status() === status), { timeout: timeoutMs });
        this.lastResponseStatus = response.status();
        const rawBody = await response.text();
        let body: JsonValue = rawBody;
        try { body = JSON.parse(rawBody) as JsonValue; } catch { /* Las respuestas de texto conservan su contenido original. */ }
        return { url: response.url(), status: response.status(), headers: response.headers(), body };
      }
    }
  }
  public async assert(kind: AssertionKind, options: Readonly<Record<string, JsonValue>>, timeoutMs: number): Promise<void> {
    const selector = optionText(options, "selector"); const expected = optionText(options, "expected"); const locator = this.page.locator(selector).first();
    switch (kind) {
      case "exists": if (await locator.count() === 0) throw new Error(t("text.noElementExistsForArg0", { arg0: selector })); return;
      case "visible": await locator.waitFor({ state: "visible", timeout: timeoutMs }); return;
      case "text-equals": {
        const actual = (await locator.textContent({ timeout: timeoutMs })) ?? "";
        if (actual !== expected) {
          const diagnostics = await this.viewportDiagnostics();
          throw new Error(t("text.expectedTextArg0ReceivedArg1Arg2", { arg0: expected, arg1: actual, arg2: this.formatViewportDiagnostics(diagnostics) }));
        }
        return;
      }
      case "value-equals": { const actual = await locator.inputValue({ timeout: timeoutMs }); if (actual !== expected) throw new Error(t("text.expectedValueArg0ReceivedArg1", { arg0: expected, arg1: actual })); return; }
      case "url-equals": if (this.page.url() !== expected) throw new Error(t("text.expectedURLArg0ReceivedArg1", { arg0: expected, arg1: this.page.url() })); return;
      case "response-status": { const status = Number(expected); if (this.lastResponseStatus !== status) throw new Error(t("text.expectedStatusArg0ReceivedArg1", { arg0: status, arg1: this.lastResponseStatus ?? t("labels.none") })); return; }
    }
  }
  public async assertData(source: DataAssertionSource, operator: DataAssertionOperator, options: Readonly<Record<string, JsonValue>>, _timeoutMs: number): Promise<void> {
    const urlPattern = optionText(options, "urlPattern");
    const key = optionText(options, "key");
    const path = optionText(options, "path");
    const expected = optionText(options, "expected");
    let actual: unknown;
    let label: string;

    if (source === "request") {
      const request = this.findLast(this.observedRequests, urlPattern);
      actual = request === undefined ? undefined : readDataPath(request, path);
      label = t("text.fieldArg0OfTheLastRequestArg1", { arg0: path, arg1: urlPattern === "" ? "" : t("validation.urlFilterSuffix", { url: urlPattern }) });
    } else if (source === "response") {
      const observed = this.findLast(this.observedResponses, urlPattern);
      if (observed === undefined) actual = undefined;
      else {
        let body: string | null = null;
        if (path === "body" || path.startsWith("body.")) {
          try { body = await observed.response.text(); }
          catch { body = null; }
        }
        actual = readDataPath({ url: observed.url, status: observed.status, headers: observed.headers, body }, path);
      }
      label = t("text.fieldArg0OfTheLastResponseArg1", { arg0: path, arg1: urlPattern === "" ? "" : t("validation.urlFilterSuffix", { url: urlPattern }) });
    } else if (source === "cookie") {
      const cookie = (await this.context.cookies()).find(({ name }) => name === key);
      actual = cookie === undefined ? undefined : readDataPath(cookie, path === "" ? "value" : path);
      label = t("text.cookieArg0Arg1", { arg0: key, arg1: path === "" || path === "value" ? "" : t("validation.propertySuffix", { path }) });
    } else {
      const raw = await this.page.evaluate(({ storageScope, storageKey }) => {
        const storage = storageScope === "localStorage" ? localStorage : sessionStorage;
        return storage.getItem(storageKey);
      }, { storageScope: source, storageKey: key });
      actual = raw === null ? undefined : readDataPath(raw, path);
      label = `${source}.${key}${path === "" ? "" : `.${path}`}`;
    }

    const result = validateDataValue(actual, operator, expected, label);
    if (!result.ok) throw new Error(result.error);
  }
  public async extract(selector: string, property: ExtractProperty, attribute: string, timeoutMs: number): Promise<JsonValue> {
    const locator = this.page.locator(selector).first(); await locator.waitFor({ state: "attached", timeout: timeoutMs });
    if (property === "value") return locator.inputValue({ timeout: timeoutMs });
    if (property === "textContent") return (await locator.textContent({ timeout: timeoutMs })) ?? "";
    if (property === "innerText") return locator.innerText({ timeout: timeoutMs });
    return (await locator.getAttribute(attribute, { timeout: timeoutMs })) ?? null;
  }
  public async showUserPrompt(message: string): Promise<BrowserUserAction> {
    await this.ensurePromptBinding();
    this.promptResolver?.("dismissed");
    this.activePromptMessage = message;
    const action = new Promise<BrowserUserAction>((resolve) => { this.promptResolver = resolve; });
    try { await this.renderUserPrompt(message); }
    catch (error: unknown) { this.activePromptMessage = null; this.promptResolver?.("dismissed"); this.promptResolver = null; throw error; }
    return action;
  }
  public async hideUserPrompt(): Promise<void> {
    this.activePromptMessage = null;
    const resolve = this.promptResolver; this.promptResolver = null; resolve?.("dismissed");
    await this.page.evaluate(() => { document.querySelector("#__browser-control-wait")?.remove(); }).catch(() => undefined);
  }
  public async close(force: boolean): Promise<void> { await this.lifecycle.stop(force ? "force" : "graceful"); }

  private remember<T>(entries: T[], entry: T): void { entries.push(entry); if (entries.length > 200) entries.shift(); }
  private async viewportDiagnostics(): Promise<{ readonly playwright: { readonly width: number; readonly height: number } | null; readonly innerWidth: number; readonly innerHeight: number; readonly outerWidth: number; readonly outerHeight: number; readonly screenWidth: number; readonly screenHeight: number; readonly visualWidth: number | null; readonly visualHeight: number | null; readonly visualScale: number | null; readonly devicePixelRatio: number }> {
    const browserMetrics = await this.page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      visualWidth: window.visualViewport?.width ?? null,
      visualHeight: window.visualViewport?.height ?? null,
      visualScale: window.visualViewport?.scale ?? null,
      devicePixelRatio: window.devicePixelRatio
    }));
    return { playwright: this.page.viewportSize(), ...browserMetrics };
  }
  private formatViewportDiagnostics(diagnostics: Awaited<ReturnType<PlaywrightAutomationSession["viewportDiagnostics"]>>): string {
    const playwright = diagnostics.playwright === null ? "null" : `${diagnostics.playwright.width}×${diagnostics.playwright.height}`;
    const visual = diagnostics.visualWidth === null || diagnostics.visualHeight === null ? "null" : `${diagnostics.visualWidth}×${diagnostics.visualHeight} (escala ${diagnostics.visualScale ?? "null"})`;
    return t("text.playwrightViewportArg0InnerArg1Arg2OuterArg3Arg4ScreenArg5Arg6VisualArg7DPRArg8", { arg0: playwright, arg1: diagnostics.innerWidth, arg2: diagnostics.innerHeight, arg3: diagnostics.outerWidth, arg4: diagnostics.outerHeight, arg5: diagnostics.screenWidth, arg6: diagnostics.screenHeight, arg7: visual, arg8: diagnostics.devicePixelRatio });
  }
  private findLast<T extends { readonly url: string }>(entries: readonly T[], pattern: string): T | undefined {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry !== undefined && (pattern === "" || entry.url.includes(pattern))) return entry;
    }
    return undefined;
  }
  private async ensurePromptBinding(): Promise<void> {
    if (this.promptBindingInstalled) return;
    await this.page.exposeFunction(this.promptBindingName, (action: unknown) => {
      if (action !== "continue" && action !== "retry" && action !== "stop") return;
      const resolve = this.promptResolver; this.promptResolver = null; resolve?.(action);
    });
    this.promptBindingInstalled = true;
  }
  private async renderUserPrompt(message: string): Promise<void> {
    await this.page.evaluate(({ promptMessage, bindingName, labels }) => {
      const id = "__browser-control-wait";
      document.querySelector(`#${id}`)?.remove();
      const host = document.createElement("div"); host.id = id;
      Object.assign(host.style, { position: "fixed", top: "0", left: "0", width: "100%", zIndex: "2147483647", pointerEvents: "none" });
      document.documentElement.append(host);
      const root = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = `:host{all:initial}.bar{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;color:#f8fafc;background:#1e293bee;border-bottom:1px solid #64748b;font:13px system-ui,sans-serif;box-shadow:0 4px 16px #0005;pointer-events:auto}.message{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title{font-weight:700}button{padding:6px 11px;border:1px solid #94a3b8;border-radius:5px;color:#f8fafc;background:#334155;font:inherit;cursor:pointer}button:hover{background:#475569}.continue{border-color:#86efac;background:#166534}.stop{border-color:#fca5a5;background:#991b1b}`;
      const bar = document.createElement("div"); bar.className = "bar";
      const title = document.createElement("span"); title.className = "title"; title.textContent = labels.title;
      const text = document.createElement("span"); text.className = "message"; text.textContent = promptMessage;
      const action = (value: "continue" | "retry" | "stop"): void => { const bridge = (window as unknown as Record<string, unknown>)[bindingName]; if (typeof bridge === "function") void (bridge as (next: string) => Promise<void>)(value); };
      const button = (label: string, value: "continue" | "retry" | "stop", className = ""): HTMLButtonElement => { const element = document.createElement("button"); element.type = "button"; element.textContent = label; element.className = className; element.addEventListener("click", () => action(value)); return element; };
      bar.append(title, text, button(labels.continue, "continue", "continue"), button(labels.retry, "retry"), button(labels.stop, "stop", "stop"));
      root.append(style, bar);
    }, { promptMessage: message, bindingName: this.promptBindingName, labels: { title: t("text.automationPaused"), continue: t("text.continue"), retry: t("text.retry"), stop: t("text.stop") } });
  }
}
