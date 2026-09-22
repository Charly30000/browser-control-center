import type {
  CookieEntry,
  GeneratorBinding,
  HeaderEntry,
  RequestOverrideEntry,
  StorageEntry
} from "../manual/manualProfile";

export type StorageScope = "local" | "session";

export interface BrowserBridge {
  open(url: string): Promise<void>;
  applyHeaders(headers: readonly HeaderEntry[]): Promise<void>;
  applyCookies(cookies: readonly CookieEntry[]): Promise<void>;
  applyStorage(scope: StorageScope, entries: readonly StorageEntry[]): Promise<void>;
  applyRequestOverrides(overrides: readonly RequestOverrideEntry[]): Promise<void>;
  applyGeneratorBindings(bindings: readonly GeneratorBinding[]): Promise<void>;
  resetGeneratorBindings(): Promise<void>;
  selectElement(): Promise<string>;
}

export class BrowserUnavailableError extends Error {
  public constructor() {
    super("El navegador todavía no está configurado. Esta acción estará disponible al integrar Playwright.");
    this.name = "BrowserUnavailableError";
  }
}
