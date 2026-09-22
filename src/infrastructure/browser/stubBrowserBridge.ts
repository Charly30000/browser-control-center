import { BrowserUnavailableError, type BrowserBridge, type StorageScope } from "../../domain/browser/browserBridge";
import type {
  CookieEntry,
  GeneratorBinding,
  HeaderEntry,
  RequestOverrideEntry,
  StorageEntry
} from "../../domain/manual/manualProfile";

export class StubBrowserBridge implements BrowserBridge {
  public open(_url: string): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public applyHeaders(_headers: readonly HeaderEntry[]): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public applyCookies(_cookies: readonly CookieEntry[]): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public applyStorage(_scope: StorageScope, _entries: readonly StorageEntry[]): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public applyRequestOverrides(_overrides: readonly RequestOverrideEntry[]): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public applyGeneratorBindings(_bindings: readonly GeneratorBinding[]): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public resetGeneratorBindings(): Promise<void> { return Promise.reject(new BrowserUnavailableError()); }
  public selectElement(): Promise<string> { return Promise.reject(new BrowserUnavailableError()); }
}
