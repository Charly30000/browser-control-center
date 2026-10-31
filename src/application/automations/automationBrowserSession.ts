import type { CookieEntry, HeaderEntry, InputMode, RequestOverrideEntry, StorageEntry, ViewportConfiguration } from "../../domain/manual/manualProfile";
import type { JsonValue } from "../../domain/manual/storageValue";
import type { DataAssertionOperator, DataAssertionSource } from "../../domain/automations/dataAssertion";

export type WaitKind = "fixed" | "random" | "element" | "url" | "navigation" | "response";
export type { AssertionKind } from "../../domain/automations/assertion";
import type { AssertionKind } from "../../domain/automations/assertion";
export type ExtractProperty = "value" | "textContent" | "innerText" | "attribute";
export type BrowserUserAction = "continue" | "retry" | "stop" | "dismissed";

export interface AutomationBrowserSession {
  navigate(url: string, timeoutMs: number): Promise<void>;
  click(selector: string, timeoutMs: number): Promise<void>;
  fill(selector: string, value: JsonValue, mode: InputMode, delayMs: number, timeoutMs: number): Promise<void>;
  setHeaders(entries: readonly HeaderEntry[]): Promise<void>;
  setCookies(entries: readonly CookieEntry[]): Promise<void>;
  setStorage(scope: "local" | "session", entries: readonly StorageEntry[]): Promise<void>;
  removeHeaders(names: readonly string[] | null): Promise<void>;
  removeCookies(names: readonly string[] | null, domain: string, path: string): Promise<void>;
  removeStorage(scope: "local" | "session", names: readonly string[] | null): Promise<void>;
  setRequestOverrides(entries: readonly RequestOverrideEntry[]): Promise<void>;
  wait(kind: WaitKind, options: Readonly<Record<string, JsonValue>>, timeoutMs: number): Promise<void | JsonValue>;
  assert(kind: AssertionKind, options: Readonly<Record<string, JsonValue>>, timeoutMs: number): Promise<void>;
  assertData(source: DataAssertionSource, operator: DataAssertionOperator, options: Readonly<Record<string, JsonValue>>, timeoutMs: number): Promise<void>;
  extract(selector: string, property: ExtractProperty, attribute: string, timeoutMs: number): Promise<JsonValue>;
  showUserPrompt(message: string): Promise<BrowserUserAction>;
  hideUserPrompt(): Promise<void>;
  close(force: boolean): Promise<void>;
}

export interface AutomationBrowserSessionFactory { create(viewport: ViewportConfiguration): Promise<AutomationBrowserSession>; }
