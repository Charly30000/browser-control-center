import { AUTOMATION_NODE_TYPES, type AutomationDocument, type AutomationNodeConfig, type AutomationNodeType } from "../../domain/automations/automation";
import type { GroupExecutionSummary, ProcessExecutionSnapshot } from "../../domain/automations/executionState";
import type { NodeDescriptor } from "../../application/automations/nodeRegistry";
import { isAutomationDocument } from "../../infrastructure/persistence/automationSerializer";
import type { GlobalResourceSummary } from "../../domain/resources/globalResource";
import { isJsonValue } from "../../domain/manual/storageValue";
import { isDestructiveConfirmationRequest, type DestructiveConfirmationRequestMessage, type DestructiveConfirmationResultMessage } from "./destructiveConfirmationMessages";
import type { AutomationSelectionScope } from "../../domain/automations/automationSelection";

export interface AutomationResourceCatalogs { readonly formulas: readonly GlobalResourceSummary[]; readonly arrays: readonly GlobalResourceSummary[]; }
export type AutomationJsonScope = AutomationSelectionScope;

export type AutomationToExtensionMessage =
  | DestructiveConfirmationRequestMessage
  | { readonly type: "automation.ready" }
  | { readonly type: "automation.save"; readonly document: AutomationDocument; readonly requestId?: string }
  | { readonly type: "automation.import" }
  | { readonly type: "automation.export"; readonly document: AutomationDocument }
  | { readonly type: "automation.viewJson"; readonly document: AutomationDocument; readonly scope: AutomationJsonScope }
  | { readonly type: "automation.applyJson"; readonly serialized: string; readonly scope: AutomationJsonScope }
  | { readonly type: "automation.runGroup"; readonly groupId: string; readonly document: AutomationDocument }
  | { readonly type: "automation.runProcess"; readonly groupId: string; readonly processId: string; readonly document: AutomationDocument }
  | { readonly type: "automation.pause" }
  | { readonly type: "automation.resume" }
  | { readonly type: "automation.stop"; readonly force: boolean }
  | { readonly type: "automation.continueUser"; readonly nodeId: string }
  | { readonly type: "automation.retryUser"; readonly nodeId: string }
  | { readonly type: "automation.selectElement"; readonly nodeId: string; readonly fieldKey: string }
  | { readonly type: "automation.validateNode"; readonly requestId: string; readonly nodeId: string; readonly nodeType: AutomationNodeType; readonly config: AutomationNodeConfig };

export type ExtensionToAutomationMessage =
  | { readonly type: "automation.operationCanceled" }
  | DestructiveConfirmationResultMessage
  | { readonly type: "automation.state"; readonly document: AutomationDocument; readonly descriptors: readonly NodeDescriptor[]; readonly resources: AutomationResourceCatalogs }
  | { readonly type: "automation.saved"; readonly requestId: string; readonly document: AutomationDocument }
  | { readonly type: "automation.saveFailed"; readonly requestId: string; readonly error: string }
  | { readonly type: "automation.resources"; readonly resources: AutomationResourceCatalogs }
  | { readonly type: "automation.jsonDocument"; readonly serialized: string; readonly scope: AutomationJsonScope }
  | { readonly type: "automation.jsonApplied"; readonly document: AutomationDocument; readonly scope: AutomationJsonScope }
  | { readonly type: "automation.nodeValidation"; readonly requestId: string; readonly nodeId: string; readonly error: string | null }
  | { readonly type: "automation.elementSelected"; readonly nodeId: string; readonly fieldKey: string; readonly selector: string }
  | { readonly type: "automation.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string }
  | { readonly type: "automation.processState"; readonly snapshot: ProcessExecutionSnapshot }
  | { readonly type: "automation.groupState"; readonly summary: GroupExecutionSummary };

export const isAutomationToExtensionMessage = (value: unknown): value is AutomationToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message.type === "ui.confirmDestructiveAction") return isDestructiveConfirmationRequest(value);
  switch (message.type) {
    case "automation.ready": case "automation.import": case "automation.pause": case "automation.resume": return true;
    case "automation.applyJson": return typeof message.serialized === "string" && isAutomationJsonScope(message.scope);
    case "automation.viewJson": return isAutomationDocument(message.document) && isAutomationJsonScope(message.scope);
    case "automation.save": return isAutomationDocument(message.document) && (message.requestId === undefined || typeof message.requestId === "string");
    case "automation.export": return isAutomationDocument(message.document);
    case "automation.runGroup": return typeof message.groupId === "string" && isAutomationDocument(message.document);
    case "automation.runProcess": return typeof message.groupId === "string" && typeof message.processId === "string" && isAutomationDocument(message.document);
    case "automation.stop": return typeof message.force === "boolean";
    case "automation.continueUser": case "automation.retryUser": return typeof message.nodeId === "string";
    case "automation.selectElement": return typeof message.nodeId === "string" && message.fieldKey === "selector";
    case "automation.validateNode": return typeof message.requestId === "string" && typeof message.nodeId === "string" && AUTOMATION_NODE_TYPES.includes(message.nodeType as AutomationNodeType) && typeof message.config === "object" && message.config !== null && !Array.isArray(message.config) && isJsonValue(message.config);
    default: return false;
  }
};

const isAutomationJsonScope = (value: unknown): value is AutomationJsonScope => {
  if (typeof value !== "object" || value === null) return false;
  const scope = value as Record<string, unknown>;
  return scope.kind === "group"
    ? typeof scope.groupId === "string"
    : scope.kind === "process" && typeof scope.groupId === "string" && typeof scope.processId === "string";
};
