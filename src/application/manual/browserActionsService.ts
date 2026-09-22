import type { BrowserBridge, BrowserSessionSnapshot, ResolvedInputBinding } from "../../domain/browser/browserBridge";
import { buildUrlWithQueryParams } from "../../domain/manual/queryParams";
import { parseStorageValue } from "../../domain/manual/storageValue";
import { validateRequestOverride } from "../../domain/manual/requestOverride";
import type { GeneratorBinding, ManualProfile } from "../../domain/manual/manualProfile";
import { failure, success, type Result } from "../../shared/result";
import type { GeneratorValueResolver } from "./generatorValueResolver";

export type BrowserActionTarget = "headers" | "cookies" | "localStorage" | "sessionStorage" | "overrides" | "generators";

export class BrowserActionsService {
  public constructor(private readonly browser: BrowserBridge, private readonly generators: GeneratorValueResolver) {}

  public getSnapshot(): BrowserSessionSnapshot { return this.browser.getSnapshot(); }
  public onDidChange(listener: (snapshot: BrowserSessionSnapshot) => void): { dispose(): void } { return this.browser.onDidChange(listener); }

  public async start(profile: ManualProfile): Promise<Result<BrowserSessionSnapshot>> {
    return this.executeValue(() => this.browser.start({ viewport: profile.viewport }));
  }

  public async stop(force = false): Promise<Result<void>> { return this.execute(() => this.browser.stop(force ? "force" : "graceful")); }
  public async restart(profile: ManualProfile): Promise<Result<BrowserSessionSnapshot>> { return this.executeValue(() => this.browser.restart({ viewport: profile.viewport })); }
  public async selectPage(pageId: string): Promise<Result<void>> { return this.execute(() => this.browser.selectPage(pageId)); }
  public async closePage(pageId: string): Promise<Result<void>> { return this.execute(() => this.browser.closePage(pageId)); }

  public async open(profile: ManualProfile): Promise<Result<void>> {
    const url = buildUrlWithQueryParams(profile.url, profile.queryParams);
    if (!url.ok) return url;
    return this.execute(() => this.browser.open(url.value, { viewport: profile.viewport }));
  }

  public async syncOverrides(profile: ManualProfile): Promise<Result<void>> {
    if (this.browser.getSnapshot().lifecycle !== "running") return success(undefined);
    const overrides = profile.requestOverrides.filter(({ enabled }) => enabled);
    const invalid = overrides.map(validateRequestOverride).find((result) => !result.ok);
    if (invalid !== undefined && !invalid.ok) return failure(invalid.error);
    return this.execute(() => this.browser.applyRequestOverrides(overrides));
  }

  public async apply(profile: ManualProfile, target: BrowserActionTarget, rowId: string | null): Promise<Result<void>> {
    switch (target) {
      case "headers": return this.execute(() => this.browser.applyHeaders(this.select(profile.headers, rowId)));
      case "cookies": return this.execute(() => this.browser.applyCookies(this.select(profile.cookies, rowId)));
      case "localStorage": return this.applyStorage(profile, "localStorage", "local", rowId);
      case "sessionStorage": return this.applyStorage(profile, "sessionStorage", "session", rowId);
      case "overrides": {
        const overrides = this.select(profile.requestOverrides, rowId);
        const invalid = overrides.map(validateRequestOverride).find((result) => !result.ok);
        if (invalid !== undefined && !invalid.ok) return failure(invalid.error);
        return this.execute(() => this.browser.applyRequestOverrides(overrides));
      }
      case "generators": {
        const resolved: ResolvedInputBinding[] = [];
        for (const binding of this.select(profile.generatorBindings, rowId)) {
          const value = await this.generators.resolve(binding);
          if (!value.ok) return value;
          resolved.push({
            selector: binding.selector,
            propertyKind: binding.propertyKind,
            propertyName: binding.propertyName,
            value: value.value,
            inputMode: binding.inputMode,
            delayMs: binding.delayMs
          });
        }
        return this.execute(() => this.browser.applyInputBindings(resolved));
      }
    }
  }

  public async previewGenerator(binding: GeneratorBinding): Promise<Result<string>> {
    const result = await this.generators.resolve(binding);
    if (!result.ok) return result;
    return success(result.value === undefined ? "Sin resultado" : JSON.stringify(result.value) ?? "Sin resultado");
  }

  public async selectElement(): Promise<Result<string>> {
    const result = await this.executeValue(() => this.browser.selectElement());
    return result.ok ? success(result.value.selector) : result;
  }

  public async resetGenerators(): Promise<Result<void>> { return this.execute(() => this.browser.resetInputBindings()); }

  private async applyStorage(profile: ManualProfile, field: "localStorage" | "sessionStorage", scope: "local" | "session", rowId: string | null): Promise<Result<void>> {
    const entries = this.select(profile[field], rowId);
    const invalid = entries.find((entry) => !parseStorageValue(entry.valueType, entry.value).ok);
    if (invalid !== undefined) return failure(`El valor de storage para «${invalid.key || "sin clave"}» no es válido.`);
    return this.execute(() => this.browser.applyStorage(scope, entries));
  }

  private select<T extends { readonly id: string; readonly enabled: boolean }>(entries: readonly T[], rowId: string | null): T[] {
    return entries.filter((entry) => entry.enabled && (rowId === null || entry.id === rowId));
  }

  private async execute(action: () => Promise<void>): Promise<Result<void>> {
    try { await action(); return success(undefined); }
    catch (error: unknown) { return failure(error instanceof Error ? error.message : "La acción de navegador ha fallado."); }
  }

  private async executeValue<T>(action: () => Promise<T>): Promise<Result<T>> {
    try { return success(await action()); }
    catch (error: unknown) { return failure(error instanceof Error ? error.message : "La acción de navegador ha fallado."); }
  }
}
