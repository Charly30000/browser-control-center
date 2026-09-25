import type { BrowserLifecycleState } from "../../domain/browser/browserBridge";
import type { BrowserProviderId, BrowserProviderSnapshot } from "../../domain/browser/browserProvider";
import type { BrowserInstallationSnapshot } from "../../infrastructure/browser/providers/browserBinaryManager";

export type BrowserManagementToExtensionMessage =
  | { readonly type: "browserManagement.ready" }
  | { readonly type: "browserManagement.selectProvider"; readonly providerId: BrowserProviderId }
  | { readonly type: "browserManagement.install" }
  | { readonly type: "browserManagement.verify" }
  | { readonly type: "browserManagement.reinstall" }
  | { readonly type: "browserManagement.remove" };

export type ExtensionToBrowserManagementMessage =
  | {
    readonly type: "browserManagement.state";
    readonly providers: readonly BrowserProviderSnapshot[];
    readonly selectedProviderId: BrowserProviderId;
    readonly managedInstallation: BrowserInstallationSnapshot;
    readonly lifecycle: BrowserLifecycleState;
    readonly busy: boolean;
    readonly progress: string;
  }
  | { readonly type: "browserManagement.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string };

export const isBrowserManagementMessage = (value: unknown): value is BrowserManagementToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const record = value as Record<string, unknown>;
  if (record.type === "browserManagement.selectProvider") {
    return record.providerId === "managed-chromium" || record.providerId === "system-chrome";
  }
  return ["browserManagement.ready", "browserManagement.install", "browserManagement.verify", "browserManagement.reinstall", "browserManagement.remove"].includes(String(record.type));
};
