import { AUTOMATION_NODE_TYPES, AUTOMATION_SCHEMA_VERSION, type AutomationDocument, type AutomationEdge, type AutomationGroup, type AutomationNode, type AutomationProcess } from "../../domain/automations/automation";
import type { ViewportConfiguration } from "../../domain/manual/manualProfile";
import { isJsonValue } from "../../domain/manual/storageValue";
import { repairCompleteAutomationExamples } from "../../domain/automations/exampleAutomation";
import { failure, success, type Result } from "../../shared/result";

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const date = (value: unknown): value is string => string(value) && !Number.isNaN(Date.parse(value));

const viewport = (value: unknown): value is ViewportConfiguration => record(value) && ["desktop", "laptop", "tabletPortrait", "tabletLandscape", "mobilePortrait", "mobileLandscape", "custom"].includes(String(value.preset)) && finite(value.width) && value.width > 0 && finite(value.height) && value.height > 0 && finite(value.deviceScaleFactor) && value.deviceScaleFactor > 0 && typeof value.hasTouch === "boolean" && typeof value.isMobile === "boolean";
const point = (value: unknown): value is { x: number; y: number } => record(value) && finite(value.x) && finite(value.y);
const node = (value: unknown): value is AutomationNode => record(value) && string(value.id) && AUTOMATION_NODE_TYPES.includes(value.type as AutomationNode["type"]) && point(value.position) && record(value.config) && isJsonValue(value.config) && (value.timeoutMs === null || finite(value.timeoutMs));
const edge = (value: unknown): value is AutomationEdge => record(value) && string(value.id) && string(value.sourceNodeId) && string(value.sourcePort) && string(value.targetNodeId) && string(value.targetPort);
const process = (value: unknown): value is AutomationProcess => record(value) && string(value.id) && string(value.name) && viewport(value.viewport) && Array.isArray(value.nodes) && value.nodes.every(node) && Array.isArray(value.edges) && value.edges.every(edge) && record(value.variables) && isJsonValue(value.variables);
const group = (value: unknown): value is AutomationGroup => record(value) && string(value.id) && string(value.name) && Array.isArray(value.processes) && value.processes.every(process);

export const isAutomationDocument = (value: unknown): value is AutomationDocument => record(value) && value.schemaVersion === AUTOMATION_SCHEMA_VERSION && string(value.id) && string(value.name) && Array.isArray(value.groups) && value.groups.every(group) && date(value.createdAt) && date(value.updatedAt);
export const serializeAutomation = (document: AutomationDocument): string => JSON.stringify(document, null, 2);
export const deserializeAutomation = (serialized: string): Result<AutomationDocument> => {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { return failure("El archivo no contiene JSON válido."); }
  if (!record(value)) return failure("La automatización debe ser un objeto JSON.");
  if (value.schemaVersion !== AUTOMATION_SCHEMA_VERSION) return failure(`Versión no compatible. Se esperaba ${AUTOMATION_SCHEMA_VERSION}.`);
  return isAutomationDocument(value) ? success(repairCompleteAutomationExamples(value)) : failure("La estructura de la automatización no es válida.");
};
