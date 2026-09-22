import type { BrowserBridge } from "../../domain/browser/browserBridge";
import { buildUrlWithQueryParams } from "../../domain/manual/queryParams";
import { parseStorageValue } from "../../domain/manual/storageValue";
import { validateRequestOverride } from "../../domain/manual/requestOverride";
import type { ManualProfile } from "../../domain/manual/manualProfile";
import { failure, success, type Result } from "../../shared/result";

export type BrowserActionTarget = "headers" | "cookies" | "localStorage" | "sessionStorage" | "overrides" | "generators";

export class BrowserActionsService {
  public constructor(private readonly browser: BrowserBridge) {}

  public async open(profile: ManualProfile): Promise<Result<void>> {
    const url = buildUrlWithQueryParams(profile.url, profile.queryParams);
    if (!url.ok) return url;
    return this.execute(() => this.browser.open(url.value));
  }

  public async apply(profile: ManualProfile, target: BrowserActionTarget, rowId: string | null): Promise<Result<void>> {
    switch (target) {
      case "headers":
        return this.execute(() => this.browser.applyHeaders(this.select(profile.headers, rowId)));
      case "cookies":
        return this.execute(() => this.browser.applyCookies(this.select(profile.cookies, rowId)));
      case "localStorage": {
        const entries = this.select(profile.localStorage, rowId);
        const invalid = entries.find((entry) => !parseStorageValue(entry.valueType, entry.value).ok);
        if (invalid !== undefined) return failure(`El valor de storage para «${invalid.key || "sin clave"}» no es válido.`);
        return this.execute(() => this.browser.applyStorage("local", entries));
      }
      case "sessionStorage": {
        const entries = this.select(profile.sessionStorage, rowId);
        const invalid = entries.find((entry) => !parseStorageValue(entry.valueType, entry.value).ok);
        if (invalid !== undefined) return failure(`El valor de storage para «${invalid.key || "sin clave"}» no es válido.`);
        return this.execute(() => this.browser.applyStorage("session", entries));
      }
      case "overrides": {
        const overrides = this.select(profile.requestOverrides, rowId);
        const invalid = overrides.map(validateRequestOverride).find((result) => !result.ok);
        if (invalid !== undefined && !invalid.ok) return failure(invalid.error);
        return this.execute(() => this.browser.applyRequestOverrides(overrides));
      }
      case "generators":
        return this.execute(() => this.browser.applyGeneratorBindings(this.select(profile.generatorBindings, rowId)));
    }
  }

  public async selectElement(): Promise<Result<string>> {
    try {
      return success(await this.browser.selectElement());
    } catch (error: unknown) {
      return failure(error instanceof Error ? error.message : "No se pudo seleccionar el elemento.");
    }
  }

  public async resetGenerators(): Promise<Result<void>> {
    return this.execute(() => this.browser.resetGeneratorBindings());
  }

  private select<T extends { readonly id: string; readonly enabled: boolean }>(entries: readonly T[], rowId: string | null): T[] {
    return entries.filter((entry) => entry.enabled && (rowId === null || entry.id === rowId));
  }

  private async execute(action: () => Promise<void>): Promise<Result<void>> {
    try {
      await action();
      return success(undefined);
    } catch (error: unknown) {
      return failure(error instanceof Error ? error.message : "La acción de navegador ha fallado.");
    }
  }
}
