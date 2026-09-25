export type BrowserProviderId = "managed-chromium" | "system-chrome";
export type BrowserEngine = "chromium" | "firefox" | "webkit";
export type BrowserProviderState = "missing" | "installing" | "ready" | "corrupted" | "incompatible";

export interface BrowserLaunchConfiguration {
  readonly providerId: BrowserProviderId;
  readonly displayName: string;
  readonly engine: BrowserEngine;
  readonly executablePath: string | null;
  readonly channel: string | null;
}

export interface BrowserProviderSnapshot {
  readonly id: BrowserProviderId;
  readonly displayName: string;
  readonly state: BrowserProviderState;
  readonly browserVersion: string | null;
  readonly executablePath: string | null;
  readonly detail: string;
  readonly installable: boolean;
}

export interface BrowserPreferences {
  readonly version: 1;
  readonly selectedProviderId: BrowserProviderId;
}

export const DEFAULT_BROWSER_PREFERENCES: BrowserPreferences = { version: 1, selectedProviderId: "managed-chromium" };
