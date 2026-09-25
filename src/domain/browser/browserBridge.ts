import type {
  CookieEntry,
  HeaderEntry,
  RequestOverrideEntry,
  StorageEntry,
  TargetPropertyKind,
  ViewportConfiguration
} from "../manual/manualProfile";

export type StorageScope = "local" | "session";
export type BrowserLifecycleState = "stopped" | "starting" | "running" | "stopping" | "crashed";
export type BrowserStopMode = "graceful" | "force";

export interface BrowserPageSnapshot {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly active: boolean;
}

export interface BrowserSessionSnapshot {
  readonly lifecycle: BrowserLifecycleState;
  readonly pages: readonly BrowserPageSnapshot[];
  readonly activePageId: string | null;
}

export interface BrowserLaunchOptions { readonly viewport: ViewportConfiguration; }

export interface ResolvedInputBinding {
  readonly selector: string;
  readonly propertyKind: TargetPropertyKind;
  readonly propertyName: string;
  readonly value: unknown;
  readonly inputMode: "instant" | "sequential";
  readonly delayMs: number;
}

export interface ElementTarget { readonly selector: string; readonly tagName: string; readonly preview: string; }
export type BrowserEventListener = (snapshot: BrowserSessionSnapshot) => void;
export interface Disposable { dispose(): void; }

export interface BrowserBridge {
  start(options: BrowserLaunchOptions): Promise<BrowserSessionSnapshot>;
  stop(mode: BrowserStopMode): Promise<void>;
  restart(options: BrowserLaunchOptions): Promise<BrowserSessionSnapshot>;
  getSnapshot(): BrowserSessionSnapshot;
  listPages(): readonly BrowserPageSnapshot[];
  selectPage(pageId: string): Promise<void>;
  closePage(pageId: string): Promise<void>;
  open(url: string, options: BrowserLaunchOptions): Promise<void>;
  applyHeaders(headers: readonly HeaderEntry[]): Promise<void>;
  applyCookies(cookies: readonly CookieEntry[]): Promise<void>;
  applyStorage(scope: StorageScope, entries: readonly StorageEntry[]): Promise<void>;
  applyRequestOverrides(overrides: readonly RequestOverrideEntry[]): Promise<void>;
  applyInputBindings(bindings: readonly ResolvedInputBinding[]): Promise<void>;
  resetInputBindings(): Promise<void>;
  selectElement(): Promise<ElementTarget>;
  onDidChange(listener: BrowserEventListener): Disposable;
}

export class BrowserUnavailableError extends Error {
  public constructor(message = "El navegador seleccionado no está instalado o no está disponible.") {
    super(message);
    this.name = "BrowserUnavailableError";
  }
}
