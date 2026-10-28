import { isJsonValue } from "../manual/storageValue";
import type { AutomationDocument, AutomationNodeConfig, AutomationProcess } from "./automation";
import { AUTOMATION_SCHEMA_VERSION } from "./automation";
import { topologicalOrder } from "./graph";
import { isVariableName } from "./variables";
import { failure, success, type Result } from "../../shared/result";

export interface AutomationNodeConfigValidator { has(type: string): boolean; validate(type: string, config: unknown): Result<AutomationNodeConfig>; }
export interface AutomationValidationOptions { readonly validateNodeConfigs?: boolean; }

export const validateAutomationProcess = (process: AutomationProcess, registry: AutomationNodeConfigValidator, options: AutomationValidationOptions = {}): Result<AutomationProcess> => {
  if (process.name.trim() === "") return failure("El nombre del proceso es obligatorio.");
  if (!Number.isFinite(process.viewport.width) || process.viewport.width <= 0 || !Number.isFinite(process.viewport.height) || process.viewport.height <= 0 || !Number.isFinite(process.viewport.deviceScaleFactor) || process.viewport.deviceScaleFactor <= 0) return failure("El viewport del proceso no es válido.");
  const nodeIds = new Set<string>();
  for (const node of process.nodes) {
    if (nodeIds.has(node.id)) return failure(`El ID de nodo «${node.id}» está duplicado.`);
    nodeIds.add(node.id);
    if (!registry.has(node.type)) return failure(`El tipo de nodo «${node.type}» no está registrado.`);
    if (options.validateNodeConfigs !== false) {
      const config = registry.validate(node.type, node.config);
      if (!config.ok) return failure(`${node.type}: ${config.error}`);
    }
    if (node.timeoutMs !== null && (!Number.isFinite(node.timeoutMs) || node.timeoutMs <= 0)) return failure(`El timeout del nodo «${node.id}» no es válido.`);
  }
  const edgeIds = new Set<string>();
  for (const edge of process.edges) {
    if (edgeIds.has(edge.id)) return failure(`El ID de conexión «${edge.id}» está duplicado.`);
    edgeIds.add(edge.id);
    if (edge.sourceNodeId === edge.targetNodeId) return failure("Un nodo no puede conectarse consigo mismo.");
  }
  const graph = topologicalOrder(process.nodes, process.edges);
  if (!graph.ok) return graph;
  if (Object.keys(process.variables).some((name) => !isVariableName(name))) return failure("Hay un nombre de variable inicial no válido.");
  return success(process);
};

export const validateAutomationDocument = (document: AutomationDocument, registry: AutomationNodeConfigValidator, options: AutomationValidationOptions = {}): Result<AutomationDocument> => {
  if (document.schemaVersion !== AUTOMATION_SCHEMA_VERSION) return failure("Versión de automatización no compatible.");
  if (document.name.trim() === "") return failure("El nombre de la automatización es obligatorio.");
  const ids = new Set<string>([document.id]);
  for (const group of document.groups) {
    if (ids.has(group.id)) return failure(`El ID «${group.id}» está duplicado.`); ids.add(group.id);
    if (group.name.trim() === "") return failure("El nombre del grupo es obligatorio.");
    for (const process of group.processes) {
      if (ids.has(process.id)) return failure(`El ID «${process.id}» está duplicado.`); ids.add(process.id);
      const result = validateAutomationProcess(process, registry, options); if (!result.ok) return result;
    }
  }
  return isJsonValue(document.groups.map((group) => group.processes.map((process) => process.variables))) ? success(document) : failure("Las variables contienen valores no serializables.");
};
