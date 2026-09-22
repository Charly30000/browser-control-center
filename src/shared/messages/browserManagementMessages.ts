import type { BrowserLifecycleState } from "../../domain/browser/browserBridge";
import type { BrowserInstallationSnapshot } from "../../infrastructure/browser/browserBinaryManager";

export type BrowserManagementToExtensionMessage =
  | { readonly type: "browserManagement.ready" }
  | { readonly type: "browserManagement.install" }
  | { readonly type: "browserManagement.verify" }
  | { readonly type: "browserManagement.reinstall" }
  | { readonly type: "browserManagement.remove" };

export type ExtensionToBrowserManagementMessage =
  | { readonly type: "browserManagement.state"; readonly installation: BrowserInstallationSnapshot; readonly lifecycle: BrowserLifecycleState; readonly busy: boolean; readonly progress: string }
  | { readonly type: "browserManagement.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string };

export const isBrowserManagementMessage = (value: unknown): value is BrowserManagementToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  return ["browserManagement.ready", "browserManagement.install", "browserManagement.verify", "browserManagement.reinstall", "browserManagement.remove"].includes(String((value as Record<string, unknown>).type));
};
