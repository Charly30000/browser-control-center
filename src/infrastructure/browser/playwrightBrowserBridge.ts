import type { BrowserContext, Page } from "playwright-core";
import type { BrowserLaunchConfigurationProvider } from "../../application/browser/browserProvider";
import type { Logger } from "../../application/logging/logger";
import type {
  BrowserBridge,
  BrowserEventListener,
  BrowserLaunchOptions,
  BrowserPageSnapshot,
  BrowserSessionSnapshot,
  BrowserStopMode,
  Disposable,
  ElementTarget,
  ResolvedInputBinding,
  StorageScope
} from "../../domain/browser/browserBridge";
import type { CookieEntry, HeaderEntry, RequestOverrideEntry, StorageEntry } from "../../domain/manual/manualProfile";
import type { BrowserLifecycleManager, BrowserRuntimeSession } from "./browserLifecycleManager";
import { BrowserPageRegistry } from "./browserPageRegistry";
import { ElementPickerService } from "./elementPickerService";
import { RequestOverrideRouter } from "./requestOverrideRouter";
import { toCookieParams, toHeaderRecord, toStorageValues } from "./browserValueMapping";
import { ManualFormSubmissionGuard } from "./manualFormSubmissionGuard";

const MANUAL_INPUT_TIMEOUT_MS = 2_000;

interface OriginalInputValue extends ResolvedInputBinding { readonly originalValue: unknown; }

const toInputText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return `${value}`;
  return JSON.stringify(value) ?? "";
};

export class PlaywrightBrowserBridge implements BrowserBridge {
  private registry: BrowserPageRegistry | null = null;
  private router: RequestOverrideRouter | null = null;
  private originals: OriginalInputValue[] = [];
  private readonly listeners = new Set<BrowserEventListener>();
  private readonly picker = new ElementPickerService();
  private readonly submissionGuard = new ManualFormSubmissionGuard();

  public constructor(
    private readonly browserSelection: BrowserLaunchConfigurationProvider,
    private readonly lifecycle: BrowserLifecycleManager,
    private readonly logger: Logger
  ) {
    this.lifecycle.onDidChange((state) => {
      if (state === "stopped" || state === "crashed") this.clearSessionState();
      this.emit();
    });
  }

  public async start(options: BrowserLaunchOptions): Promise<BrowserSessionSnapshot> {
    if (this.lifecycle.getState() === "running" && this.registry !== null) return this.getSnapshot();
    const configuration = await this.browserSelection.resolveLaunchConfiguration();
    const session = await this.lifecycle.start(configuration, options.viewport);
    await this.configureSession(session);
    return this.getSnapshot();
  }

  public async stop(mode: BrowserStopMode): Promise<void> {
    await this.lifecycle.stop(mode);
    this.clearSessionState();
    this.emit();
  }

  public async restart(options: BrowserLaunchOptions): Promise<BrowserSessionSnapshot> {
    const configuration = await this.browserSelection.resolveLaunchConfiguration();
    const session = await this.lifecycle.restart(configuration, options.viewport);
    await this.configureSession(session);
    return this.getSnapshot();
  }

  public getSnapshot(): BrowserSessionSnapshot {
    const pages = this.registry?.snapshot() ?? [];
    return { lifecycle: this.lifecycle.getState(), pages, activePageId: pages.find(({ active }) => active)?.id ?? null };
  }

  public listPages(): readonly BrowserPageSnapshot[] { return this.registry?.snapshot() ?? []; }

  public async selectPage(pageId: string): Promise<void> {
    await this.requireRegistry().select(pageId);
    this.emit();
  }

  public async closePage(pageId: string): Promise<void> {
    await this.requireRegistry().close(pageId);
    if (this.requireRegistry().activePage() === null) {
      const page = await this.requireContext().newPage();
      this.requireRegistry().register(page);
    }
    this.emit();
  }

  public async open(url: string, options: BrowserLaunchOptions): Promise<void> {
    if (this.lifecycle.getState() !== "running") await this.start(options);
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    this.emit();
  }

  public async applyHeaders(headers: readonly HeaderEntry[]): Promise<void> {
    const values = toHeaderRecord(headers);
    await this.requireContext().setExtraHTTPHeaders(values);
    this.logger.debug(`${Object.keys(values).length} cabeceras aplicadas.`);
  }

  public async applyCookies(cookies: readonly CookieEntry[]): Promise<void> {
    const page = await this.ensurePage();
    const fallbackUrl = page.url();
    if (fallbackUrl === "about:blank" && cookies.some(({ enabled, domain }) => enabled && domain.trim() === "")) {
      throw new Error("Navega primero a una URL o indica el dominio de la cookie.");
    }
    const values = toCookieParams(cookies, fallbackUrl);
    await this.requireContext().addCookies(values);
    this.logger.debug(`${values.length} cookies aplicadas.`);
  }

  public async applyStorage(scope: StorageScope, entries: readonly StorageEntry[]): Promise<void> {
    const page = await this.ensurePage();
    const values = toStorageValues(entries);
    await page.evaluate(({ storageScope, storageEntries }) => {
      const storage = storageScope === "local" ? localStorage : sessionStorage;
      for (const entry of storageEntries) storage.setItem(entry.key, entry.value);
    }, { storageScope: scope, storageEntries: values });
  }

  public applyRequestOverrides(overrides: readonly RequestOverrideEntry[]): Promise<void> {
    const router = this.router;
    if (router === null) throw new Error("No hay una sesión de navegador activa.");
    router.update(overrides.filter(({ enabled }) => enabled));
    this.logger.debug(`${overrides.length} overrides configurados.`);
    return Promise.resolve();
  }

  public async applyInputBindings(bindings: readonly ResolvedInputBinding[]): Promise<void> {
    const page = await this.ensurePage();
    for (const binding of bindings) {
      if (binding.selector.trim() === "") throw new Error("El selector del generador es obligatorio.");
      const locator = page.locator(binding.selector).first();
      if (await locator.count() === 0) throw new Error("No se encontró el elemento en la página actual.");
      const originalValue = await locator.evaluate((element, configuration) => {
        if (configuration.propertyKind === "attribute") return element.getAttribute(configuration.propertyName);
        return (element as unknown as Record<string, unknown>)[configuration.propertyKind === "property" ? configuration.propertyName : configuration.propertyKind];
      }, binding, { timeout: MANUAL_INPUT_TIMEOUT_MS });
      this.originals.push({ ...binding, originalValue });
      await this.submissionGuard.run(page, () => this.writeInput(locator, binding, binding.value));
    }
  }

  public async resetInputBindings(): Promise<void> {
    const page = await this.ensurePage();
    for (const binding of [...this.originals].reverse()) {
      await this.submissionGuard.run(page, () => this.writeInput(page.locator(binding.selector).first(), binding, binding.originalValue));
    }
    this.originals = [];
  }

  public async selectElement(): Promise<ElementTarget> {
    const result = await this.picker.pick(await this.ensurePage());
    if (result.selector === "") throw new Error("Selección cancelada.");
    return result;
  }

  public onDidChange(listener: BrowserEventListener): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private async configureSession(session: BrowserRuntimeSession): Promise<void> {
    this.clearSessionState();
    const registry = new BrowserPageRegistry(() => this.emit());
    this.registry = registry;
    this.router = new RequestOverrideRouter();
    await this.router.attach(session.context);
    session.context.on("page", (page) => registry.register(page));
    for (const page of session.context.pages()) registry.register(page);
    if (session.context.pages().length === 0) registry.register(await session.context.newPage());
    this.originals = [];
    this.emit();
  }

  private async ensurePage(): Promise<Page> {
    const registry = this.requireRegistry();
    const active = registry.activePage();
    if (active !== null) return active;
    const page = await this.requireContext().newPage();
    registry.register(page);
    return page;
  }

  private requireContext(): BrowserContext {
    const context = this.lifecycle.getSession()?.context;
    if (context === undefined) throw new Error("Abre el navegador antes de aplicar la configuración.");
    return context;
  }

  private requireRegistry(): BrowserPageRegistry {
    if (this.registry === null) throw new Error("No hay una sesión de navegador activa.");
    return this.registry;
  }

  private async writeInput(locator: ReturnType<Page["locator"]>, binding: ResolvedInputBinding, value: unknown): Promise<void> {
    if (binding.propertyKind === "value") {
      const text = toInputText(value);
      if (binding.inputMode === "sequential") {
        await locator.fill("", { timeout: MANUAL_INPUT_TIMEOUT_MS });
        await locator.pressSequentially(text, { delay: binding.delayMs, timeout: MANUAL_INPUT_TIMEOUT_MS + text.length * binding.delayMs });
      } else await locator.fill(text, { timeout: MANUAL_INPUT_TIMEOUT_MS });
      return;
    }
    if (binding.propertyKind === "checked") {
      const checked = value === true || value === "true" || value === 1;
      await locator.setChecked(checked, { timeout: MANUAL_INPUT_TIMEOUT_MS });
      return;
    }
    await locator.evaluate((element, configuration) => {
      if (configuration.propertyKind === "attribute") {
        if (configuration.value === null || configuration.value === undefined) element.removeAttribute(configuration.propertyName);
        else {
          const text = typeof configuration.value === "string" ? configuration.value :
            typeof configuration.value === "number" || typeof configuration.value === "boolean" || typeof configuration.value === "bigint" ? `${configuration.value}` :
              JSON.stringify(configuration.value) ?? "";
          element.setAttribute(configuration.propertyName, text);
        }
      } else {
        const key = configuration.propertyKind === "property" ? configuration.propertyName : configuration.propertyKind;
        (element as unknown as Record<string, unknown>)[key] = configuration.value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }, { propertyKind: binding.propertyKind, propertyName: binding.propertyName, value }, { timeout: MANUAL_INPUT_TIMEOUT_MS });
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private clearSessionState(): void {
    this.registry?.dispose();
    this.registry = null;
    this.router = null;
    this.originals = [];
  }
}
