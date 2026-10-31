import { t } from "../../localization";
import { isJsonValue } from "../manual/storageValue";
import type { AutomationDocument, AutomationNodeConfig, AutomationProcess } from "./automation";
import { AUTOMATION_SCHEMA_VERSION } from "./automation";
import { topologicalOrder } from "./graph";
import { isVariableName } from "./variables";
import { failure, success, type Result } from "../../shared/result";

export interface AutomationNodeConfigValidator { has(type: string): boolean; validate(type: string, config: unknown): Result<AutomationNodeConfig>; }
export interface AutomationValidationOptions { readonly validateNodeConfigs?: boolean; }

export const validateAutomationProcess = (process: AutomationProcess, registry: AutomationNodeConfigValidator, options: AutomationValidationOptions = {}): Result<AutomationProcess> => {
  if (process.name.trim() === "") return failure(t("text.theProcessNameIsRequired"));
  if (!Number.isFinite(process.viewport.width) || process.viewport.width <= 0 || !Number.isFinite(process.viewport.height) || process.viewport.height <= 0 || !Number.isFinite(process.viewport.deviceScaleFactor) || process.viewport.deviceScaleFactor <= 0) return failure(t("text.theProcessViewportIsInvalid"));
  const nodeIds = new Set<string>();
  for (const node of process.nodes) {
    if (nodeIds.has(node.id)) return failure(t("text.nodeIDArg0IsDuplicated", { arg0: node.id }));
    nodeIds.add(node.id);
    if (!registry.has(node.type)) return failure(t("text.nodeTypeArg0IsNotRegistered", { arg0: node.type }));
    if (options.validateNodeConfigs !== false) {
      const config = registry.validate(node.type, node.config);
      if (!config.ok) return failure(`${node.type}: ${config.error}`);
    }
    if (node.timeoutMs !== null && (!Number.isFinite(node.timeoutMs) || node.timeoutMs <= 0)) return failure(t("text.theTimeoutForNodeArg0IsInvalid", { arg0: node.id }));
  }
  const edgeIds = new Set<string>();
  for (const edge of process.edges) {
    if (edgeIds.has(edge.id)) return failure(t("text.connectionIDArg0IsDuplicated", { arg0: edge.id }));
    edgeIds.add(edge.id);
    if (edge.sourceNodeId === edge.targetNodeId) return failure(t("text.aNodeCannotConnectToItself"));
  }
  const graph = topologicalOrder(process.nodes, process.edges);
  if (!graph.ok) return graph;
  if (Object.keys(process.variables).some((name) => !isVariableName(name))) return failure(t("text.anInitialVariableNameIsInvalid"));
  return success(process);
};

export const validateAutomationDocument = (document: AutomationDocument, registry: AutomationNodeConfigValidator, options: AutomationValidationOptions = {}): Result<AutomationDocument> => {
  if (document.schemaVersion !== AUTOMATION_SCHEMA_VERSION) return failure(t("text.unsupportedAutomationVersion"));
  if (document.name.trim() === "") return failure(t("text.theAutomationNameIsRequired"));
  const ids = new Set<string>([document.id]);
  for (const group of document.groups) {
    if (ids.has(group.id)) return failure(t("text.idArg0IsDuplicated", { arg0: group.id })); ids.add(group.id);
    if (group.name.trim() === "") return failure(t("text.theGroupNameIsRequired"));
    for (const process of group.processes) {
      if (ids.has(process.id)) return failure(t("text.idArg0IsDuplicated", { arg0: process.id })); ids.add(process.id);
      const result = validateAutomationProcess(process, registry, options); if (!result.ok) return result;
    }
  }
  return isJsonValue(document.groups.map((group) => group.processes.map((process) => process.variables))) ? success(document) : failure(t("text.variablesContainValuesThatCannotBeSerialized"));
};
