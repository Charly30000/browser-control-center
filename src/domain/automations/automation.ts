import type { ViewportConfiguration } from "../manual/manualProfile";
import { defaultViewport, DEFAULT_SEQUENTIAL_DELAY_MS } from "../manual/manualProfile";
import type { JsonValue } from "../manual/storageValue";
import type { EditorPreferences } from "../resources/editorPreferences";

export const AUTOMATION_SCHEMA_VERSION = 1 as const;

export type AutomationNodeType =
  | "navigate" | "click" | "fill" | "generate-value"
  | "set-headers" | "set-cookies" | "set-storage" | "request-override"
  | "wait" | "assertion" | "validate-data" | "extract-value" | "set-variable" | "capture-value" | "wait-user";

export const AUTOMATION_NODE_TYPES: readonly AutomationNodeType[] = ["navigate", "click", "fill", "generate-value", "set-headers", "set-cookies", "set-storage", "request-override", "wait", "assertion", "validate-data", "extract-value", "set-variable", "capture-value", "wait-user"];

export interface Point { x: number; y: number; }
export type AutomationNodeConfig = Record<string, JsonValue>;

export interface AutomationNode {
  readonly id: string;
  type: AutomationNodeType;
  position: Point;
  config: AutomationNodeConfig;
  timeoutMs: number | null;
}

export interface AutomationEdge {
  readonly id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface AutomationProcess {
  readonly id: string;
  name: string;
  viewport: ViewportConfiguration;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  variables: Record<string, JsonValue>;
}

export interface AutomationGroup {
  readonly id: string;
  name: string;
  /** Los documentos anteriores sin esta preferencia se muestran expandidos. */
  expanded?: boolean;
  processes: AutomationProcess[];
}

export interface AutomationDocument {
  readonly schemaVersion: typeof AUTOMATION_SCHEMA_VERSION;
  readonly id: string;
  name: string;
  groups: AutomationGroup[];
  createdAt: string;
  updatedAt: string;
  preferences?: EditorPreferences;
}

export const createAutomationDocument = (id: string, now = new Date().toISOString()): AutomationDocument => ({
  schemaVersion: AUTOMATION_SCHEMA_VERSION, id, name: "Automatizaciones", groups: [], createdAt: now, updatedAt: now
});

export const createAutomationGroup = (id: string, name = "Nuevo grupo"): AutomationGroup => ({ id, name, processes: [] });
export const createAutomationProcess = (id: string, name = "Nuevo proceso"): AutomationProcess => ({ id, name, viewport: defaultViewport(), nodes: [], edges: [], variables: {} });

const defaultConfigs: Record<AutomationNodeType, AutomationNodeConfig> = {
  navigate: { url: "https://example.com", queryParams: [] },
  click: { selector: "" },
  fill: { selector: "", generatorType: "string", value: "", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: DEFAULT_SEQUENTIAL_DELAY_MS },
  "generate-value": { generatorType: "firstName", outputVariable: "generatedValue", min: "0", max: "100", resourceId: null },
  "set-headers": { entries: [] },
  "set-cookies": { entries: [] },
  "set-storage": { scope: "local", entries: [] },
  "request-override": { entries: [] },
  wait: { kind: "fixed", durationMs: 1000, maxDurationMs: 2000, selector: "", url: "", status: 200 },
  assertion: { kind: "exists", selector: "", expected: "" },
  "validate-data": { source: "request", urlPattern: "", key: "", pathPreset: "url", path: "", operator: "exists", expected: "" },
  "extract-value": { selector: "", property: "textContent", attribute: "", outputVariable: "extractedValue" },
  "set-variable": { name: "variable", value: "" },
  "capture-value": { source: "previous", selector: "", property: "value", attribute: "", path: "", valueType: "auto", outputVariable: "capturedValue" },
  "wait-user": { message: "Completa la acción en el navegador y pulsa Continuar." }
};

export const createAutomationNode = (id: string, type: AutomationNodeType, position: Point): AutomationNode => ({
  id, type, position, config: structuredClone(defaultConfigs[type]), timeoutMs: null
});
