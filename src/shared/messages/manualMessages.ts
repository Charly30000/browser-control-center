import type { BrowserActionTarget } from "../../application/manual/browserActionsService";
import type { ArrayResource } from "../../domain/arrays/arrayResource";
import type { ManualProfile, ProfileSummary } from "../../domain/manual/manualProfile";
import type { GlobalResourceSummary } from "../../domain/resources/globalResource";
import type { BrowserSessionSnapshot } from "../../domain/browser/browserBridge";
import type { ManualPortableResources, ManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import { isManualProfile } from "../../infrastructure/persistence/profileSerializer";
import { isArrayResource } from "../../infrastructure/persistence/arrayResourceSerializer";
import { isFormulaResource } from "../../infrastructure/persistence/formulaSerializer";
import { isDestructiveConfirmationRequest, type DestructiveConfirmationRequestMessage, type DestructiveConfirmationResultMessage } from "./destructiveConfirmationMessages";

export interface ManualResourceCatalogs {
  readonly formulas: readonly GlobalResourceSummary[];
  readonly arrays: readonly ArrayResource[];
}

export interface ManualStatePayload {
  readonly profile: ManualProfile;
  readonly savedProfile: ManualProfile | null;
  readonly profiles: readonly ProfileSummary[];
  readonly browser: BrowserSessionSnapshot;
  readonly resources: ManualResourceCatalogs;
}

export type ManualToExtensionMessage =
  | DestructiveConfirmationRequestMessage
  | { readonly type: "manual.ready" }
  | { readonly type: "manual.new" }
  | { readonly type: "manual.select"; readonly id: string }
  | { readonly type: "manual.save"; readonly profile: ManualProfile; readonly resources: ManualPortableResources | null }
  | { readonly type: "manual.delete"; readonly id: string; readonly name: string }
  | { readonly type: "manual.export"; readonly profile: ManualProfile; readonly resources: ManualPortableResources | null }
  | { readonly type: "manual.viewJson"; readonly profile: ManualProfile; readonly resources: ManualPortableResources | null }
  | { readonly type: "manual.applyJson"; readonly serialized: string; readonly currentId: string }
  | { readonly type: "manual.import" }
  | { readonly type: "browser.open"; readonly profile: ManualProfile }
  | { readonly type: "browser.start"; readonly profile: ManualProfile }
  | { readonly type: "browser.restart"; readonly profile: ManualProfile }
  | { readonly type: "browser.stop"; readonly force: boolean }
  | { readonly type: "browser.selectPage"; readonly pageId: string }
  | { readonly type: "browser.closePage"; readonly pageId: string }
  | { readonly type: "browser.apply"; readonly target: BrowserActionTarget; readonly rowId: string | null; readonly profile: ManualProfile }
  | { readonly type: "browser.syncOverrides"; readonly profile: ManualProfile }
  | { readonly type: "browser.resetGenerators" }
  | { readonly type: "browser.selectElement"; readonly bindingId: string }
  | { readonly type: "browser.previewGenerator"; readonly bindingId: string; readonly profile: ManualProfile };

export type ExtensionToManualMessage =
  | DestructiveConfirmationResultMessage
  | { readonly type: "manual.state"; readonly state: ManualStatePayload }
  | { readonly type: "manual.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string }
  | { readonly type: "manual.resources"; readonly resources: ManualResourceCatalogs }
  | { readonly type: "manual.jsonDocument"; readonly serialized: string }
  | { readonly type: "manual.jsonApplied"; readonly bundle: ManualProfileBundle }
  | { readonly type: "browser.elementSelected"; readonly bindingId: string; readonly selector: string }
  | { readonly type: "browser.generatorPreview"; readonly bindingId: string; readonly value: string }
  | { readonly type: "browser.state"; readonly browser: BrowserSessionSnapshot };

const browserTargets: readonly BrowserActionTarget[] = ["headers", "cookies", "localStorage", "sessionStorage", "overrides", "generators"];

export const isManualToExtensionMessage = (value: unknown): value is ManualToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message.type === "ui.confirmDestructiveAction") return isDestructiveConfirmationRequest(value);
  switch (message.type) {
    case "manual.ready":
    case "manual.new":
    case "manual.import":
    case "browser.resetGenerators":
      return true;
    case "manual.applyJson":
      return typeof message.serialized === "string" && typeof message.currentId === "string";
    case "browser.stop":
      return typeof message.force === "boolean";
    case "browser.selectPage":
    case "browser.closePage":
      return typeof message.pageId === "string";
    case "manual.select":
      return typeof message.id === "string";
    case "manual.delete":
      return typeof message.id === "string" && typeof message.name === "string";
    case "manual.save":
      return isManualProfile(message.profile) && (message.resources === null || isPortableResources(message.resources));
    case "manual.export":
    case "manual.viewJson":
      return isManualProfile(message.profile) && (message.resources === null || isPortableResources(message.resources));
    case "browser.open":
    case "browser.start":
    case "browser.restart":
    case "browser.syncOverrides":
      return isManualProfile(message.profile);
    case "browser.apply":
      return typeof message.target === "string" && browserTargets.includes(message.target as BrowserActionTarget) &&
        (message.rowId === null || typeof message.rowId === "string") && isManualProfile(message.profile);
    case "browser.selectElement":
      return typeof message.bindingId === "string";
    case "browser.previewGenerator":
      return typeof message.bindingId === "string" && isManualProfile(message.profile);
    default:
      return false;
  }
};

const isPortableResources = (value: unknown): value is ManualPortableResources => {
  if (typeof value !== "object" || value === null) return false;
  const resources = value as Record<string, unknown>;
  return Array.isArray(resources.formulas) && resources.formulas.every(isFormulaResource) &&
    Array.isArray(resources.arrays) && resources.arrays.every(isArrayResource);
};
