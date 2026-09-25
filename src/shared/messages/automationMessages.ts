import { AUTOMATION_NODE_TYPES, type AutomationDocument, type AutomationNodeConfig, type AutomationNodeType } from "../../domain/automations/automation";
import type { GroupExecutionSummary, ProcessExecutionSnapshot } from "../../domain/automations/executionState";
import type { NodeDescriptor } from "../../application/automations/nodeRegistry";
import { isAutomationDocument } from "../../infrastructure/persistence/automationSerializer";
import type { GlobalResourceSummary } from "../../domain/resources/globalResource";
import { isJsonValue } from "../../domain/manual/storageValue";
import { isDestructiveConfirmationRequest, type DestructiveConfirmationRequestMessage, type DestructiveConfirmationResultMessage } from "./destructiveConfirmationMessages";

export interface AutomationResourceCatalogs { readonly formulas: readonly GlobalResourceSummary[]; readonly arrays: readonly GlobalResourceSummary[]; }

export type AutomationToExtensionMessage =
  | DestructiveConfirmationRequestMessage
  | { readonly type: "automation.ready" }
  | { readonly type: "automation.save"; readonly document: AutomationDocument }
  | { readonly type: "automation.import" }
  | { readonly type: "automation.export"; readonly document: AutomationDocument }
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
  | DestructiveConfirmationResultMessage
  | { readonly type: "automation.state"; readonly document: AutomationDocument; readonly descriptors: readonly NodeDescriptor[]; readonly resources: AutomationResourceCatalogs }
  | { readonly type: "automation.resources"; readonly resources: AutomationResourceCatalogs }
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
    case "automation.save": case "automation.export": return isAutomationDocument(message.document);
    case "automation.runGroup": return typeof message.groupId === "string" && isAutomationDocument(message.document);
    case "automation.runProcess": return typeof message.groupId === "string" && typeof message.processId === "string" && isAutomationDocument(message.document);
    case "automation.stop": return typeof message.force === "boolean";
    case "automation.continueUser": case "automation.retryUser": return typeof message.nodeId === "string";
    case "automation.selectElement": return typeof message.nodeId === "string" && message.fieldKey === "selector";
    case "automation.validateNode": return typeof message.requestId === "string" && typeof message.nodeId === "string" && AUTOMATION_NODE_TYPES.includes(message.nodeType as AutomationNodeType) && typeof message.config === "object" && message.config !== null && !Array.isArray(message.config) && isJsonValue(message.config);
    default: return false;
  }
};
